
import { getClient, callGeminiWithRetry, isQuotaExhausted } from './client';
import { Article } from '../../types';

export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  if (isQuotaExhausted()) return [];

  // 1. Tentativo con Google Search (Più preciso ma quota limitata)
  const articles = await callGeminiWithRetry(async () => {
    console.log(`[GEMINI-NEWS] 📡 Tentativo con Google Search: ${categoryLabel}`);
    const ai = getClient();
    
    const prompt = `Cerca 3 notizie RECENTI e POSITIVE su: "${promptCategory}". Restituisci ESCLUSIVAMENTE un array JSON con: title, summary, source, date (YYYY-MM-DD), sentimentScore.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return parseNewsResponse(response, categoryLabel);
  });

  if (articles && articles.length > 0) return articles;

  // 2. Fallback senza Google Search (Usa conoscenza interna, quota più ampia)
  console.log(`[GEMINI-NEWS] 🔄 Fallback: Generazione senza Search per ${categoryLabel}`);
  return await callGeminiWithRetry(async () => {
    const ai = getClient();
    const prompt = `Genera 3 notizie POSITIVE basate su fatti reali recenti (Conoscenza AI) su: "${promptCategory}". Restituisci JSON array: title, summary, source, date, sentimentScore.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });

    return parseNewsResponse(response, categoryLabel);
  }) || [];
};

const parseNewsResponse = (response: any, categoryLabel: string): Article[] => {
  const text = response.text || "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
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
