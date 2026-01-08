
import { getClient, withRetry } from './client';
import { Modality, GenerateContentResponse } from "@google/genai";

export const generateAudio = async (text: string): Promise<string | null> => {
    // Pulizia profonda del testo per evitare che caratteri speciali causino errori nel TTS
    let safeText = text
        .replace(/[*_`#]/g, '')
        .replace(/https?:\/\/\S+/g, '') // Rimuove URL
        .replace(/\s+/g, ' ')
        .trim();
        
    if (safeText.length < 5) return null;

    try {
        const response = await withRetry<GenerateContentResponse>(() => {
            const ai = getClient();
            return ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: `Pronuncia con tono sereno, calmo e rassicurante in italiano: ${safeText}`,
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { 
                            prebuiltVoiceConfig: { voiceName: 'Kore' } 
                        }
                    }
                }
            });
        });

        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (error: any) {
        console.error("Errore generazione Audio Gemini:", error.message);
        return null;
    }
};
