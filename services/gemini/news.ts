
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
    // Priorità ai feed italiani nel campionamento per Gemini
    const sortedForAi = [...rawNews].sort((a, b) => {
        const isAIt = a.link.includes('.it') || a.link.includes('italiachecambia') || a.link.includes('avvenire');
        const isBIt = b.link.includes('.it') || b.link.includes('italiachecambia') || b.link.includes('avvenire');
        return isAIt === isBIt ? 0 : isAIt ? -1 : 1;
    });

    const newsListString = sortedForAi.slice(0, 10).map((n, i) => 
        `[ID:${i}] Fonte: ${n.link}\nTitolo: ${n.title}\nDescrizione: ${n.description}`
    ).join('\n---\n');

    const prompt = `
      Sei un redattore esperto del "Buon Umore". 
      Analizza queste notizie. Molte sono in Italiano, alcune in Inglese.
      
      COMPITI:
      1. Seleziona le 3 notizie più positive, costruttive o di speranza.
      2. TRADUCI OBBLIGATORIAMENTE IN ITALIANO perfetto ogni notizia selezionata (specialmente se l'originale è in inglese).
      3. Scrivi un riassunto (summary) appassionante in Italiano.
      
      NOTIZIE DA ELABORARE:
      ${newsListString}
      
      RESTITUISCI SOLO UN ARRAY JSON:
      [{"id_originale": 0, "title": "Titolo in Italiano", "summary": "Riassunto in Italiano", "source": "Nome del Sito", "sentimentScore": 0.95}]
    `;

    console.log(`%c[Source: GEMINI-AI] Elaborazione e traduzione in corso...`, "color: #8b5cf6; font-weight: bold");
    
    // Aumentato il delay di retry per dare respiro alla quota API
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }), 1, 12000); 

    const text = response.text || "[]";
    const articles = parseArticles(text, sortedForAi, categoryLabel);
    
    if (articles.length > 0) {
        return articles;
    }
    throw new Error("Dati non validi dall'IA");

  } catch (error: any) {
    console.warn(`%c[Source: Fallback] IA non disponibile. Filtro notizie italiane.`, "color: #f59e0b");
    
    // FALLBACK INTELLIGENTE: Se l'IA fallisce, prendiamo solo le prime 3 notizie 
    // che provengono da fonti italiane (per evitare l'inglese in homepage)
    const italianOnly = rawNews.filter(n => 
        n.link.includes('.it') || 
        n.link.includes('italiachecambia') || 
        n.link.includes('avvenire') ||
        n.link.includes('greenme')
    );

    const sourceNews = italianOnly.length > 0 ? italianOnly : rawNews;

    return sourceNews.slice(0, 3).map(n => ({
        title: n.title,
        summary: n.description,
        source: extractSourceName(n.link),
        url: n.link,
        date: new Date(n.pubDate).toISOString().split('T')[0],
        category: categoryLabel,
        imageUrl: '',
        sentimentScore: 0.8
    }));
  }
};

const extractSourceName = (url: string): string => {
    if (url.includes('italiachecambia')) return "Italia Che Cambia";
    if (url.includes('greenme')) return "GreenMe";
    if (url.includes('avvenire')) return "Avvenire (Buone Notizie)";
    if (url.includes('ansa.it')) return "ANSA";
    if (url.includes('hdblog')) return "HDblog";
    if (url.includes('wired.it')) return "Wired IT";
    if (url.includes('punto-informatico')) return "Punto Informatico";
    if (url.includes('lifegate')) return "LifeGate";
    return "Fonte Notizie";
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
                source: choice.source || extractSourceName(original.link),
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
