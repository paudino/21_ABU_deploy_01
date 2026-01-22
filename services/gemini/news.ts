
import { getClient } from './client';
import { Article } from '../../types';

/**
 * Cerca notizie positive usando Gemini 3 con Google Search Grounding.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  console.log(`[GEMINI-NEWS] 🔍 Avvio ricerca notizie per: "${categoryLabel}" (Prompt: ${promptCategory})`);
  
  const ai = getClient();
  
  const prompt = `
    Agisci come un giornalista specializzato in "Solutions Journalism". 
    Cerca sul web 3 notizie RECENTI (ultima settimana) e POSITIVE riguardanti: "${promptCategory}".
    Focus su: successi, innovazioni, atti di gentilezza o progressi scientifici.
    
    Requisiti:
    1. Sentiment decisamente positivo (> 0.7).
    2. Formatta ESCLUSIVAMENTE come array JSON valido. Non aggiungere commenti o testo extra.
    
    Esempio struttura:
    [
      {
        "title": "Titolo Notizia",
        "summary": "Riassunto breve",
        "source": "Fonte Ufficiale",
        "date": "2024-05-20",
        "sentimentScore": 0.95
      }
    ]
  `;

  try {
    console.log("[GEMINI-NEWS] 📡 Invio richiesta a gemini-3-flash-preview con Google Search...");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text;
    console.log("[GEMINI-NEWS] 📥 Risposta ricevuta (raw):", responseText);

    if (!responseText || responseText.trim() === "") {
      console.warn("[GEMINI-NEWS] ⚠️ Risposta AI vuota.");
      return [];
    }

    try {
      const rawArticles = JSON.parse(responseText);
      console.log(`[GEMINI-NEWS] ✅ Parsing completato. Trovati ${rawArticles.length} articoli.`);

      return rawArticles.map((a: any) => ({
        title: a.title || "Notizia Positiva",
        summary: a.summary || "Contenuto non disponibile",
        source: a.source || "Web",
        url: `https://www.google.com/search?q=${encodeURIComponent((a.title || "") + " news " + (a.source || ""))}`,
        date: a.date || new Date().toISOString().split('T')[0],
        category: categoryLabel,
        imageUrl: '',
        sentimentScore: a.sentimentScore || 0.8
      }));
    } catch (parseError) {
      console.error("[GEMINI-NEWS] ❌ Errore nel parsing JSON della risposta AI:", parseError);
      console.log("[GEMINI-NEWS] Testo che ha causato l'errore:", responseText);
      return [];
    }

  } catch (error) {
    console.error("[GEMINI-NEWS] ❌ Errore fatale fetchPositiveNews:", error);
    return [];
  }
};
