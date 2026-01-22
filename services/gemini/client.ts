
import { GoogleGenAI } from "@google/genai";

/**
 * Singleton per il client Gemini.
 */
let aiInstance: GoogleGenAI | null = null;

export const getClient = () => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY' || apiKey === '') {
      console.error("[GEMINI-CLIENT] ❌ ERRORE: API_KEY non configurata! Verifica le variabili d'ambiente.");
      throw new Error("Missing GEMINI_API_KEY environment variable. Add it to your .env or Vercel Settings.");
    }
    
    console.log("[GEMINI-CLIENT] ✅ Client inizializzato con successo.");
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};
