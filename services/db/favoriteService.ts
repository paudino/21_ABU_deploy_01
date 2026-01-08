
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

/**
 * SERVIZIO PREFERITI - ROBUSTNESS EDITION
 */

const withTimeout = <T>(promise: PromiseLike<T>, ms: number, opName: string): Promise<T> => {
    return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`TIMEOUT_${opName}`)), ms)
        )
    ]);
};

const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

export const isFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    if (!articleId || !userId || !isValidUUID(articleId) || !isValidUUID(userId)) return false;
    try {
        const { data, error } = await withTimeout<any>(
            supabase
                .from('favorites')
                .select('id')
                .eq('article_id', articleId)
                .eq('user_id', userId)
                .maybeSingle(),
            5000,
            "CHECK"
        );
        return !!data && !error;
    } catch (e) { return false; }
};

export const addFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId)) return false;
    try {
        const { error } = await withTimeout<any>(
            supabase
                .from('favorites')
                .insert([{ article_id: articleId, user_id: userId }])
                .select()
                .single(),
            7000, 
            "INSERT"
        );
        if (error && error.code === '23505') return true;
        return !error;
    } catch (e: any) { return false; }
};

export const removeFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    try {
        const { data: record } = await withTimeout<any>(
            supabase
                .from('favorites')
                .select('id')
                .eq('article_id', articleId)
                .eq('user_id', userId)
                .maybeSingle(),
             5000,
             "FIND_FOR_DELETE"
        );
        if (!record) return true;
        const { error: deleteError } = await withTimeout<any>(
            supabase
                .from('favorites')
                .delete()
                .eq('id', record.id),
            7000,
            "DELETE_EXEC"
        );
        return !deleteError;
    } catch (e: any) { return false; }
};

export const getUserFavoriteArticles = async (userId: string): Promise<Article[]> => {
    if (!userId) return [];
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select(`
                id,
                article:articles!inner(
                    *,
                    likes(count),
                    dislikes(count)
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) return [];

        return (data || []).map((item: any) => {
            const a = item.article;
            return {
                ...a,
                id: a.id,
                date: a.published_date || a.date || a.created_at,
                imageUrl: a.image_url,
                audioBase64: a.audio_base64,
                sentimentScore: a.sentiment_score,
                likeCount: a.likes?.[0]?.count || 0,
                dislikeCount: a.dislikes?.[0]?.count || 0
            };
        });
    } catch (e) { return []; }
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
