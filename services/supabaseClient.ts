
import { createClient } from '@supabase/supabase-js';

// CONFIGURAZIONE SUPABASE
const SUPABASE_URL = 
    (import.meta as any).env?.VITE_SUPABASE_URL || 
    'https://wcggpscuonhmowvfcdhv.supabase.co';

const SUPABASE_KEY = 
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2dwc2N1b25obW93dmZjZGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTQ1ODEsImV4cCI6MjA4MDMzMDU4MX0.QwIKLDt3YWySndKHd6OX5EKfmYn3qskDl3cKJ8Mc92A';

console.log("[SUPABASE-INIT] 🛰️ Inizializzazione client...");

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});
