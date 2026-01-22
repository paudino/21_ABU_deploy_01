
import { supabase } from '../supabaseClient';
import { Category, DEFAULT_CATEGORIES } from '../../types';

/**
 * Recupera le categorie.
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
            console.error("[DB-CATS] ❌ Errore query Supabase:", error.message, error.details);
            return [];
        }

        console.log(`[DB-CATS] ✅ Query completata. Trovate ${data?.length || 0} categorie.`);
        return (data || []) as Category[];
    } catch (e) {
        console.error("[DB-CATS] ❌ Eccezione imprevista:", e);
        return [];
    }
};

export const seedCategories = async (): Promise<void> => {
    console.log("[DB-CATS] 🌱 Controllo se necessario il seeding delle categorie...");
    try {
        const { count, error } = await supabase
            .from('categories')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("[DB-CATS] ❌ Errore durante il conteggio per seeding:", error.message);
            return;
        }

        if (count === 0) {
            console.log("[DB-CATS] 🔨 Database vuoto. Inserimento categorie di default...");
            const categoriesToInsert = DEFAULT_CATEGORIES.map(c => ({ 
                label: c.label, 
                value: c.value 
            }));
            const { error: insertError } = await supabase.from('categories').insert(categoriesToInsert);
            if (insertError) console.error("[DB-CATS] ❌ Errore inserimento seeding:", insertError.message);
            else console.log("[DB-CATS] ✅ Seeding completato con successo.");
        } else {
            console.log(`[DB-CATS] ✨ Seeding non necessario, presenti ${count} categorie.`);
        }
    } catch (e) {
        console.error("[DB-CATS] ❌ Eccezione durante il seeding:", e);
    }
};

export const addCategory = async (label: string, value: string, userId: string): Promise<Category | null> => {
    console.log(`[DB-CATS] ➕ Aggiunta categoria privata: "${label}" per user ${userId}`);
    const { data, error } = await supabase
      .from('categories')
      .insert([{ label, value, user_id: userId }])
      .select()
      .single();
      
    if (error) {
        console.error("[DB-CATS] ❌ Errore aggiunta categoria:", error.message);
        return null;
    }
    return data as Category;
};
