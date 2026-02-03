
import { GoogleGenAI } from "@google/genai";

let lastQuotaExhaustedTime = 0;
const QUOTA_BLOCK_DURATION = 60 * 1000 * 2; 

export const getClient = () => {
  const key = process.env.API_KEY;
  return new GoogleGenAI({ apiKey: key || '' });
};

export const isQuotaExhausted = () => {
  return (Date.now() - lastQuotaExhaustedTime) < QUOTA_BLOCK_DURATION;
};

export const resetQuotaBlock = () => {
  lastQuotaExhaustedTime = 0;
};

export const callGeminiWithRetry = async <T>(
    operation: () => Promise<T>, 
    maxRetries = 1, // Ridotto per fallire velocemente e passare al fallback
    delayMs = 1000
): Promise<T | null> => {
    let lastError: any;
    
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const errorMsg = error?.message || "";
            const isRateLimit = errorMsg.includes('429') || error?.status === 429;
            
            if (isRateLimit) {
                // Non blocchiamo subito, lasciamo che il chiamante decida se provare il fallback
                if (i < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                // Solo all'ultimo fallimento impostiamo il blocco globale
                lastQuotaExhaustedTime = Date.now();
            }
            break;
        }
    }
    return null;
};
