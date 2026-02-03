
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Carichiamo le env dal sistema (Vercel) o dal file .env
    const env = loadEnv(mode, process.cwd(), '');
    
    // Cerchiamo la chiave Gemini in tutti i possibili nomi comuni
    const geminiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.API_KEY || '';
    
    // Supabase Keys
    const supabaseUrl = env.VITE_SUPABASE_URL || '';
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

    console.log(`[VITE-BUILD] 🛠️ Mode: ${mode}`);
    console.log(`[VITE-BUILD] 🔑 Gemini Key: ${geminiKey ? 'Presente' : 'MANCANTE'}`);
    console.log(`[VITE-BUILD] 🛰️ Supabase URL: ${supabaseUrl ? 'Presente' : 'MANCANTE'}`);

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Inietta la chiave nel codice client come process.env.API_KEY (richiesto dal SDK Gemini)
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', '@supabase/supabase-js', '@google/genai'],
            },
          },
        },
      }
    };
});
