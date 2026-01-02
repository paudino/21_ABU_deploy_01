import { GoogleGenAI } from "@google/genai";

/**
 * Restituisce l'istanza del client Gemini configurata.
 */
export const getClient = () => {
  const apiKey = (import.meta as any).env?.VITE_API_KEY || 
                 (typeof process !== 'undefined' ? process.env.API_KEY : undefined);

  if (!apiKey) {
    throw new Error("Gemini API Key non trovata.");
  }

  return new GoogleGenAI({ apiKey });
};

/**
 * Funzione helper per eseguire chiamate API con retry automatico in caso di Rate Limit (429).
 * Implementa un backoff esponenziale più aggressivo per il piano free.
 */
export const withRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 5000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || 
                        error?.status === 429 || 
                        error?.message?.toLowerCase().includes('quota') ||
                        error?.message?.toLowerCase().includes('limit');
    
    if (isRateLimit && retries > 0) {
      console.warn(`[Gemini] Limite raggiunto. Riprovo tra ${delay/1000}s... (Tentativi rimasti: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Aumentiamo il delay esponenzialmente
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
};
