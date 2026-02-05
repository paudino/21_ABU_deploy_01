
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const cleanupOldArticles = async (): Promise<void> => {
    try { await supabase.rpc('cleanup_old_articles'); } catch (e) {}
};

export const getCachedArticles = async (queryTerm: string): Promise<Article[]> => {
    const cleanTerm = queryTerm ? queryTerm.trim() : '';
    const searchTerm = (cleanTerm && cleanTerm !== 'Generale') 
        ? `%${cleanTerm}%` 
        : '%';
    
    console.log(`[DB-ARTICLES] 🔍 Ricerca articoli per termine: "${searchTerm}"`);

    try {
        // Rimosso il join likes(count) che causava errori nei log di Supabase 
        // e sostituito con una query piana per massimizzare la compatibilità.
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .or(`category.ilike.${searchTerm},title.ilike.${searchTerm},summary.ilike.${searchTerm}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
            console.error(`[DB-ARTICLES] ❌ Errore critico query:`, error);
            return [];
        }

        return mapArticles(data);
    } catch (e) {
        console.error("[DB-ARTICLES] ❌ Errore ricerca cache:", e);
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
        // Corrected field name from audio_base_64 to audio_base64
        audioBase64: a.audio_base64 || '',
        sentimentScore: a.sentiment_score,
        likeCount: a.like_count || 0, // Fallback su colonne dirette se presenti
        dislikeCount: a.dislike_count || 0
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
            // Corrected field name from audio_base_64 to audio_base64
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
    try { 
        await supabase.from('articles').update({ image_url: imageUrl }).eq('url', articleUrl); 
    } catch (e) {
        console.error("Errore salvataggio immagine predittiva:", e);
    }
};

export const updateArticleAudio = async (articleUrl: string, audioBase64: string): Promise<void> => {
    try { 
        // Corrected field name from audio_base_64 to audio_base64
        await supabase.from('articles').update({ audio_base64: audioBase64 }).eq('url', articleUrl); 
    } catch (e) {
        console.error("Errore salvataggio audio predittivo:", e);
    }
};
