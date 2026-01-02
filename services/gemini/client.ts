import { GoogleGenAI } from "@google/genai";

/**
 * Restituisce l'istanza del client Gemini configurata.
 * Garantisce il recupero della chiave sia in ambiente di sviluppo (Vite)
 * che in produzione (Vercel) seguendo le linee guida di sicurezza.
 */
export const getClient = () => {
  // Tentativo di recupero tramite standard Vite (VITE_API_KEY) o Node (process.env.API_KEY)
  const apiKey = (import.meta as any).env?.VITE_API_KEY || 
                 (typeof process !== 'undefined' ? process.env.API_KEY : undefined);

  if (!apiKey) {
    throw new Error(
      "Gemini API Key non trovata. \n\n" +
      "ASSICURATI CHE:\n" +
      "1. Su Vercel: La variabile d'ambiente sia rinominata in VITE_API_KEY.\n" +
      "2. Dopo il cambio: Hai effettuato un nuovo 'Redeploy' su Vercel."
    );
  }

  // Inizializzazione con la chiave recuperata
  return new GoogleGenAI({ apiKey });
};
