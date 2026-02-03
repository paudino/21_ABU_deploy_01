
import { GoogleGenAI } from "@google/genai";

/**
 * Client Gemini factory.
 */
export const getClient = () => {
  const key = process.env.API_KEY;
  
  if (!key || key === 'PLACEHOLDER_API_KEY') {
    console.error("[GEMINI-CLIENT] ❌ API KEY MANCANTE! Assicurati di averla impostata nelle variabili d'ambiente di Vercel.");
  } else {
    console.log("[GEMINI-CLIENT] 🔑 Client inizializzato con API Key.");
  }

  return new GoogleGenAI({ apiKey: key || '' });
};
