
import { getClient } from './client';
import { Article } from '../../types';

/**
 * Cerca notizie positive usando Gemini API direttamente dal browser.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  const ai = getClient();
  
  // Prompt ingegnerizzato per ottenere JSON pulito e notizie positive
  const prompt = `
    Task: Agisci come un giornalista ottimista. Cerca sul web 3 notizie RECENTI (ultima settimana) e POSITIVE riguardanti: "${promptCategory}".
    
    Requisiti:
    1. Le notizie devono essere vere e verificabili.
    2. Il sentiment deve essere decisamente positivo (> 0.7).
    3. Ignora notizie tristi, polemiche o di cronaca nera.
    4. Formatta ESCLUSIVAMENTE come array JSON.
    
    Struttura JSON richiesta:
    [
      {
        "title": "Titolo accattivante in Italiano",
        "summary": "Riassunto breve ed ispirante in Italiano (max 20 parole)",
        "source": "Nome Fonte",
        "date": "YYYY-MM-DD",
        "sentimentScore": 0.9
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Abilita Grounding con Google Search
      }
    });

    let text = response.text || "[]";
    
    // Pulizia del testo per estrarre solo il JSON (rimuove markdown ```json ... ```)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Tentativo di parsing
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
        text = text.substring(firstBracket, lastBracket + 1);
    }

    const rawArticles = JSON.parse(text);

    // Mappatura e validazione dati
    const validatedArticles: Article[] = rawArticles.map((a: any) => ({
      title: a.title || "Notizia Positiva",
      summary: a.summary || "Contenuto non disponibile",
      source: a.source || "Web",
      // Generiamo un URL di ricerca Google se l'URL originale non è fornito dal grounding in modo pulito nel JSON
      url: `https://www.google.com/search?q=${encodeURIComponent((a.title || "") + " notizia")}`,
      date: a.date || new Date().toISOString().split('T')[0],
      category: categoryLabel,
      imageUrl: '', // Verrà generata in un secondo momento
      sentimentScore: a.sentimentScore || 0.8
    }));

    // Se il grounding ha fornito metadati reali (link alle fonti), proviamo ad usarli
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
       // Logica opzionale: si potrebbe arricchire l'URL con i link reali trovati
       // Ma per ora manteniamo la ricerca Google per stabilità dell'UI
    }

    return validatedArticles;

  } catch (error) {
    console.error("Errore fetchPositiveNews:", error);
    return [];
  }
};
