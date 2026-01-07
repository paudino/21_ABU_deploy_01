
import { getClient, withRetry } from './client';
import { Article } from '../../types';
import { fetchRawNewsFromRSS, RawNewsItem } from '../newsFetcher';
import { GenerateContentResponse } from "@google/genai";

export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  console.log(`[DIAGNOSTIC-GEMINI] Avvio fetchPositiveNews per ${categoryLabel}`);
  
  const rawNews = await fetchRawNewsFromRSS(categoryLabel);
  
  if (!rawNews || rawNews.length === 0) {
    console.warn(`[DIAGNOSTIC-GEMINI] Nessuna notizia grezza da elaborare per ${categoryLabel}`);
    return [];
  }

  console.log(`[DIAGNOSTIC-GEMINI] Passo ${rawNews.length} notizie grezze a Gemini per l'analisi.`);

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

    console.time(`gemini-request-${categoryLabel}`);
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    })); 
    console.timeEnd(`gemini-request-${categoryLabel}`);

    const textResponse = response.text;
    if (!textResponse) {
        console.error("[DIAGNOSTIC-GEMINI] Risposta Gemini vuota o indefinita.");
        throw new Error("Risposta AI non valida");
    }

    console.log(`[DIAGNOSTIC-GEMINI] Risposta AI ricevuta. Lunghezza: ${textResponse.length} caratteri.`);

    const articles = parseArticles(textResponse, rawNews, categoryLabel);
    console.log(`[DIAGNOSTIC-GEMINI] Parsing completato. Articoli generati: ${articles.length}`);
    
    if (articles.length > 0) return articles;
    throw new Error("Parsing fallito o array vuoto");

  } catch (error: any) {
    console.error("[DIAGNOSTIC-GEMINI] ERRORE durante la chiamata AI:", error.message || error);
    
    // Fallback: mostra le notizie originali se Gemini fallisce
    console.warn("[DIAGNOSTIC-GEMINI] Utilizzo fallback: converto notizie grezze in articoli standard.");
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
    } catch (e: any) {
        console.error("[DIAGNOSTIC-GEMINI] Errore nel parseArticles JSON:", e.message);
        return [];
    }
};
