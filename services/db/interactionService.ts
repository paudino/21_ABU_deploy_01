
import { supabase } from '../supabaseClient';
import { Comment, User } from '../../types';
import { ensureUserExists } from './authService';

const isValidUUID = (id: string | undefined): boolean => {
    if (!id) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
};

// --- Commenti ---

export const getComments = async (articleId: string): Promise<Comment[]> => {
    if (!isValidUUID(articleId)) return [];
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('article_id', articleId)
            .order('created_at', { ascending: false });
            
        if (error) return [];

        return (data || []).map((c: any) => ({
            id: c.id, 
            articleId: c.article_id, 
            userId: c.user_id, 
            username: c.username, 
            text: c.text, 
            timestamp: new Date(c.created_at).getTime()
        }));
    } catch (e) {
        return [];
    }
};

export const addComment = async (articleId: string, user: User, text: string): Promise<Comment> => {
    if (!isValidUUID(articleId)) throw new Error("Salvataggio articolo in corso, riprova tra un istante.");
    
    await ensureUserExists(user);

    const { data, error } = await supabase
        .from('comments')
        .insert([{ 
            article_id: articleId, 
            user_id: user.id, 
            username: user.username, 
            text 
        }])
        .select()
        .single();

    if (error) throw error;

    return { 
        id: data.id, 
        articleId: data.article_id, 
        userId: data.user_id, 
        username: data.username, 
        text: data.text, 
        timestamp: new Date(data.created_at).getTime() 
    };
};

export const deleteComment = async (commentId: string, userId: string): Promise<void> => {
    if (!isValidUUID(commentId)) return;
    await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);
};

// --- Like / Dislike ---

export const toggleLike = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId)) return false;
    
    await supabase.from('dislikes').delete().eq('article_id', articleId).eq('user_id', userId);
    const { data: existingLike } = await supabase.from('likes').select('id').eq('article_id', articleId).eq('user_id', userId).maybeSingle();
    
    if (existingLike) { 
        await supabase.from('likes').delete().eq('id', existingLike.id); 
        return false; 
    } else { 
        await supabase.from('likes').insert([{ article_id: articleId, user_id: userId }]); 
        return true; 
    }
};

export const toggleDislike = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId)) return false;
    
    await supabase.from('likes').delete().eq('article_id', articleId).eq('user_id', userId);
    const { data: existingDislike } = await supabase.from('dislikes').select('id').eq('article_id', articleId).eq('user_id', userId).maybeSingle();
    
    if (existingDislike) { 
        await supabase.from('dislikes').delete().eq('id', existingDislike.id); 
        return false; 
    } else { 
        await supabase.from('dislikes').insert([{ article_id: articleId, user_id: userId }]); 
        return true; 
    }
};

export const getLikeCount = async (articleId: string): Promise<number> => {
    if (!isValidUUID(articleId)) return 0;
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('article_id', articleId);
    return count || 0;
};

export const hasUserLiked = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId)) return false;
    const { data } = await supabase.from('likes').select('id').eq('article_id', articleId).eq('user_id', userId).maybeSingle();
    return !!data;
};

export const getDislikeCount = async (articleId: string): Promise<number> => {
    if (!isValidUUID(articleId)) return 0;
    const { count } = await supabase.from('dislikes').select('*', { count: 'exact', head: true }).eq('article_id', articleId);
    return count || 0;
};

export const hasUserDisliked = async (articleId: string, userId: string): Promise<boolean> => {
    if (!isValidUUID(articleId)) return false;
    const { data } = await supabase.from('dislikes').select('id').eq('article_id', articleId).eq('user_id', userId).maybeSingle();
    return !!data;
};
