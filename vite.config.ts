
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Carichiamo le env dal sistema (Vercel) o dal file .env
    const env = loadEnv(mode, process.cwd(), '');
    
    // Cerchiamo la chiave in tutti i possibili nomi comuni
    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.API_KEY || '';

    console.log(`[VITE-CONFIG] 🔑 Chiave API configurata: ${apiKey ? 'SI (Presente)' : 'NO (Mancante!)'}`);

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Inietta la chiave nel codice client come process.env.API_KEY (richiesto dal SDK Gemini)
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        // Fallback per Vite standard
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false
      }
    };
});
