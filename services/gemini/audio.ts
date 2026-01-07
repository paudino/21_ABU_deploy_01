
import { getClient, withRetry } from './client';
import { Modality, GenerateContentResponse } from "@google/genai";

export const generateAudio = async (text: string): Promise<string | null> => {
    // Rimuoviamo caratteri speciali che potrebbero confondere il TTS
    let safeText = text.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim();
    if (safeText.length < 5) return null;

    const ai = getClient();

    try {
        // Fix: Add explicit type generic to withRetry to ensure the response is correctly typed as GenerateContentResponse
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            // Utilizzo del formato array per contents come da documentazione
            contents: [{ parts: [{ text: safeText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { 
                        prebuiltVoiceConfig: { voiceName: 'Kore' } 
                    }
                }
            }
        }));

        // Estrazione dei dati audio in base64
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (error) {
        console.error("Errore generazione Audio Gemini:", error);
        return null;
    }
};
