
import { getClient, withRetry } from './client';
import { Article } from '../../types';
import { fetchRawNewsFromRSS, RawNewsItem } from '../newsFetcher';

/**
 * Recupera notizie POSITIVE e REALI.
 * Se l'AI fallisce, restituisce i dati grezzi RSS come fallback.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  console.log(`%c[SOURCE: WEB-RSS] Inizio recupero per "${categoryLabel}"...`, "color: #3b82f6; font-weight: bold");
  
  const rawNews = await fetchRawNewsFromRSS(categoryLabel);
  
  if (!rawNews || rawNews.length === 0) {
    console.error(`%c[SOURCE: WEB-RSS] ERRORE: Nessun dato disponibile dai feed.`, "color: #ef4444");
    return [];
  }

  try {
    const ai = getClient();
    // Prendiamo un subset casuale per variare i risultati se il feed non è cambiato
    const shuffled = [...rawNews].sort(() => 0.5 - Math.random());
    const newsListString = shuffled.slice(0, 10).map((n, i) => 
        `[ID:${i}] Title: ${n.title || 'Senza Titolo'}\nDesc: ${n.description || 'Nessuna descrizione'}`
    ).join('\n---\n');

    const prompt = `
      Analizza queste notizie reali e seleziona le 3 più positive, curiose o ispiranti.
      Sii vario nelle scelte: non scegliere sempre le prime.
      Traducile in ITALIANO in modo elegante e giornalistico.
      
      NOTIZIE DA ANALIZZARE:
      ${newsListString}
      
      RESTITUISCI SOLO UN ARRAY JSON VALIDO:
      [{"id_originale": 0, "title": "Titolo in Italiano", "summary": "Riassunto positivo in Italiano", "source": "Nome Fonte", "sentimentScore": 0.95}]
    `;

    console.log(`%c[SOURCE: GEMINI-AI] Elaborazione notizie con AI...`, "color: #8b5cf6; font-weight: bold");
    
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }), 1, 10000); 

    const text = response.text || "[]";
    const articles = parseArticles(text, shuffled, categoryLabel);
    
    if (articles.length > 0) {
        console.log(`%c[SOURCE: GEMINI-AI] Elaborazione completata: ${articles.length} articoli pronti.`, "color: #10b981; font-weight: bold");
        return articles;
    } else {
        throw new Error("Gemini ha restituito un array vuoto o malformato");
    }

  } catch (error: any) {
    console.warn(`%c[SOURCE: FALLBACK] Errore AI: ${error.message}. Utilizzo dati originali.`, "color: #f59e0b");
    
    return rawNews.slice(0, 3).map(n => ({
        title: n.title,
        summary: n.description,
        source: "Fonte Originale",
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
                source: choice.source || "Fonte",
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
