
import { getClient } from './client';
import { Article } from '../../types';

/**
 * Cerca notizie positive usando Gemini 3 con Google Search Grounding.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  console.log(`[GEMINI-NEWS] 🔍 Avvio ricerca notizie per: "${categoryLabel}"`);
  
  const ai = getClient();
  
  const prompt = `
    Agisci come un giornalista esperto. Cerca sul web 3 notizie RECENTI e POSITIVE riguardanti: "${promptCategory}".
    Focus su: innovazioni, successi, progressi scientifici o atti di solidarietà.
    
    RESTITUISCI I DATI IN QUESTO FORMATO JSON (NON AGGIUNGERE TESTO PRIMA O DOPO):
    [
      {
        "title": "Titolo",
        "summary": "Riassunto",
        "source": "Fonte",
        "date": "YYYY-MM-DD",
        "sentimentScore": 0.9
      }
    ]
  `;

  try {
    console.log("[GEMINI-NEWS] 📡 Invio richiesta con Google Search...");
    // NOTA: Con googleSearch NON usiamo responseMimeType: "application/json" 
    // perché il modello deve poter inserire i metadati di grounding.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const responseText = response.text || "";
    console.log("[GEMINI-NEWS] 📥 Risposta ricevuta (raw):", responseText);

    // Estrazione metadati di grounding (URL reali)
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webLinks = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => chunk.web.uri);

    // Estrazione JSON dal testo (se il modello risponde con markdown o testo extra)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const rawArticles = JSON.parse(jsonStr);
      console.log(`[GEMINI-NEWS] ✅ Parsing completato.`);

      return rawArticles.map((a: any, index: number) => ({
        title: a.title || "Notizia Positiva",
        summary: a.summary || "Contenuto non disponibile",
        source: a.source || "Web",
        // Usiamo il link reale da Google Search se disponibile, altrimenti fallback
        url: webLinks[index] || `https://www.google.com/search?q=${encodeURIComponent((a.title || "") + " " + (a.source || ""))}`,
        date: a.date || new Date().toISOString().split('T')[0],
        category: categoryLabel,
        imageUrl: '',
        sentimentScore: a.sentimentScore || 0.8
      }));
    } catch (parseError) {
      console.error("[GEMINI-NEWS] ❌ Errore parsing JSON:", parseError);
      return [];
    }

  } catch (error) {
    console.error("[GEMINI-NEWS] ❌ Errore API Gemini:", error);
    return [];
  }
};
