
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const getCachedArticles = async (categoryLabel: string, categoryId?: string): Promise<Article[]> => {
    const cleanLabel = (categoryLabel || '').trim();
    const cleanId = (categoryId || '').trim();
    
    console.log(`[DB-Service] Tentativo fetch: Label="${cleanLabel}", ID="${cleanId}"`);

    try {
        let query = supabase.from('articles').select('*');

        // Costruzione filtro OR senza virgolette (encoding standard Supabase)
        // Se cleanLabel o cleanId contengono spazi, Supabase li gestisce automaticamente senza virgolette manuali
        const filters = [];
        if (cleanLabel) {
            filters.push(`category.ilike.%${cleanLabel}%`);
            filters.push(`category.eq.${cleanLabel}`);
        }
        if (cleanId) {
            filters.push(`category.eq.${cleanId}`);
        }

        if (filters.length > 0) {
            query = query.or(filters.join(','));
        }

        const { data, error, status } = await query
            .order('created_at', { ascending: false })
            .limit(40);

        if (error) {
            console.error(`[DB-Service] Errore Supabase (Status ${status}):`, error.message, error.details);
            // Se l'errore è legato a RLS o permessi, lo vedremo qui
            return [];
        }

        if (!data || data.length === 0) {
            console.warn(`[DB-Service] DB risposto con 0 record per ${cleanLabel}. Verificare RLS su Supabase.`);
            return [];
        }
        
        console.log(`[DB-Service] Successo: Ricevuti ${data.length} articoli.`);
        
        return data.map((a: any) => {
            try {
                const dateVal = a.published_date || a.date || a.created_at || new Date().toISOString();
                return {
                    id: a.id,
                    title: String(a.title || 'Senza Titolo'),
                    summary: String(a.summary || 'Nessun riassunto.'),
                    source: String(a.source || 'Fonte'),
                    url: a.url,
                    date: dateVal.split('T')[0],
                    category: a.category,
                    imageUrl: a.image_url || '',
                    audioBase64: a.audio_base_64 || '',
                    sentimentScore: Number(a.sentiment_score || 0.8),
                    likeCount: 0,
                    dislikeCount: 0
                };
            } catch (err) {
                return null;
            }
        }).filter(Boolean) as Article[];

    } catch (e: any) {
        console.error("[DB-Service] Eccezione critica:", e.message);
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
        // Fix: Changed a.audio_base64 to a.audioBase64 to correctly access the property defined in the Article interface
        audio_base_64: a.audioBase64 || null
    }));

    try {
        const { data, error } = await supabase.from('articles').upsert(rows, { onConflict: 'url' }).select();
        if (error) throw error;
        return (data || []).map((d: any, i: number) => ({ ...articles[i], id: d.id }));
    } catch (e) {
        console.warn("[DB-Service] Errore salvataggio:", e);
        return articles;
    }
};

export const updateArticleImage = async (articleUrl: string, imageUrl: string): Promise<void> => {
    try { await supabase.from('articles').update({ image_url: imageUrl }).eq('url', articleUrl); } catch (e) {}
};

export const updateArticleAudio = async (articleUrl: string, audioBase64: string): Promise<void> => {
    try { await supabase.from('articles').update({ audio_base_64: audioBase64 }).eq('url', articleUrl); } catch (e) {}
};
