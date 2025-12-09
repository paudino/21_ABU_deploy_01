
import { getClient } from './client';
import { Quote } from '../../types';

export const generateInspirationalQuote = async (): Promise<Quote | null> => {
    const ai = getClient();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Genera una citazione famosa, positiva e ispirante.
        Restituisci SOLO un oggetto JSON in questo formato: { "text": "testo della citazione", "author": "autore" }`,
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
    } catch (error) {
      console.error("Errore Quote:", error);
      return null;
    }
};

export const generateGoodDeed = async (): Promise<string | null> => {
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Suggerisci una piccola "Buona Azione" o gesto di gentilezza che una persona può fare oggi stesso (max 10 parole).
            Restituisci SOLO un oggetto JSON: { "text": "..." }`
        });

        let text = response.text || "{}";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        return data.text || null;

    } catch (error) {
        console.error("Errore Deed:", error);
        return null;
    }
};
