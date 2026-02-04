
import { supabase } from '../supabaseClient';
import { Category, DEFAULT_CATEGORIES } from '../../types';

/**
 * Recupera le categorie con fallback di resilienza.
 */
export const getCategories = async (userId?: string): Promise<Category[]> => {
    console.log(`[DB-CATS] 📡 Avvio query categorie. UserID: ${userId || 'Pubblico'}`);
    
    try {
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
        
        if (error) {
            console.warn("[DB-CATS] ⚠️ Errore query Supabase, uso fallback:", error.message);
            return DEFAULT_CATEGORIES;
        }

        if (!data || data.length === 0) {
            return DEFAULT_CATEGORIES;
        }

        console.log(`[DB-CATS] ✅ Query completata. Trovate ${data.length} categorie.`);
        return data as Category[];
    } catch (e) {
        console.error("[DB-CATS] ❌ Eccezione di rete (Failed to fetch?), uso categorie di default.");
        return DEFAULT_CATEGORIES;
    }
};

export const seedCategories = async (): Promise<void> => {
    console.log("[DB-CATS] 🌱 Controllo se necessario il seeding...");
    try {
        const { count, error } = await supabase
            .from('categories')
            .select('*', { count: 'exact', head: true });
        
        if (error) return;

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
    try {
        const { data, error } = await supabase
          .from('categories')
          .insert([{ label, value, user_id: userId }])
          .select()
          .single();
          
        if (error) return null;
        return data as Category;
    } catch (e) {
        return null;
    }
};
