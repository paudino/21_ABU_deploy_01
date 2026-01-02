import { getClient } from './client';
import { Article } from '../../types';

/**
 * Cerca notizie positive usando il nuovo modello gemini-3-flash-preview.
 */
export const fetchPositiveNews = async (promptCategory: string, categoryLabel: string): Promise<Article[]> => {
  const ai = getClient();
  
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
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Grounding attivo per notizie reali
      }
    });

    let text = response.text || "[]";
    
    // Pulizia markdown se presente
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
        text = text.substring(firstBracket, lastBracket + 1);
    }

    const rawArticles = JSON.parse(text);

    return rawArticles.map((a: any) => ({
      title: a.title || "Notizia Positiva",
      summary: a.summary || "Contenuto non disponibile",
      source: a.source || "Web",
      url: `https://www.google.com/search?q=${encodeURIComponent((a.title || "") + " " + (a.source || ""))}`,
      date: a.date || new Date().toISOString().split('T')[0],
      category: categoryLabel,
      imageUrl: '', 
      sentimentScore: a.sentimentScore || 0.8
    }));

  } catch (error) {
    console.error("Errore fetchPositiveNews:", error);
    return [];
  }
};
