
import { getClient } from './client';
import { Quote } from '../../types';
import { Type } from "@google/genai";

export const generateInspirationalQuote = async (): Promise<Quote | null> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Genera una citazione famosa, positiva e ispirante in italiano.",
      config: { 
        responseMimeType: "application/json",
        // Definizione dello schema di risposta per garantire un output JSON valido e strutturato
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: 'Il corpo del testo della citazione.',
            },
            author: {
              type: Type.STRING,
              description: 'L\'autore originale della citazione.',
            },
          },
          required: ["text", "author"],
          propertyOrdering: ["text", "author"],
        }
      }
    });

    // Estrazione del testo dalla risposta della generazione
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
      contents: "Suggerisci una piccola buona azione da fare oggi (max 10 parole).",
      config: { 
        responseMimeType: "application/json",
        // Definizione dello schema di risposta per garantire un output JSON valido e strutturato
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: 'La descrizione della buona azione suggerita.',
            },
          },
          required: ["text"],
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data.text || null;
  } catch (error) {
    console.error("Errore Deed:", error);
    return null;
  }
};
