
import { GoogleGenAI } from "@google/genai";

class GeminiQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL = 500;

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
          try { 
            const taskTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("GEMINI_TASK_TIMEOUT")), 45000));
            await Promise.race([task(), taskTimeout]);
          } catch (e) { 
            console.error("[Gemini-Queue] Error in task processing:", e); 
          }
      }
    }
    this.processing = false;
  }
}

export const geminiQueue = new GeminiQueue();

/**
 * Controlla se è presente una chiave API valida.
 * Se manca, tenta di aprire il selettore di chiavi di AI Studio.
 */
export const ensureApiKey = async (): Promise<boolean> => {
    const isKeyValid = (key?: string) => !!key && key !== 'undefined' && key !== 'null' && key.length > 5;
    
    // Se la chiave è già in process.env, siamo a posto
    if (isKeyValid(process.env.API_KEY)) return true;

    const aistudio = (window as any).aistudio;
    if (aistudio) {
        try {
            // Regola: usa hasSelectedApiKey per verificare
            const hasSelected = await aistudio.hasSelectedApiKey();
            if (hasSelected) return true;
            
            // Regola: se non selezionata, apri il dialogo
            console.warn("[Gemini-Client] API Key mancante. Apertura selettore...");
            await aistudio.openSelectKey();
            // Regola: assumi successo dopo l'apertura per mitigare race conditions
            return true;
        } catch (e) {
            console.error("[Gemini-Client] Errore durante l'accesso ad AI Studio:", e);
        }
    }
    return false;
};

/**
 * Restituisce un'istanza di GoogleGenAI.
 * Regola: Crea l'istanza subito prima della chiamata per usare la chiave più aggiornata.
 */
export const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      // Innesca il selettore se possibile invece di lanciare solo l'errore
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.openSelectKey === 'function') {
          aistudio.openSelectKey();
      }
      throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Wrapper per eseguire chiamate AI con retry e gestione automatica della chiave.
 */
export const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> => {
  // Assicuriamoci che la chiave sia stata chiesta almeno una volta
  await ensureApiKey();

  return geminiQueue.add(async () => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        // Regola: getClient() viene chiamato internamente da fn() solitamente,
        // ma noi vogliamo rilanciare con la chiave fresca se necessario.
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Se l'errore suggerisce entità non trovata (spesso legato a chiavi/progetti non validi)
        // resettiamo e riproviamo il selettore.
        if (error.message?.includes("Requested entity was not found")) {
            console.error("[Gemini-Client] Errore entità non trovata. Riprovo selezione chiave.");
            await ensureApiKey();
        }

        if (error.message === "API_KEY_MISSING") {
             const activated = await ensureApiKey();
             if (!activated) throw error;
        }
        
        if (i < retries) {
          const backoff = delay * Math.pow(2, i);
          console.warn(`[Gemini-Client] Tentativo ${i + 1} fallito. Riprovo in ${backoff}ms...`);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
      }
    }
    throw lastError;
  });
};
