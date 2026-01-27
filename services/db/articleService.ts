
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const cleanupOldArticles = async (): Promise<void> => {
    try { await supabase.rpc('cleanup_old_articles'); } catch (e) {}
};

/**
 * Recupera articoli dalla cache filtrando per termine e opzionalmente per freschezza.
 */
export const getCachedArticles = async (queryTerm: string, maxAgeMinutes: number = 0): Promise<Article[]> => {
    // Sanificazione rigorosa del termine per evitare errori SQL .or()
    const cleanTerm = (queryTerm || '').trim().replace(/['"()]/g, '');
    
    // Se il termine è troppo corto o vuoto, non facciamo query complesse
    if (!cleanTerm || cleanTerm.length < 2) return [];

    const searchTerm = `%${cleanTerm}%`;
    
    console.log(`[DB-ARTICLES] 🔍 Ricerca cache per: "${searchTerm}" (Max Age: ${maxAgeMinutes}m)`);

    try {
        let query = supabase
          .from('articles')
          .select('*, likes(count), dislikes(count)')
          .or(`category.ilike.${searchTerm},title.ilike.${searchTerm},summary.ilike.${searchTerm}`);

        // Se specificato un limite di tempo, filtriamo per data creazione
        if (maxAgeMinutes > 0) {
            const threshold = new Date(Date.now() - maxAgeMinutes * 60000).toISOString();
            query = query.gt('created_at', threshold);
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return mapArticles(data);
    } catch (e) {
        console.error("[DB-ARTICLES] ❌ Errore cache:", e);
        return [];
    }
};

const mapArticles = (data: any[] | null): Article[] => {
    if (!data) return [];
    return data.map((a: any) => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        source: a.source,
        url: a.url,
        date: a.published_date || a.date || new Date(a.created_at).toLocaleDateString(),
        category: a.category,
        imageUrl: a.image_url || '',
        audioBase64: a.audio_base_64 || '',
        sentimentScore: a.sentiment_score,
        likeCount: a.likes?.[0]?.count || 0,
        dislikeCount: a.dislikes?.[0]?.count || 0
    }));
};

export const saveArticles = async (categoryLabel: string, articles: Article[]): Promise<Article[]> => {
    if (!articles || articles.length === 0) return [];
    
    const savedArticles: Article[] = [];
    const cleanCategory = (categoryLabel || 'Generale').trim();

    for (const article of articles) {
        if (!article.url) continue;

        // Fix: Use camelCase properties from the Article interface to populate the DB row.
        const row = {
            url: article.url, 
            category: article.category || cleanCategory,
            title: article.title,
            summary: article.summary,
            source: article.source,
            published_date: article.date, 
            sentiment_score: article.sentimentScore,
            image_url: article.imageUrl || null,
            audio_base_64: article.audioBase64 || null
        };

        try {
            const { data, error } = await supabase
                .from('articles')
                .upsert(row, { onConflict: 'url' })
                .select()
                .single();

            if (data) {
                savedArticles.push({
                    ...article,
                    id: data.id,
                    category: data.category
                });
            }
        } catch (e) {}
    }
    return savedArticles;
};

export const updateArticleImage = async (articleUrl: string, imageUrl: string): Promise<void> => {
    try { await supabase.from('articles').update({ image_url: imageUrl }).eq('url', articleUrl); } catch (e) {}
};

export const updateArticleAudio = async (articleUrl: string, audioBase64: string): Promise<void> => {
    try { await supabase.from('articles').update({ audio_base_64: audioBase64 }).eq('url', articleUrl); } catch (e) {}
};
