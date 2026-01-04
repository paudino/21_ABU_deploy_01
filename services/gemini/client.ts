
import { GoogleGenAI } from "@google/genai";

class GeminiQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  // Aumentato a 10 secondi per essere ultra-conservativi con la quota gratuita
  private readonly MIN_INTERVAL = 10000; 

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const wait = Math.max(0, this.MIN_INTERVAL - (now - this.lastRequestTime));
          if (wait > 0) {
              console.log(`[GeminiQueue] Attesa di sicurezza: ${wait}ms...`);
              await new Promise(r => setTimeout(r, wait));
          }
          
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
          try { await task(); } catch (e) {
              console.warn("[GeminiQueue] Errore durante l'esecuzione del task:", e);
          }
      }
    }
    this.processing = false;
  }
}

export const geminiQueue = new GeminiQueue();

export const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

/**
 * Funzione con retry esponenziale e gestione specifica del 429.
 */
export const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 12000): Promise<T> => {
  return geminiQueue.add(async () => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || "";
        const isRateLimit = errorMsg.includes('429') || error?.status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED');
        
        if (isRateLimit) {
            console.warn(`[Gemini] Quota esaurita (Tentativo ${i+1}/${retries+1})...`);
            if (i < retries) {
              await new Promise(r => setTimeout(r, delay));
              delay *= 2; 
              continue;
            }
        }
        throw error;
      }
    }
    throw lastError;
  });
};
