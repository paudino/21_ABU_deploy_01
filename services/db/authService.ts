
import { supabase } from '../supabaseClient';
import { User } from '../../types';

export const ensureUserExists = async (user: User) => {
    try {
        const { error } = await supabase.from('users').upsert({
            id: user.id,
            username: user.username,
            avatar: user.avatar
        });
        
        if (error) {
            console.error("[AuthService] Errore sync utente (upsert):", error.message);
        }
    } catch (e) {
        console.error("[AuthService] Eccezione sync utente:", e);
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

    if (data.user) {
        // Tentiamo la creazione del profilo, ma non blocchiamo se fallisce (es. RLS senza sessione attiva)
        ensureUserExists({
            id: data.user.id,
            username: username,
            avatar: avatarUrl
        }).catch(() => {});
    }

    return { data, error: null };
};

export const signInWithEmail = async (email: string, password: string) => {
    const response = await supabase.auth.signInWithPassword({ email, password });
    if (response.error) {
        console.error("[AuthService] Errore Supabase SignIn:", response.error.message);
    }
    return response;
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
    const { error } = await supabase.auth.signOut();
    if (error) console.error("[AuthService] Errore logout supabase:", error.message);
    return { error };
};

export const getCurrentUserProfile = async (): Promise<User | null> => {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return null;

        const userProfile: User = {
            id: user.id,
            username: user.user_metadata.full_name || user.email?.split('@')[0] || 'Utente',
            avatar: user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
        };

        // Assicuriamo che esista nella tabella pubblica 'users'
        await ensureUserExists(userProfile);

        return userProfile;
    } catch (e) {
        console.error("[AuthService] Errore recupero profilo:", e);
        return null;
    }
};
