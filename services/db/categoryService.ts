
import { supabase } from '../supabaseClient';
import { Category, DEFAULT_CATEGORIES } from '../../types';

/**
 * Recupera le categorie.
 * - Se userId è null: Recupera solo le categorie pubbliche (user_id IS NULL)
 * - Se userId è presente: Recupera (user_id IS NULL) OR (user_id == userId)
 */
export const getCategories = async (userId?: string): Promise<Category[]> => {
    let query = supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (userId) {
        // Sintassi Supabase per OR: user_id.is.null,user_id.eq.UUID
        query = query.or(`user_id.is.null,user_id.eq.${userId}`);
    } else {
        query = query.is('user_id', null);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error("Errore fetch categorie:", error);
        return [];
    }
    return data as Category[];
};

export const seedCategories = async (): Promise<void> => {
    const { count } = await supabase.from('categories').select('*', { count: 'exact', head: true });
    if (count === 0) {
      // Inserisce le categorie di default come Pubbliche (user_id non specificato = NULL)
      const categoriesToInsert = DEFAULT_CATEGORIES.map(c => ({ label: c.label, value: c.value }));
      await supabase.from('categories').insert(categoriesToInsert);
    }
};

/**
 * Aggiunge una categoria personale per l'utente loggato.
 */
export const addCategory = async (label: string, value: string, userId: string): Promise<Category | null> => {
    if (!userId) {
        console.error("Tentativo di aggiungere categoria senza userId");
        return null;
    }

    const { data, error } = await supabase
      .from('categories')
      .insert([{ label, value, user_id: userId }])
      .select()
      .single();
      
    if (error) {
        console.error("Errore aggiunta categoria:", error);
        return null;
    }
    return data as Category;
};
