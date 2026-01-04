
import { getClient, withRetry } from './client';
import { Article } from '../../types';
import { fetchRawNewsFromRSS, RawNewsItem } from '../newsFetcher';

/**
 * Recupera notizie POSITIVE e REALI.
 * Implementa una logica a 2 livelli: 
 * 1. Recupero RSS (Dati Grezzi)
 * 2. Elaborazione AI (Traduzione e Sentiment)
 * 3. Fallback a RSS Originale in caso di errore AI.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  console.log(`%c[Source: WEB-RSS] Recupero feed per "${categoryLabel}"...`, "color: #3b82f6; font-weight: bold");
  
  const rawNews = await fetchRawNewsFromRSS(categoryLabel);
  
  if (!rawNews || rawNews.length === 0) {
    console.error(`%c[Source: WEB-RSS] Nessuna notizia trovata nei feed per: ${categoryLabel}`, "color: #ef4444");
    return [];
  }

  try {
    const ai = getClient();
    // Mescoliamo per non avere sempre gli stessi risultati in cima
    const shuffled = [...rawNews].sort(() => 0.5 - Math.random());
    const newsListString = shuffled.slice(0, 8).map((n, i) => 
        `[ID:${i}] Title: ${n.title}\nDesc: ${n.description}`
    ).join('\n---\n');

    const prompt = `
      Analizza queste notizie e seleziona le 3 più positive e ispiranti.
      Traducile fedelmente in ITALIANO.
      
      NOTIZIE:
      ${newsListString}
      
      RESTITUISCI SOLO JSON:
      [{"id_originale": 0, "title": "...", "summary": "...", "source": "...", "sentimentScore": 0.9}]
    `;

    console.log(`%c[Source: GEMINI-AI] Invio a elaborazione AI...`, "color: #8b5cf6; font-weight: bold");
    
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }), 1, 8000); 

    const text = response.text || "[]";
    const articles = parseArticles(text, shuffled, categoryLabel);
    
    if (articles.length > 0) {
        console.log(`%c[Source: GEMINI-AI] Successo.`, "color: #10b981; font-weight: bold");
        return articles;
    }
    throw new Error("Risposta AI vuota");

  } catch (error: any) {
    console.warn(`%c[Source: RSS-Fallback] AI non disponibile (${error.message}). Carico dati originali.`, "color: #f59e0b; font-weight: bold");
    
    // FALLBACK: Restituiamo le notizie originali (titoli in inglese ma notizie REALI e NUOVE)
    // Questo previene che l'hook ricarichi la vecchia cache dal DB.
    return rawNews.slice(0, 4).map(n => ({
        title: n.title,
        summary: n.description,
        source: "Global Good News Feed",
        url: n.link,
        date: new Date(n.pubDate).toISOString().split('T')[0],
        category: categoryLabel,
        imageUrl: '',
        sentimentScore: 0.8
    }));
  }
};

const parseArticles = (text: string, rawNews: RawNewsItem[], categoryLabel: string): Article[] => {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        const aiChoices = JSON.parse(cleanText);
        if (!Array.isArray(aiChoices)) return [];
        return aiChoices.map((choice: any) => {
            const original = rawNews[choice.id_originale] || rawNews[0];
            return {
                title: choice.title || original.title,
                summary: choice.summary || original.description,
                source: choice.source || "Fonte News",
                url: original.link,
                date: new Date(original.pubDate).toISOString().split('T')[0],
                category: categoryLabel,
                imageUrl: '', 
                sentimentScore: choice.sentimentScore || 0.85
            };
        });
    } catch (e) {
        console.error("[Parser] Errore JSON Gemini:", e);
        return [];
    }
};
