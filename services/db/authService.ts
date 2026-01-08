
import { supabase } from '../supabaseClient';
import { User } from '../../types';

/**
 * Sincronizza il profilo utente nella tabella pubblica 'users'.
 * Questa funzione è ora non-bloccante e resiliente agli errori di schema/RLS.
 */
export const ensureUserExists = async (user: User) => {
    try {
        // Usiamo upsert per creare o aggiornare il profilo pubblico
        const { error } = await supabase.from('users').upsert({
            id: user.id,
            username: user.username,
            avatar: user.avatar
        }, { onConflict: 'id' });
        
        if (error) {
            // Logghiamo solo in debug, non interrompiamo il flusso dell'utente
            console.debug("[Auth-Sync] Nota: Sincronizzazione profilo DB non riuscita (opzionale):", error.message);
        }
    } catch (e) {
        console.debug("[Auth-Sync] Nota: Eccezione durante sync profilo:", e);
    }
};

export const signUpWithEmail = async (email: string, password: string) => {
    const username = email.split('@')[0];
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;

    const { data, error: authError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                full_name: username,
                avatar_url: avatarUrl
            }
        }
    });

    if (authError) return { data, error: authError };

    // Sincronizzazione in background
    if (data.user) {
        ensureUserExists({
            id: data.user.id,
            username: username,
            avatar: avatarUrl
        }).catch(() => {});
    }

    return { data, error: null };
};

export const signInWithEmail = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
};

export const signInWithProvider = async (provider: 'google') => {
    return await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: window.location.origin,
            queryParams: {
                prompt: 'select_account'
            }
        }
    });
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};

/**
 * Recupera il profilo utente prioritizzando i metadati della sessione Auth.
 * Non fallisce se il database non risponde.
 */
export const getCurrentUserProfile = async (): Promise<User | null> => {
    try {
        // 1. Prendiamo i dati direttamente dalla sessione di Supabase Auth (Fonte di Verità)
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) return null;

        // Costruiamo l'oggetto User dai metadati della sessione
        const profile: User = {
            id: user.id,
            username: user.user_metadata.full_name || user.email?.split('@')[0] || 'Utente',
            avatar: user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
        };

        // 2. Tentiamo la sincronizzazione in background (non bloccante)
        ensureUserExists(profile).catch(() => {});

        return profile;
    } catch (e) {
        console.error("[AuthService] Errore critico nel recupero profilo:", e);
        return null;
    }
};
