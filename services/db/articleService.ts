
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
    
    console.log(`[DB-ARTICLES] 🔍 Richiesta articoli per pattern: "${searchTerm}"`);

    try {
        // Tentativo query con conteggi (Requires specific RLS/Views)
        console.log("[DB-ARTICLES] 📡 Esecuzione query principale...");
        const { data, error } = await supabase
          .from('articles')
          .select('*, likes(count), dislikes(count)')
          .ilike('category', searchTerm) 
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
            console.warn(`[DB-ARTICLES] ⚠️ Errore query principale (${error.code}). Provo fallback semplice...`);
            
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('articles')
                .select('*')
                .ilike('category', searchTerm)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (fallbackError) {
                console.error("[DB-ARTICLES] ❌ Errore anche nel fallback:", fallbackError.message);
                return [];
            }
            
            console.log(`[DB-ARTICLES] ✅ Fallback riuscito. Trovati ${fallbackData?.length || 0} articoli.`);
            return mapArticles(fallbackData);
        }

        console.log(`[DB-ARTICLES] ✅ Query riuscita. Trovati ${data?.length || 0} articoli.`);
        return mapArticles(data);

    } catch (e) {
        console.error("[DB-ARTICLES] ❌ Eccezione durante il recupero:", e);
        return [];
    }
};

// Helper per mappare i dati grezzi del DB nell'interfaccia Article dell'app
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
        audioBase64: a.audio_base64 || '',
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
        } catch (e) {}
    }
    return savedArticles;
};

export const updateArticleImage = async (articleUrl: string, imageUrl: string): Promise<void> => {
    try { await supabase.from('articles').update({ image_url: imageUrl }).eq('url', articleUrl); } catch (e) {}
};

export const updateArticleAudio = async (articleUrl: string, audioBase64: string): Promise<void> => {
    try { await supabase.from('articles').update({ audio_base64: audioBase64 }).eq('url', articleUrl); } catch (e) {}
};
