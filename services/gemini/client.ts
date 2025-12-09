
import { GoogleGenAI } from "@google/genai";

/**
 * Restituisce l'istanza del client Gemini configurata.
 * In produzione (es. Vercel), la API_KEY verrà letta dalle variabili d'ambiente.
 */
export const getClient = () => {
  // La chiave deve essere fornita tramite process.env.API_KEY come da specifiche
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.error("API Key di Google Gemini mancante!");
    throw new Error("API Key non trovata. Assicurati che process.env.API_KEY sia impostata.");
  }

  return new GoogleGenAI({ apiKey });
};
