
import { getClient, withRetry } from './client';
import { Quote } from '../../types';
import { GenerateContentResponse } from "@google/genai";

/**
 * Recupera una citazione FAMOSA e REALE.
 */
export const generateInspirationalQuote = async (): Promise<Quote | null> => {
    try {
      const response = await withRetry<GenerateContentResponse>(() => {
        const ai = getClient();
        return ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `RECUPERA DALLA STORIA una citazione REALE, famosa e ispirante. 
            DEVE essere una citazione esistente di un autore noto (es. filosofi, scienziati, leader storici).
            NON INVENTARE IL TESTO.
            Restituisci SOLO un oggetto JSON: { "text": "testo della citazione", "author": "autore reale" }`,
        });
      });
  
      let text = response.text || "{}";
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(text);
      
      if (data && data.text && data.author) {
          return {
              id: '', 
              text: data.text,
              author: data.author
          };
      }
      return null;
    } catch (error: any) {
      console.error("Errore recupero citazione reale:", error.message);
      return null;
    }
};

/**
 * Suggerisce una sfida basata su gesti di gentilezza oggettivi e praticabili.
 */
export const generateGoodDeed = async (): Promise<string | null> => {
    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Suggerisci un piccolo "Gesto di Gentilezza" concreto e reale che una persona può fare oggi.
                Evita suggerimenti astratti. Sii pratico (es. "Scrivi a un amico che non senti da tempo").
                Restituisci SOLO un oggetto JSON: { "text": "..." }`
            });
        });

        let text = response.text || "{}";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        return data.text || null;

    } catch (error: any) {
        console.error("Errore sfida reale:", error.message);
        return null;
    }
};
