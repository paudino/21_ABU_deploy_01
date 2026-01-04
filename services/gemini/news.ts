
import { getClient, withRetry } from './client';
import { Article } from '../../types';
import { fetchRawNewsFromRSS, RawNewsItem } from '../newsFetcher';

export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  const rawNews = await fetchRawNewsFromRSS(categoryLabel);
  
  if (!rawNews || rawNews.length === 0) {
    console.warn(`[News-Fetch] Nessuna notizia grezza trovata per ${categoryLabel}`);
    return [];
  }

  try {
    const ai = getClient();
    const newsListString = rawNews.slice(0, 8).map((n, i) => 
        `[ID:${i}] Titolo: ${n.title}\nDescrizione: ${n.description}`
    ).join('\n---\n');

    const prompt = `
      Sei un redattore esperto del "Buon Umore". Analizza queste notizie e seleziona le 4 più positive, incoraggianti o basate su soluzioni costruttive.
      
      REGOLE:
      - Traduci TUTTO in Italiano perfetto.
      - Scrivi un titolo accattivante e un riassunto (summary) emozionante per ogni notizia.
      - Restituisci RIGOROSAMENTE solo un array JSON con questa struttura:
      [{"id_originale": numero_id, "title": "...", "summary": "...", "source": "Nome Fonte", "sentimentScore": 0.9}]
      
      NOTIZIE:
      ${newsListString}
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    })); 

    const textResponse = response.text || "[]";
    const articles = parseArticles(textResponse, rawNews, categoryLabel);
    
    if (articles.length > 0) return articles;
    throw new Error("Parsing fallito o array vuoto");

  } catch (error: any) {
    console.error("[Gemini-News-Error]", error.message || error);
    // Fallback: mostra le notizie originali se Gemini fallisce
    return rawNews.slice(0, 4).map(n => ({
        title: n.title,
        summary: n.description,
        source: "Fonte News",
        url: n.link,
        date: new Date(n.pubDate).toISOString().split('T')[0],
        category: categoryLabel,
        sentimentScore: 0.85
    }));
  }
};

const parseArticles = (text: string, rawNews: RawNewsItem[], categoryLabel: string): Article[] => {
    try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiChoices = JSON.parse(cleanText);
        return aiChoices.map((choice: any) => {
            const original = rawNews[choice.id_originale] || rawNews[0];
            return {
                title: choice.title || original.title,
                summary: choice.summary || original.description,
                source: choice.source || "Web",
                url: original.link,
                date: new Date(original.pubDate).toISOString().split('T')[0],
                category: categoryLabel,
                sentimentScore: choice.sentimentScore || 0.9
            };
        });
    } catch {
        return [];
    }
};
