
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const getCachedArticles = async (categoryLabel: string, categoryId?: string): Promise<Article[]> => {
    const searchTag = (categoryLabel || '').trim();
    
    console.log(`[DB] getCachedArticles: Cerco "${searchTag}"`);

    try {
        // Query semplice: cerchiamo corrispondenza esatta sulla categoria.
        // Se il DB è vuoto, questo restituirà [] velocemente.
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('category', searchTag)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error("[DB] Errore query Supabase:", error.message);
            return [];
        }

        if (!data || data.length === 0) {
            console.log(`[DB] Nessun articolo trovato in cache per "${searchTag}"`);
            return [];
        }

        console.log(`[DB] Successo! Trovati ${data.length} articoli.`);

        return data.map((a: any) => {
            try {
                // Gestione robusta della data per evitare crash .split()
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
                    audioBase64: a.audio_base_64 || '',
                    sentimentScore: Number(a.sentiment_score || 0.8),
                    likeCount: 0,
                    dislikeCount: 0
                };
            } catch (mappingError) {
                console.error("[DB] Errore mapping record:", a.id, mappingError);
                return null;
            }
        }).filter(Boolean) as Article[];

    } catch (e: any) {
        console.error("[DB] Eccezione critica nel recupero:", e.message);
        return [];
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
        audio_base_64: a.audioBase64 || null
    }));

    try {
        const { data, error } = await supabase
            .from('articles')
            .upsert(rows, { onConflict: 'url' })
            .select();
        
        if (error) {
            console.warn("[DB] Errore durante l'upsert:", error.message);
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
    try { await supabase.from('articles').update({ audio_base_64: audioBase64 }).eq('url', articleUrl); } catch (e) {}
};
