
import { GoogleGenAI } from "@google/genai";

class GeminiQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL = 3000; 

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const wait = Math.max(0, this.MIN_INTERVAL - (now - this.lastRequestTime));
          if (wait > 0) await new Promise(r => setTimeout(r, wait));
          
          const result = await fn();
          this.lastRequestTime = Date.now();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
          try { await task(); } catch (e) { console.error("[Gemini-Queue] Error:", e); }
      }
    }
    this.processing = false;
  }
}

export const geminiQueue = new GeminiQueue();

/**
 * Verifica se l'API Key è presente e valida.
 * Se manca, prova ad attivare il selettore di Google AI Studio "nascostamente".
 */
export const ensureApiKey = async (): Promise<boolean> => {
    const isKeyValid = (key?: string) => !!key && key !== 'undefined' && key !== 'null' && key.length > 5;
    
    // Se la chiave è già presente in process.env, siamo a posto
    if (isKeyValid(process.env.API_KEY)) return true;

    const aistudio = (window as any).aistudio;
    if (aistudio) {
        try {
            // Controlliamo se una chiave è già stata selezionata nel contesto aistudio
            if (typeof aistudio.hasSelectedApiKey === 'function') {
                const hasSelected = await aistudio.hasSelectedApiKey();
                if (hasSelected) return true;
            }
            
            // Se non c'è e siamo chiamati, è il "momento opportuno" per aprirlo
            if (typeof aistudio.openSelectKey === 'function') {
                console.log("[BuonUmore-AI] Chiave mancante. Attivazione automatica selettore...");
                await aistudio.openSelectKey();
                return true; // Procediamo assumendo che l'utente selezioni una chiave
            }
        } catch (e) {
            console.error("[BuonUmore-AI] Errore attivazione chiave:", e);
        }
    }
    return false;
};

/**
 * Crea una nuova istanza di GoogleGenAI utilizzando la chiave API corrente.
 */
export const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 4000): Promise<T> => {
  // Prima di ogni operazione AI, ci assicuriamo che la chiave esista
  await ensureApiKey();

  return geminiQueue.add(async () => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Se la chiave manca, riproviamo l'attivazione una volta sola
        if (error.message === "API_KEY_MISSING") {
             const activated = await ensureApiKey();
             if (!activated) throw error;
        }
        
        if (i < retries) {
          console.warn(`[Gemini-Client] Tentativo ${i + 1} fallito. Riprovo...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 1.5;
          continue;
        }
      }
    }
    throw lastError;
  });
};
