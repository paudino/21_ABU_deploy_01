
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const cleanupOldArticles = async (): Promise<void> => {
    try { await supabase.rpc('cleanup_old_articles'); } catch (e) {}
};

export const getCachedArticles = async (categoryLabel: string): Promise<Article[]> => {
    const cleanLabel = categoryLabel ? categoryLabel.trim() : '';
    console.log(`[DIAGNOSTIC-DB] getCachedArticles START per "${cleanLabel}"`);

    try {
        // Query semplificata per massimizzare la velocità e la compatibilità
        // Evitiamo join complessi in questa fase critica
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .ilike('category', cleanLabel) 
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
            console.error("[DIAGNOSTIC-DB] Errore Supabase durante la lettura cache:", error.message);
            return [];
        }

        if (!data || data.length === 0) {
            console.log("[DIAGNOSTIC-DB] Nessun articolo trovato in cache locale.");
            return [];
        }
        
        console.log(`[DIAGNOSTIC-DB] SUCCESS: Trovati ${data.length} articoli in cache.`);
        
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
            sentimentScore: a.sentiment_score || 0.8,
            likeCount: 0, // Caricati a parte o ignorati per velocità in cache
            dislikeCount: 0
        }));

    } catch (e: any) {
        console.error("[DIAGNOSTIC-DB] Eccezione fatale durante fetch cache:", e.message);
        return [];
    }
};

export const saveArticles = async (categoryLabel: string, articles: Article[]): Promise<Article[]> => {
    if (!articles || articles.length === 0) return [];
    
    console.log(`[DIAGNOSTIC-DB] Salvataggio di ${articles.length} articoli per cache futuro.`);
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
                    id: data.id
                });
            }
        } catch (e) {
            console.warn("[DIAGNOSTIC-DB] Upsert fallito per un articolo:", article.url);
        }
    }
    
    return savedArticles;
};

export const updateArticleImage = async (articleUrl: string, imageUrl: string): Promise<void> => {
    try { await supabase.from('articles').update({ image_url: imageUrl }).eq('url', articleUrl); } catch (e) {}
};

export const updateArticleAudio = async (articleUrl: string, audioBase64: string): Promise<void> => {
    try { await supabase.from('articles').update({ audio_base64: audioBase64 }).eq('url', articleUrl); } catch (e) {}
};
