
import { getClient, callGeminiWithRetry } from './client';
import { Article } from '../../types';

export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  console.log(`[GEMINI-NEWS] 📡 Avvio ricerca per: ${categoryLabel}`);

  // 1. TENTA CON SEARCH
  let articles = await callGeminiWithRetry(async () => {
    const ai = getClient();
    const prompt = `Cerca 3 notizie RECENTI e POSITIVE su: "${promptCategory}". Restituisci ESCLUSIVAMENTE un array JSON con: title, summary, source, date (YYYY-MM-DD), sentimentScore.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return parseNewsResponse(response, categoryLabel);
  }, 0); // 0 retry per passare subito al fallback se c'è 429

  if (articles && articles.length > 0) return articles;

  // 2. FALLBACK SENZA SEARCH (Molto più probabile che funzioni se Search è limitato)
  console.log(`[GEMINI-NEWS] 🔄 Fallback: Generazione senza Search...`);
  articles = await callGeminiWithRetry(async () => {
    const ai = getClient();
    const prompt = `Genera 3 notizie POSITIVE e REALI dell'ultima settimana su: "${promptCategory}". Usa la tua conoscenza aggiornata. Restituisci JSON array: title, summary, source, date, sentimentScore.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return parseNewsResponse(response, categoryLabel);
  }, 1);

  return articles || [];
};

const parseNewsResponse = (response: any, categoryLabel: string): Article[] => {
  try {
    const text = response.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webLinks = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => chunk.web.uri);

    const rawArticles = JSON.parse(jsonMatch[0]);
    return rawArticles.map((a: any, idx: number) => ({
      ...a,
      url: webLinks[idx] || `https://www.google.com/search?q=${encodeURIComponent(a.title)}`,
      category: categoryLabel,
      imageUrl: ''
    }));
  } catch (e) {
    return [];
  }
};
