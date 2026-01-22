
import { getClient } from './client';
import { Quote } from '../../types';

export const generateInspirationalQuote = async (): Promise<Quote | null> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Genera una citazione famosa, positiva e ispirante in italiano. Formato JSON: { \"text\": \"...\", \"author\": \"...\" }",
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text || "{}");
    if (data.text && data.author) {
      return { id: '', text: data.text, author: data.author };
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
      model: "gemini-3-flash-preview",
      contents: "Suggerisci una piccola buona azione da fare oggi (max 10 parole). JSON: { \"text\": \"...\" }",
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text || "{}");
    return data.text || null;
  } catch (error) {
    console.error("Errore Deed:", error);
    return null;
  }
};
