
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
    // FIX: Casting supabase.auth as any to bypass "Property 'signUp' does not exist on type SupabaseAuthClient" errors.
    const { data, error: authError } = await (supabase.auth as any).signUp({ 
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
    // FIX: Casting supabase.auth as any to bypass property missing errors.
    const response = await (supabase.auth as any).signInWithPassword({ email, password });
    
    if (response.error) {
        console.error("Errore Supabase SignIn:", response.error.message);
        return response;
    }
    return response;
};

export const signInWithProvider = async (provider: 'google') => {
    // FIX: Casting supabase.auth as any to bypass property missing errors.
    return await (supabase.auth as any).signInWithOAuth({
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
    // FIX: Casting supabase.auth as any to bypass property missing errors.
    const { error } = await (supabase.auth as any).signOut();
    if (error) console.error("Errore logout supabase:", error);
    return { error };
};

export const getCurrentUserProfile = async (): Promise<User | null> => {
    // FIX: Casting supabase.auth as any to bypass property missing errors.
    const { data: { user } } = await (supabase.auth as any).getUser();
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
