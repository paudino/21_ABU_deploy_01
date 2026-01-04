
import { getClient, withRetry } from './client';
import { Article } from '../../types';
import { fetchRawNewsFromRSS, RawNewsItem } from '../newsFetcher';

/**
 * Recupera notizie POSITIVE e REALI.
 * FLUSSO: RSS Feed (Dati Reali) -> Gemini (Analisi e Traduzione) -> UI.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  // 1. Recuperiamo dati reali dalla fonte RSS (nessun limite di quota qui)
  const rawNews = await fetchRawNewsFromRSS(categoryLabel);
  
  if (rawNews.length === 0) {
    console.warn("[News] Nessuna notizia trovata nei feed RSS.");
    return [];
  }

  const ai = getClient();
  
  // Prepariamo la lista di notizie per Gemini
  const newsListString = rawNews.map((n, i) => `[ID:${i}] Titolo: ${n.title}\nDesc: ${n.description}`).join('\n---\n');

  // 2. Chiediamo a Gemini di scegliere le 3 migliori, tradurle in italiano e validarle
  const prompt = `
    Sei un redattore esperto. Ti fornisco una lista di notizie REALI tratte da testate internazionali.
    
    LISTA NOTIZIE:
    ${newsListString}
    
    TASK:
    1. Scegli le 3 notizie PIÙ POSITIVE, ISPRANTI e SIGNIFICATIVE.
    2. Traducile fedelmente in ITALIANO.
    3. Per ogni notizia scelta, genera un punteggio di sentiment (0.7 a 1.0).
    4. Usa il link originale corrispondente all'ID.
    
    RESTITUISCI ESCLUSIVAMENTE UN ARRAY JSON:
    [{"id_originale": 0, "title": "Titolo in italiano", "summary": "Riassunto in italiano", "source": "Nome testata", "sentimentScore": 0.9}]
  `;

  try {
    console.log(`[News] Analisi AI su notizie REALI per: ${categoryLabel}...`);
    
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }));

    const text = response.text || "[]";
    return parseArticles(text, rawNews, categoryLabel);

  } catch (error: any) {
    console.error("[News] Errore analisi AI:", error);
    // Se fallisce l'AI, restituiamo una versione base delle notizie RSS (senza analisi)
    return rawNews.slice(0, 3).map(n => ({
        title: n.title,
        summary: n.description,
        source: "RSS News",
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
                source: choice.source || "Fonte Verificata",
                url: original.link,
                date: new Date(original.pubDate).toISOString().split('T')[0],
                category: categoryLabel,
                imageUrl: '', 
                sentimentScore: choice.sentimentScore || 0.85
            };
        });
    } catch (e) {
        console.error("[News] Errore parsing JSON:", e);
        return [];
    }
};
