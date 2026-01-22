
import { GoogleGenAI } from "@google/genai";

/**
 * Singleton per il client Gemini.
 * Utilizza esclusivamente process.env.API_KEY.
 */
let aiInstance: GoogleGenAI | null = null;

export const getClient = () => {
  if (!aiInstance) {
    console.log("[GEMINI-CLIENT] Inizializzazione client...");
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      console.error("[GEMINI-CLIENT] ❌ API_KEY mancante o non valida nel file .env!");
      throw new Error("Missing GEMINI_API_KEY environment variable.");
    }
    
    console.log("[GEMINI-CLIENT] ✅ API_KEY trovata. Creazione istanza GoogleGenAI.");
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};
