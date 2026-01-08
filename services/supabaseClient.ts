
import { createClient } from '@supabase/supabase-js';

/**
 * 🔐 GESTIONE CHIAVI E SICUREZZA
 * In un ambiente di produzione, queste chiavi dovrebbero essere impostate 
 * nelle "Environment Variables" del tuo provider di hosting.
 * 
 * La chiave 'anon' è pubblica per design, ma la vera sicurezza è garantita
 * dalle Row Level Security (RLS) configurate sul database.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wcggpscuonhmowvfcdhv.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2dwc2N1b25obW93dmZjZGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTQ1ODEsImV4cCI6MjA4MDMzMDU4MX0.QwIKLDt3YWySndKHd6OX5EKfmYn3qskDl3cKJ8Mc92A';

if (!process.env.VITE_SUPABASE_URL) {
    console.warn("[Security] Utilizzo chiavi Supabase di fallback. Considera l'uso di variabili d'ambiente in produzione.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});
