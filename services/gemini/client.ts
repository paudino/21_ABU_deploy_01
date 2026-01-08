
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
 * Crea una nuova istanza di GoogleGenAI utilizzando la chiave API corrente.
 * Questo assicura che se l'utente cambia chiave tramite il dialogo, l'app la utilizzi subito.
 */
export const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
      throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 4000): Promise<T> => {
  return geminiQueue.add(async () => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        // Se la chiave manca, non ha senso riprovare
        if (error.message === "API_KEY_MISSING") throw error;
        
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
