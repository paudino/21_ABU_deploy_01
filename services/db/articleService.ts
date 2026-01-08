
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

// Funzione di utilità per evitare che le chiamate al DB rimangano appese all'infinito
const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_DB")), ms));

export const getCachedArticles = async (categoryLabel: string, categoryId?: string): Promise<Article[]> => {
    const searchTag = (categoryLabel || '').trim();
    
    console.log(`[DB] getCachedArticles: Avvio query per "${searchTag}"...`);

    try {
        // Usiamo Promise.race per non rimanere bloccati se la rete o Supabase hanno problemi
        const queryPromise = supabase
            .from('articles')
            .select('*')
            .eq('category', searchTag)
            .order('created_at', { ascending: false })
            .limit(20);

        const response: any = await Promise.race([queryPromise, timeout(5000)]);
        const { data, error } = response;

        if (error) {
            console.error("[DB] Errore risposta Supabase:", error.message);
            return [];
        }

        if (!data || data.length === 0) {
            console.log(`[DB] Nessun dato trovato per "${searchTag}"`);
            return [];
        }

        console.log(`[DB] Query completata: ${data.length} record ricevuti.`);

        return data.map((a: any) => {
            try {
                const rawDate = a.published_date || a.date || a.created_at || '';
                const dateStr = typeof rawDate === 'string' ? rawDate : String(rawDate);
                const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

                return {
                    id: a.id,
                    title: a.title || 'Senza Titolo',
                    summary: a.summary || '',
                    source: a.source || 'Fonte',
                    url: a.url,
                    date: cleanDate,
                    category: a.category,
                    imageUrl: a.image_url || '',
                    audioBase64: a.audio_base64 || '',
                    sentimentScore: Number(a.sentiment_score || 0.8),
                    likeCount: 0,
                    dislikeCount: 0
                };
            } catch (err) {
                return null;
            }
        }).filter(Boolean) as Article[];

    } catch (e: any) {
        console.warn(`[DB] Recupero fallito o timeout per "${searchTag}":`, e.message);
        return []; // Restituiamo array vuoto per forzare l'uso di Gemini
    }
};

export const saveArticles = async (categoryLabel: string, articles: Article[]): Promise<Article[]> => {
    if (!articles || articles.length === 0) return [];
    
    const rows = articles.map(a => ({
        url: a.url, 
        category: a.category || categoryLabel,
        title: a.title,
        summary: a.summary,
        source: a.source,
        published_date: a.date, 
        sentiment_score: a.sentimentScore,
        image_url: a.imageUrl || null,
        audio_base64: a.audioBase64 || null
    }));

    try {
        const { data, error } = await supabase
            .from('articles')
            .upsert(rows, { onConflict: 'url' })
            .select();
        
        if (error) {
            console.warn("[DB] Errore salvataggio:", error.message);
            return articles;
        }
        
        return (data || []).map((d: any, i: number) => ({ ...articles[i], id: d.id }));
    } catch (e) {
        return articles;
    }
};

export const updateArticleImage = async (articleUrl: string, imageUrl: string): Promise<void> => {
    try { await supabase.from('articles').update({ image_url: imageUrl }).eq('url', articleUrl); } catch (e) {}
};

export const updateArticleAudio = async (articleUrl: string, audioBase64: string): Promise<void> => {
    try { await supabase.from('articles').update({ audio_base64: audioBase64 }).eq('url', articleUrl); } catch (e) {}
};
