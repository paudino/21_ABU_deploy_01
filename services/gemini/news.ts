
import { getClient, withRetry } from './client';
import { Article } from '../../types';
import { fetchRawNewsFromRSS, RawNewsItem } from '../newsFetcher';

/**
 * Recupera notizie POSITIVE e REALI.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  console.log(`%c[Source: WEB-RSS] Ricerca feed per "${categoryLabel}"...`, "color: #3b82f6; font-weight: bold");
  
  const rawNews = await fetchRawNewsFromRSS(categoryLabel);
  
  if (!rawNews || rawNews.length === 0) {
    return [];
  }

  try {
    const ai = getClient();
    const shuffled = [...rawNews].sort(() => 0.5 - Math.random());
    const newsListString = shuffled.slice(0, 10).map((n, i) => 
        `[ID:${i}] Fonte: ${n.link.includes('.it') ? 'Italiana' : 'Internazionale'}\nTitolo: ${n.title}\nDescrizione: ${n.description}`
    ).join('\n---\n');

    const prompt = `
      Sei un redattore esperto del "Buon Umore". 
      Analizza queste notizie (alcune sono in Italiano, altre in Inglese).
      
      COMPITI:
      1. Seleziona le 3 notizie più positive, costruttive o di speranza.
      2. TRADUCI OBBLIGATORIAMENTE IN ITALIANO perfetto ed elegante ogni notizia selezionata.
      3. Scrivi un riassunto (summary) di almeno 3-4 frasi che spieghi perché la notizia è bella.
      
      NOTIZIE DA ELABORARE:
      ${newsListString}
      
      RESTITUISCI SOLO UN ARRAY JSON:
      [{"id_originale": 0, "title": "Titolo in Italiano", "summary": "Riassunto positivo in Italiano", "source": "Nome della testata", "sentimentScore": 0.95}]
    `;

    console.log(`%c[Source: GEMINI-AI] Elaborazione e traduzione in corso...`, "color: #8b5cf6; font-weight: bold");
    
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }), 1, 10000); 

    const text = response.text || "[]";
    const articles = parseArticles(text, shuffled, categoryLabel);
    
    if (articles.length > 0) {
        return articles;
    }
    throw new Error("Dati non validi dall'IA");

  } catch (error: any) {
    console.warn(`%c[Source: Fallback] IA occupata. Mostro notizie originali.`, "color: #f59e0b");
    
    // Fallback: se l'IA fallisce, almeno ora molti feed saranno già in italiano grazie a newsFetcher.ts
    return rawNews.slice(0, 3).map(n => ({
        title: n.title,
        summary: n.description,
        source: n.link.includes('italiachecambia') ? "Italia Che Cambia" : n.link.includes('greenme') ? "GreenMe" : "Fonte News",
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
                source: choice.source || (original.link.includes('.it') ? "Fonte Italiana" : "Fonte Estera"),
                url: original.link,
                date: new Date(original.pubDate).toISOString().split('T')[0],
                category: categoryLabel,
                imageUrl: '', 
                sentimentScore: choice.sentimentScore || 0.88
            };
        });
    } catch (e) {
        return [];
    }
};
