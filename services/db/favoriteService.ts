
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

/**
 * SERVIZIO PREFERITI
 * Gestisce il salvataggio e il recupero degli articoli preferiti dell'utente.
 */

const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

export const isFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    if (!articleId || !userId || !isValidUUID(articleId) || !isValidUUID(userId)) return false;
    try {
        const { data } = await supabase
                .from('favorites')
                .select('id')
                .eq('article_id', articleId)
                .eq('user_id', userId)
                .maybeSingle();
        return !!data;
    } catch (e) {
        return false;
    }
};

export const addFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId)) return false;
    try {
        const { error } = await supabase
                .from('favorites')
                .insert([{ article_id: articleId, user_id: userId }])
                .select()
                .single();
        if (error && error.code !== '23505') return false;
        return true;
    } catch (e) {
        return false;
    }
};

export const removeFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
                .from('favorites')
                .delete()
                .eq('article_id', articleId)
                .eq('user_id', userId);
        return !error;
    } catch (e) {
        return false;
    }
};

export const getUserFavoriteArticles = async (userId: string): Promise<Article[]> => {
    if (!userId) return [];
    try {
        // Includiamo i conteggi dei like e dislike direttamente nella query nested
        const { data, error } = await supabase
            .from('favorites')
            .select(`
                article_id,
                articles (
                    *,
                    likes(count),
                    dislikes(count)
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Errore recupero preferiti:", error);
            return [];
        }

        return (data || [])
            .filter((item: any) => item.articles !== null)
            .map((item: any) => {
                const a = item.articles;
                return {
                    id: a.id,
                    title: a.title,
                    summary: a.summary,
                    source: a.source,
                    url: a.url,
                    date: a.published_date || a.date,
                    category: a.category,
                    imageUrl: a.image_url,
                    audioBase64: a.audio_base64,
                    sentimentScore: a.sentiment_score || 0.8,
                    likeCount: a.likes?.[0]?.count || 0,
                    dislikeCount: a.dislikes?.[0]?.count || 0
                };
            });
    } catch (e) { 
        return []; 
    }
};

export const getUserFavoritesIds = async (userId: string): Promise<Set<string>> => {
    if (!userId) return new Set();
    try {
        const { data } = await supabase.from('favorites').select('article_id').eq('user_id', userId);
        const ids = new Set<string>();
        data?.forEach((row: any) => ids.add(row.article_id));
        return ids;
    } catch { return new Set(); }
};
