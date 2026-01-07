
import { GoogleGenAI } from "@google/genai";

class GeminiQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL = 4000; 

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
 * Inizializza il client Gemini.
 * Utilizza direttamente process.env.API_KEY come richiesto dalle linee guida.
 */
export const getClient = () => {
  // Assicuriamo che apiKey sia almeno una stringa vuota per evitare errori di tipo
  const apiKey = process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 5000): Promise<T> => {
  return geminiQueue.add(async () => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (error.message?.includes("API_KEY") || error.message?.includes("API key")) {
          console.error("[Gemini] API Key mancante o non valida.");
          throw error;
        }
        if (i < retries) {
          console.warn(`[Gemini] Tentativo ${i + 1} fallito, riprovo in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
      }
    }
    throw lastError;
  });
};
