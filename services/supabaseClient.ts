
import { createClient } from '@supabase/supabase-js';

// Funzione helper per recuperare le env in modo sicuro ed evitare crash "undefined"
const getEnvValue = (key: string): string => {
    // Prova import.meta.env (Vite standard)
    const viteEnv = (import.meta as any).env;
    if (viteEnv && viteEnv[key]) return viteEnv[key];
    
    // Fallback per process.env (Node/Vercel)
    try {
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key] || '';
        }
    } catch (e) {}

    return '';
};

// Se le chiavi sono mancanti, usiamo dei placeholder per non bloccare l'inizializzazione del modulo
// ma logghiamo un warning chiaro.
const SUPABASE_URL = getEnvValue('VITE_SUPABASE_URL') || 'https://wcggpscuonhmowvfcdhv.supabase.co';
const SUPABASE_KEY = getEnvValue('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2dwc2N1b25obW93dmZjZGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTQ1ODEsImV4cCI6MjA4MDMzMDU4MX0.QwIKLDt3YWySndKHd6OX5EKfmYn3qskDl3cKJ8Mc92A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Log di debug silenzioso ma utile
if (!getEnvValue('VITE_SUPABASE_URL')) {
    console.debug("[SUPABASE] Usando configurazione di fallback. Verifica le tue variabili d'ambiente.");
}
