
import { getClient, withRetry } from './client';
import { Article } from '../../types';
import { fetchRawNewsFromRSS, RawNewsItem } from '../newsFetcher';
import { GenerateContentResponse } from "@google/genai";

/**
 * Funzione di utilità per il parsing degli articoli selezionati e rielaborati da Gemini.
 */
const parseArticles = (text: string, rawNews: RawNewsItem[], categoryLabel: string): Article[] => {
    try {
        // Pulisce il testo da eventuali decorazioni markdown di Gemini
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiSelections = JSON.parse(cleanJson);
        
        if (!Array.isArray(aiSelections)) return [];

        return aiSelections.map(ai => {
            const original = rawNews[ai.id_originale];
            if (!original) return null;

            let dateStr = "";
            try {
                dateStr = new Date(original.pubDate).toISOString().split('T')[0];
            } catch (e) {
                dateStr = new Date().toISOString().split('T')[0];
            }

            // Costruisce l'oggetto articolo completo basandosi sulla selezione dell'AI e i dati originali
            return {
                title: ai.title,
                summary: ai.summary,
                source: ai.source || "Fonte",
                url: original.link,
                date: dateStr,
                category: categoryLabel,
                sentimentScore: ai.sentimentScore || 0.9,
                isNew: true
            } as Article;
        }).filter((a): a is Article => a !== null);
    } catch (e) {
        console.error("[Gemini-News] Errore nel parsing del JSON di Gemini:", e);
        return [];
    }
};

export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  const rawNews = await fetchRawNewsFromRSS(categoryLabel);
  
  if (!rawNews || rawNews.length === 0) return [];

  try {
    const ai = getClient();
    const newsListString = rawNews.slice(0, 10).map((n, i) => 
        `[ID:${i}] Titolo: ${n.title}\nDescrizione: ${n.description}`
    ).join('\n---\n');

    const prompt = `
      Agisci come un Caporedattore esperto di giornalismo costruttivo. 
      Analizza le seguenti notizie italiane e seleziona le 4 che mostrano progresso umano, atti di gentilezza, innovazioni sostenibili o soluzioni a problemi complessi.
      
      REGOLE MANDATORIE:
      1. Linguaggio Italiano fluido, positivo ed emozionante.
      2. Scrivi un nuovo titolo che catturi l'essenza positiva.
      3. Riassunto di circa 40 parole che metta in luce perché la notizia è una "buona notizia".
      4. Restituisci SOLO un array JSON valido.
      
      STRUTTURA JSON:
      [{"id_originale": 0, "title": "...", "summary": "...", "source": "...", "sentimentScore": 0.95}]
      
      NOTIZIE DA ANALIZZARE:
      ${newsListString}
    `;

    console.log(`[DIAGNOSTIC-GEMINI] Passo ${rawNews.length} notizie grezze a Gemini per l'analisi.`);

    // Esegue la richiesta a Gemini con logica di retry
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    })); 

    const textResponse = response.text;
    if (!textResponse) throw new Error("Risposta AI vuota");

    const articles = parseArticles(textResponse, rawNews, categoryLabel);
    if (articles.length === 0) throw new Error("Parsing JSON fallito");

    return articles;

  } catch (error: any) {
    console.error(`[DIAGNOSTIC-GEMINI] ERRORE durante la chiamata AI: ${error.message}`);
    console.warn("[DIAGNOSTIC-GEMINI] Utilizzo fallback: converto notizie grezze (già in italiano) in articoli standard.");
    
    // Fallback sicuro che restituisce articoli conformi all'interfaccia Article
    return rawNews.slice(0, 4).map(n => {
        let dateStr = "";
        try {
            dateStr = new Date(n.pubDate).toISOString().split('T')[0];
        } catch (e) {
            dateStr = new Date().toISOString().split('T')[0];
        }
        return {
            title: n.title,
            summary: n.description,
            source: "Aggregatore News Italia",
            url: n.link,
            date: dateStr,
            category: categoryLabel,
            sentimentScore: 0.85,
            isNew: true
        };
    });
  }
};
