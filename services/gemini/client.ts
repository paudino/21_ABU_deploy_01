
import { GoogleGenAI } from "@google/genai";

class GeminiQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL = 500; // Ridotto da 3000 a 500ms per maggiore reattività

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
            // Aggiunto un timeout di sicurezza al singolo task per evitare blocchi infiniti
            const taskTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("GEMINI_TASK_TIMEOUT")), 30000));
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

export const ensureApiKey = async (): Promise<boolean> => {
    const isKeyValid = (key?: string) => !!key && key !== 'undefined' && key !== 'null' && key.length > 5;
    
    if (isKeyValid(process.env.API_KEY)) return true;

    const aistudio = (window as any).aistudio;
    if (aistudio) {
        try {
            if (typeof aistudio.hasSelectedApiKey === 'function') {
                const hasSelected = await aistudio.hasSelectedApiKey();
                if (hasSelected) return true;
            }
            
            if (typeof aistudio.openSelectKey === 'function') {
                console.log("[BuonUmore-AI] Chiave mancante. Attivazione selettore...");
                // Non attendiamo (await) il completamento del dialogo per non bloccare l'interfaccia
                aistudio.openSelectKey();
                return true; 
            }
        } catch (e) {
            console.error("[BuonUmore-AI] Errore attivazione chiave:", e);
        }
    }
    return false;
};

export const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const withRetry = async <T>(fn: () => Promise<T>, retries = 1, delay = 2000): Promise<T> => {
  await ensureApiKey();

  return geminiQueue.add(async () => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (error.message === "API_KEY_MISSING") {
             const activated = await ensureApiKey();
             if (!activated) throw error;
        }
        
        if (i < retries) {
          console.warn(`[Gemini-Client] Tentativo ${i + 1} fallito. Riprovo in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
    }
    throw lastError;
  });
};
