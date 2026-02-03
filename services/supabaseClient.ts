
import { createClient } from '@supabase/supabase-js';

// Priorità alle variabili d'ambiente di Vite/Vercel, con fallback ai valori hardcoded
const SUPABASE_URL = 
    import.meta.env.VITE_SUPABASE_URL || 
    'https://wcggpscuonhmowvfcdhv.supabase.co';

const SUPABASE_KEY = 
    import.meta.env.VITE_SUPABASE_ANON_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2dwc2N1b25obW93dmZjZGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTQ1ODEsImV4cCI6MjA4MDMzMDU4MX0.QwIKLDt3YWySndKHd6OX5EKfmYn3qskDl3cKJ8Mc92A';

console.log("[SUPABASE-INIT] 🛰️ Inizializzazione client in corso...");
if (!SUPABASE_URL || SUPABASE_URL.includes('undefined')) {
    console.error("[SUPABASE-INIT] ❌ URL Supabase non configurato correttamente!");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});
