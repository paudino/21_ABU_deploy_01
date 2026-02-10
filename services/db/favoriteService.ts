
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

const isValidUUID = (id: string | undefined): boolean => {
    if (!id) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
};

export const isFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId) || !userId) return false;
    try {
        const { data } = await supabase
                .from('favorites')
                .select('id')
                .eq('article_id', articleId)
                .eq('user_id', userId)
                .maybeSingle();
        return !!data;
    } catch { return false; }
};

export const addFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId) || !userId) return false;
    try {
        const { error } = await supabase
                .from('favorites')
                .insert([{ article_id: articleId, user_id: userId }]);
        return !error || error.code === '23505';
    } catch { return false; }
};

export const removeFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId) || !userId) return false;
    try {
        const { error } = await supabase
                .from('favorites')
                .delete()
                .eq('article_id', articleId)
                .eq('user_id', userId);
        return !error;
    } catch { return false; }
};

export const getUserFavoriteArticles = async (userId: string): Promise<Article[]> => {
    if (!userId) return [];
    console.log("[DB-FAVS] 📡 Recupero articoli preferiti per utente:", userId);
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select(`
                article_id,
                articles (
                    id,
                    title,
                    summary,
                    source,
                    url,
                    published_date,
                    category,
                    image_url,
                    audio_base64,
                    sentiment_score
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("[DB-FAVS] ❌ Errore Supabase:", error);
            return [];
        }

        const mapped = (data || [])
            .filter(item => item.articles)
            .map(item => {
                const a: any = item.articles;
                return {
                    id: a.id,
                    title: a.title,
                    summary: a.summary,
                    source: a.source,
                    url: a.url,
                    date: a.published_date,
                    category: a.category,
                    imageUrl: a.image_url,
                    audioBase64: a.audio_base64,
                    sentimentScore: a.sentiment_score || 0.8,
                    likeCount: 0,
                    dislikeCount: 0
                };
            });
            
        console.log(`[DB-FAVS] ✅ Trovati ${mapped.length} articoli preferiti.`);
        return mapped;
    } catch (e) {
        console.error("[DB-FAVS] ❌ Eccezione recupero preferiti:", e);
        return [];
    }
};

export const getUserFavoritesIds = async (userId: string): Promise<Set<string>> => {
    if (!userId) return new Set();
    try {
        const { data } = await supabase.from('favorites').select('article_id').eq('user_id', userId);
        return new Set(data?.map(r => r.article_id) || []);
    } catch { return new Set(); }
};
