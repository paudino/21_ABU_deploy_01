
import { supabase } from '../supabaseClient';
import { Category, DEFAULT_CATEGORIES } from '../../types';

/**
 * Recupera le categorie con un meccanismo di protezione per evitare blocchi infiniti.
 */
export const getCategories = async (userId?: string): Promise<Category[]> => {
    console.log(`[DB-CATS] 📡 Avvio query categorie. UserID: ${userId || 'Pubblico'}`);
    
    // Timeout di sicurezza: se Supabase non risponde entro 4 secondi, restituiamo array vuoto
    // permettendo all'app di usare i default.
    const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error("Timeout DB Categorie")), 4000)
    );

    try {
        const queryPromise = (async () => {
            let query = supabase
              .from('categories')
              .select('*')
              .order('created_at', { ascending: true });

            if (userId) {
                query = query.or(`user_id.is.null,user_id.eq.${userId}`);
            } else {
                query = query.is('user_id', null);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return data;
        })();

        const data = await Promise.race([queryPromise, timeoutPromise]);
        
        if (!data) return [];
        console.log(`[DB-CATS] ✅ Query completata. Trovate ${data.length} categorie.`);
        return data as Category[];
    } catch (e: any) {
        console.warn("[DB-CATS] ⚠️ Recupero categorie fallito o timeout:", e.message);
        return [];
    }
};

export const seedCategories = async (): Promise<void> => {
    try {
        const { count } = await supabase
            .from('categories')
            .select('*', { count: 'exact', head: true });
        
        if (count === 0) {
            const categoriesToInsert = DEFAULT_CATEGORIES.map(c => ({ 
                label: c.label, 
                value: c.value 
            }));
            await supabase.from('categories').insert(categoriesToInsert);
        }
    } catch (e) {}
};

export const addCategory = async (label: string, value: string, userId: string): Promise<Category | null> => {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ label, value, user_id: userId }])
      .select()
      .single();
      
    if (error) return null;
    return data as Category;
};
