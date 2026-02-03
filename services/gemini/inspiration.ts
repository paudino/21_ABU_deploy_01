
import { getClient, callGeminiWithRetry } from './client';
import { Quote } from '../../types';
import { Type } from "@google/genai";

export const generateInspirationalQuote = async (): Promise<Quote | null> => {
  return await callGeminiWithRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Genera una citazione famosa e positiva in italiano. Rispondi solo JSON.",
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            author: { type: Type.STRING }
          },
          required: ["text", "author"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};

export const generateGoodDeed = async (): Promise<string | null> => {
  return await callGeminiWithRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Suggerisci una piccola buona azione da fare oggi (max 10 parole). Solo JSON.",
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING } },
          required: ["text"]
        }
      }
    });
    const data = JSON.parse(response.text || "{}");
    return data.text || null;
  });
};
