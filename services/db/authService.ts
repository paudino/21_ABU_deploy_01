
import { supabase } from '../supabaseClient';
import { User } from '../../types';

export const ensureUserExists = async (user: User) => {
    try {
        const { error } = await supabase.from('users').upsert({
            id: user.id,
            username: user.username,
            avatar: user.avatar
        }, { onConflict: 'id' });
        
        if (error) console.error("Errore sync utente:", error);
    } catch (e) {
        console.error("Eccezione sync utente:", e);
    }
};

export const signUpWithEmail = async (email: string, password: string) => {
    const username = email.split('@')[0];
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;

    // 1. Registrazione Auth
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

    // 2. Scrittura Profilo DB immediata
    if (data.user) {
        await ensureUserExists({
            id: data.user.id,
            username: username,
            avatar: avatarUrl
        });
    }

    return { data, error: null };
};

export const signInWithEmail = async (email: string, password: string) => {
    const response = await supabase.auth.signInWithPassword({ email, password });
    
    if (response.error) {
        console.error("Errore Supabase SignIn:", response.error.message);
        return response;
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
    if (error) console.error("Errore logout supabase:", error);
    return { error };
};

export const getCurrentUserProfile = async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const userProfile: User = {
        id: user.id,
        username: user.user_metadata.full_name || user.email?.split('@')[0] || 'Utente',
        avatar: user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
    };

    // Assicuriamo che esista nella tabella pubblica 'users'
    await ensureUserExists(userProfile);

    return userProfile;
};
