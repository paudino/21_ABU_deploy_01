
import { createClient } from '@supabase/supabase-js';

// Riferimento statico per garantire il funzionamento in deploy senza variabili d'ambiente configurate
const FALLBACK_URL = 'https://wcggpscuonhmowvfcdhv.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2dwc2N1b25obW93dmZjZGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTQ1ODEsImV4cCI6MjA4MDMzMDU4MX0.QwIKLDt3YWySndKHd6OX5EKfmYn3qskDl3cKJ8Mc92A';

const getEnv = (key: string): string => {
    try {
        // 1. Prova Vite (comune in deploy moderni)
        if (typeof (import.meta as any).env !== 'undefined' && (import.meta as any).env[key]) {
            return (import.meta as any).env[key];
        }
        // 2. Prova process.env standard
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return (process.env as any)[key];
        }
    } catch (e) {}
    
    // 3. Fallback ai valori hardcoded se le variabili mancano
    return key.includes('URL') ? FALLBACK_URL : FALLBACK_KEY;
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

console.log("[Supabase] Client init con URL:", SUPABASE_URL.substring(0, 15) + "...");

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});
