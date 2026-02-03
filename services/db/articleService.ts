
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const cleanupOldArticles = async (): Promise<void> => {
    try { await supabase.rpc('cleanup_old_articles'); } catch (e) {}
};

export const getCachedArticles = async (queryTerm: string, maxAgeMinutes: number = 0): Promise<Article[]> => {
    const cleanTerm = (queryTerm || '').trim().replace(/['"()]/g, '');
    if (!cleanTerm || cleanTerm.length < 2) return [];

    const searchTerm = `%${cleanTerm}%`;
    
    // Funzione interna per il tentativo di query
    const performQuery = async (): Promise<Article[]> => {
        try {
            let q = supabase
              .from('articles')
              .select('*, likes(count), dislikes(count)')
              .or(`category.ilike.${searchTerm},title.ilike.${searchTerm},summary.ilike.${searchTerm}`);

            if (maxAgeMinutes > 0) {
                const threshold = new Date(Date.now() - maxAgeMinutes * 60000).toISOString();
                q = q.gt('created_at', threshold);
            }

            const { data, error } = await q.order('created_at', { ascending: false }).limit(20);
            if (error) throw error;
            return mapArticles(data);
        } catch (e) {
            console.error("[DB-ARTICLES] ❌ Errore query:", e);
            throw e;
        }
    };

    // Timeout molto generoso per Vercel (20s)
    const timeout = 20000;
    
    try {
        console.log(`[DB-ARTICLES] 🔍 Ricerca cache per: "${searchTerm}" (timeout ${timeout}ms)...`);
        
        const result = await Promise.race([
            performQuery(),
            new Promise<Article[]>((_, reject) => 
                setTimeout(() => reject(new Error("Timeout DB")), timeout)
            )
        ]);
        
        console.log(`[DB-ARTICLES] 📥 Trovati ${result.length} articoli.`);
        return result;
    } catch (err) {
        console.warn(`[DB-ARTICLES] ⏳ Fallimento DB (timeout o errore), provo un secondo tentativo rapido...`);
        // Secondo tentativo senza timeout breve, magari si è appena svegliato
        try {
            return await performQuery();
        } catch {
            return [];
        }
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
        sentimentScore: a.sentiment_score || 0.8,
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
            audio_base_64: article.audioBase64 || null
        };

        try {
            const { data } = await supabase.from('articles').upsert(row, { onConflict: 'url' }).select().single();
            if (data) savedArticles.push({ ...article, id: data.id, category: data.category });
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
