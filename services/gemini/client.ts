
import { GoogleGenAI } from "@google/genai";

// Timestamp dell'ultimo errore 429 per bloccare temporaneamente le chiamate
let lastQuotaExhaustedTime = 0;
const QUOTA_BLOCK_DURATION = 60 * 1000 * 2; // 2 minuti

/**
 * Client Gemini factory.
 */
export const getClient = () => {
  const key = process.env.API_KEY;
  if (!key || key === 'PLACEHOLDER_API_KEY') {
    console.error("[GEMINI-CLIENT] ❌ API KEY MANCANTE!");
  }
  return new GoogleGenAI({ apiKey: key || '' });
};

/**
 * Verifica se siamo in un periodo di blocco quota.
 */
export const isQuotaExhausted = () => {
  return (Date.now() - lastQuotaExhaustedTime) < QUOTA_BLOCK_DURATION;
};

/**
 * Esegue una funzione Gemini con logica di retry e gestione fallback.
 */
export const callGeminiWithRetry = async <T>(
    operation: () => Promise<T>, 
    maxRetries = 2, 
    delayMs = 2000
): Promise<T | null> => {
    if (isQuotaExhausted()) {
        console.warn("[GEMINI-CLIENT] ⏳ Chiamata annullata: Quota ancora in fase di ripristino.");
        return null;
    }

    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const errorMsg = error?.message || "";
            const isRateLimit = errorMsg.includes('429') || error?.status === 429;
            
            if (isRateLimit) {
                lastQuotaExhaustedTime = Date.now();
                console.error(`[GEMINI-RETRY] 🛑 Quota esaurita (429). Blocco AI per 2 minuti.`);
                
                if (i < maxRetries - 1) {
                    const backoff = delayMs * Math.pow(2, i);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    continue;
                }
            }
            break;
        }
    }
    return null;
};
