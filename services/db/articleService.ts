
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const cleanupOldArticles = async (): Promise<void> => {
    try { await supabase.rpc('cleanup_old_articles'); } catch (e) {}
};

export const getCachedArticles = async (categoryLabel: string): Promise<Article[]> => {
    const cleanLabel = categoryLabel ? categoryLabel.trim() : '';
    const searchTerm = (cleanLabel && cleanLabel !== 'Generale') 
        ? `%${cleanLabel}%` 
        : '%';
    
    console.log(`[DB-ARTICLES] getCachedArticles: Querying for "${categoryLabel}" (Pattern: ${searchTerm})`);

    try {
        let { data, error } = await supabase
          .from('articles')
          .select('*, likes(count), dislikes(count)')
          .ilike('category', searchTerm) 
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
            console.warn("[DB-ARTICLES] ⚠️ Query complessa fallita (RLS o Schema missing), procedo con fallback semplice...", error.message);
            
            const fallback = await supabase
                .from('articles')
                .select('*')
                .ilike('category', searchTerm)
                .order('created_at', { ascending: false })
                .limit(50);
            
            data = fallback.data;
            error = fallback.error;
        }

        if (error) {
            console.error("[DB-ARTICLES] ❌ Errore critico fetch cache:", error.message);
            return [];
        }
        
        console.log(`[DB-ARTICLES] ✅ Trovati ${data?.length || 0} articoli in cache.`);

        return (data || []).map((a: any) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            source: a.source,
            url: a.url,
            date: a.published_date || a.date || new Date(a.created_at).toLocaleDateString(),
            category: a.category,
            imageUrl: a.image_url || '',
            audioBase64: a.audio_base64 || '',
            sentimentScore: a.sentiment_score,
            likeCount: a.likes?.[0]?.count || 0,
            dislikeCount: a.dislikes?.[0]?.count || 0
        }));

    } catch (e: any) {
        console.error("[DB-ARTICLES] ❌ Eccezione durante fetch cache:", e);
        return [];
    }
};

export const saveArticles = async (categoryLabel: string, articles: Article[]): Promise<Article[]> => {
    if (!articles || articles.length === 0) return [];
    
    const savedArticles: Article[] = [];
    const cleanCategory = (categoryLabel || 'Generale').trim();
    console.log(`[DB-ARTICLES] 💾 Salvataggio di ${articles.length} articoli per la categoria "${cleanCategory}"`);

    for (const article of articles) {
        if (!article.url) continue;

        const row = {
            url: article.url, 
            category: article.category || cleanCategory,
            title: article.title,
            summary: article.summary,
            source: article.source,
            published_date: article.date, 
            sentiment_score: article.sentimentScore,
            image_url: article.imageUrl || null,
            audio_base64: article.audioBase64 || null
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
        } catch (e) {
            console.error(`[DB-ARTICLES] ❌ Errore salvataggio articolo "${article.title}":`, e);
        }
    }
    
    console.log(`[DB-ARTICLES] ✅ Salvataggio completato. ${savedArticles.length} articoli registrati.`);
    return savedArticles;
};

export const updateArticleImage = async (articleUrl: string, imageUrl: string): Promise<void> => {
    try { await supabase.from('articles').update({ image_url: imageUrl }).eq('url', articleUrl); } catch (e) {}
};

export const updateArticleAudio = async (articleUrl: string, audioBase64: string): Promise<void> => {
    try { await supabase.from('articles').update({ audio_base64: audioBase64 }).eq('url', articleUrl); } catch (e) {}
};
