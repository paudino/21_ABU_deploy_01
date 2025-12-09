
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

/**
 * SERVIZIO PREFERITI - ROBUSTNESS EDITION
 * Gestione timeout, cancellazione per Primary Key e validazione rigorosa.
 */

// Timeout Promise wrapper
const withTimeout = <T>(promise: PromiseLike<T>, ms: number, opName: string): Promise<T> => {
    return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`TIMEOUT_${opName}`)), ms)
        )
    ]);
};

// Helper per validare UUID
const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

// PUNTO A: Controllo esistenza (SELECT)
export const isFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    if (!articleId || !userId || !isValidUUID(articleId) || !isValidUUID(userId)) return false;

    console.log(`[Fav] Punto A: Check esistenza per ${articleId}`);
    
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

        if (error) {
            console.error("[Fav] Errore Check:", error);
            return false;
        }

        const exists = !!data;
        console.log(`[Fav] Esito Check: ${exists ? 'Esiste' : 'Non esiste'}`);
        return exists;
    } catch (e) {
        console.error("[Fav] Eccezione Check:", e);
        return false;
    }
};

// PUNTO C: Aggiungi (INSERT)
export const addFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    console.log(`[Fav] Punto C: Eseguo INSERT per ${articleId}`);

    if (!isValidUUID(articleId)) {
        console.error("[Fav] ID Articolo non valido per insert:", articleId);
        return false;
    }

    try {
        console.time("db_insert");
        
        // Uso select() per forzare una risposta dal server
        const { error } = await withTimeout<any>(
            supabase
                .from('favorites')
                .insert([{ article_id: articleId, user_id: userId }])
                .select()
                .single(),
            7000, 
            "INSERT"
        );
        
        console.timeEnd("db_insert");

        if (error) {
            console.error("[Fav] Errore INSERT:", error);
            if (error.code === '42501') alert("ERRORE PERMESSI (RLS). Esegui lo script SQL!");
            // 23505 = Duplicate key (successo tecnico)
            if (error.code === '23505') return true;
            return false;
        }

        console.log("[Fav] Insert riuscita.");
        return true;
    } catch (e: any) {
        console.error("[Fav] Eccezione Insert:", e.message || e);
        return false;
    }
};

// PUNTO B: Rimuovi (DELETE CHIRURGICA)
export const removeFavorite = async (articleId: string, userId: string): Promise<boolean> => {
    console.log(`[Fav] Punto B: Eseguo DELETE per ${articleId}`);

    try {
        console.time("db_delete_find");
        
        // STEP 1: Trova l'ID specifico del record (Primary Key)
        // Questo è molto più veloce e sicuro di una delete per criteri
        const { data: record, error: findError } = await withTimeout<any>(
            supabase
                .from('favorites')
                .select('id')
                .eq('article_id', articleId)
                .eq('user_id', userId)
                .maybeSingle(),
             5000,
             "FIND_FOR_DELETE"
        );
        console.timeEnd("db_delete_find");

        if (findError) {
             console.error("[Fav] Errore ricerca pre-delete:", findError);
             return false;
        }

        if (!record) {
            console.log("[Fav] Record già inesistente. Considero rimosso.");
            return true;
        }

        console.log(`[Fav] Record trovato (ID: ${record.id}). Cancello per ID...`);

        // STEP 2: Cancella per Primary Key (Istutaneo)
        console.time("db_delete_exec");
        const { error: deleteError } = await withTimeout<any>(
            supabase
                .from('favorites')
                .delete()
                .eq('id', record.id),
            7000,
            "DELETE_EXEC"
        );
        console.timeEnd("db_delete_exec");

        if (deleteError) {
            console.error("[Fav] Errore DELETE:", deleteError);
            if (deleteError.code === '42501') alert("ERRORE PERMESSI (RLS). Esegui lo script SQL!");
            return false;
        }

        console.log("[Fav] Delete riuscita.");
        return true;
    } catch (e: any) {
        console.error("[Fav] Eccezione Delete:", e.message || e);
        return false; // Questo scatenerà il rollback UI
    }
};

// Metodi di lettura per le liste
export const getUserFavoriteArticles = async (userId: string): Promise<Article[]> => {
    if (!userId) return [];
    try {
        // Query arricchita con likes(count) e dislikes(count)
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

        if (error) {
            console.error("Errore recupero preferiti:", error);
            return [];
        }

        return (data || []).map((item: any) => {
            const a = item.article;
            return {
                ...a,
                id: a.id,
                date: a.published_date || a.date || a.created_at,
                imageUrl: a.image_url,
                audioBase64: a.audio_base64,
                sentimentScore: a.sentiment_score,
                // Estrazione sicura dei conteggi
                likeCount: a.likes?.[0]?.count || 0,
                dislikeCount: a.dislikes?.[0]?.count || 0
            };
        });
    } catch (e) { 
        console.error("Eccezione recupero preferiti:", e);
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
