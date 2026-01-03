
import { GoogleGenAI } from "@google/genai";

/**
 * Coda globale per serializzare tutte le chiamate Gemini.
 * Indispensabile per il piano gratuito che ha limiti RPM (Requests Per Minute) molto bassi,
 * specialmente per il tool Google Search.
 */
class GeminiQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL = 8000; // 8 secondi tra richieste per evitare 429 su Search

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const wait = Math.max(0, this.MIN_INTERVAL - (now - this.lastRequestTime));
          if (wait > 0) {
              console.log(`[Gemini Queue] Rispetto limite quota, attesa: ${wait}ms...`);
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
          try {
              await task();
          } catch (e) {
              // Gestito dalla promise in add()
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
 * Helper con retry e backoff aggressivo per errori 429.
 */
export const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 10000): Promise<T> => {
  return geminiQueue.add(async () => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error?.message?.includes('429') || 
                            error?.status === 429 || 
                            error?.message?.toLowerCase().includes('quota');
        
        if (isRateLimit && i < retries) {
          console.warn(`[Gemini Retry] Limite raggiunto. Tentativo ${i+1}/${retries}. Pausa di ${delay/1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2; 
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  });
};
