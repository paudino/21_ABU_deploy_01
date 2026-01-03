
import { getClient, withRetry } from './client';
import { Article } from '../../types';

/**
 * Recupera notizie POSITIVE e REALI tramite Google Search.
 * Non esegue fallback creativi per garantire l'integrità dell'informazione.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  const ai = getClient();
  
  // Prompt rigoroso: solo fatti reali, fonti verificabili.
  const prompt = `
    AGISCI COME UN GIORNALISTA INVESTIGATIVO DI NOTIZIE POSITIVE.
    CERCA SUL WEB 3 notizie REALI, RECENTI e VERIFICABILI riguardanti: "${promptCategory}".
    REQUISITI:
    1. Devono essere accadute negli ultimi 30 giorni.
    2. Il contenuto deve essere oggettivamente positivo (scoperte, aiuti, progressi).
    3. NON INVENTARE NULLA. Se non trovi notizie recenti per questa categoria, restituisci un array vuoto [].
    
    FORMATO JSON: [{"title": "...", "summary": "...", "source": "...", "date": "YYYY-MM-DD", "sentimentScore": 0.9}]
  `;

  try {
    console.log(`[News] Ricerca notizie REALI per: ${categoryLabel}...`);
    
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    }));

    return parseArticles(response.text, categoryLabel);

  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.status === 429;
    
    if (isQuotaError) {
      console.error("[News] Limite Google Search raggiunto. Impossibile cercare nuove notizie reali al momento.");
      // Lanciamo l'errore per permettere all'hook useNewsApp di mostrare la notifica corretta
      throw new Error("QUOTA_EXHAUSTED");
    }
    
    console.error("[News] Errore durante la ricerca:", error);
    return [];
  }
};

const parseArticles = (text: string | undefined, categoryLabel: string): Article[] => {
    let cleanText = text || "[]";
    cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
    }

    try {
        const rawArticles = JSON.parse(cleanText);
        if (!Array.isArray(rawArticles)) return [];

        return rawArticles.map((a: any) => ({
          title: a.title || "Notizia Positiva",
          summary: a.summary || "Dettagli non disponibili.",
          source: a.source || "Fonte Web",
          url: `https://www.google.com/search?q=${encodeURIComponent((a.title || "") + " " + (a.source || ""))}`,
          date: a.date || new Date().toISOString().split('T')[0],
          category: categoryLabel,
          imageUrl: '', 
          sentimentScore: a.sentimentScore || 0.85
        }));
    } catch (e) {
        console.error("[News] Errore parsing JSON news:", e);
        return [];
    }
};
