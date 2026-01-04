
import { getClient, withRetry } from './client';
import { Article } from '../../types';
import { fetchRawNewsFromRSS, RawNewsItem } from '../newsFetcher';

/**
 * Recupera notizie POSITIVE e REALI.
 * Se l'AI è in "429", restituisce i dati grezzi RSS come fallback silenzioso.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  console.log(`%c[SOURCE: WEB-RSS] Inizio recupero per "${categoryLabel}"...`, "color: #3b82f6; font-weight: bold; font-size: 12px;");
  
  const rawNews = await fetchRawNewsFromRSS(categoryLabel);
  
  if (rawNews.length === 0) {
    console.error(`%c[SOURCE: WEB-RSS] ERRORE: Nessun dato grezzo disponibile.`, "color: #ef4444; font-weight: bold");
    return [];
  }

  const ai = getClient();
  const newsListString = rawNews.slice(0, 8).map((n, i) => `[ID:${i}] Title: ${n.title}\nDesc: ${n.description}`).join('\n---\n');

  const prompt = `
    Analizza queste notizie reali e scegli le 3 più positive e ispiranti.
    Traducile in ITALIANO.
    
    NOTIZIE:
    ${newsListString}
    
    RESTITUISCI SOLO JSON:
    [{"id_originale": 0, "title": "...", "summary": "...", "source": "...", "sentimentScore": 0.9}]
  `;

  try {
    console.log(`%c[SOURCE: GEMINI-AI] Invio ${rawNews.length} notizie a Gemini per elaborazione...`, "color: #8b5cf6; font-weight: bold; font-size: 12px;");
    
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }), 1, 15000); 

    const text = response.text || "[]";
    const articles = parseArticles(text, rawNews, categoryLabel);
    
    console.log(`%c[SOURCE: GEMINI-AI] Elaborazione AI completata con successo.`, "color: #10b981; font-weight: bold");
    return articles;

  } catch (error: any) {
    console.warn(`%c[SOURCE: FALLBACK-RSS] L'AI non ha risposto (Quota o Errore). Mostro dati RSS grezzi.`, "color: #f59e0b; font-weight: bold");
    
    // FALLBACK: Restituiamo le notizie originali (titoli in inglese ma funzionanti)
    return rawNews.slice(0, 4).map(n => ({
        title: n.title,
        summary: n.description,
        source: "Global RSS Feed (Original)",
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
        console.error("[Parser] Errore parsing JSON da Gemini:", e);
        return [];
    }
};
