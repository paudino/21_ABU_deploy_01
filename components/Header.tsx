
import React, { useState, useEffect } from 'react';
import { User, Quote } from '../types';
import { IconHeart } from './Icons';
import { db } from '../services/dbService';
import { generateInspirationalQuote } from '../services/geminiService';
import { Tooltip } from './Tooltip';

interface HeaderProps {
  currentUser: User | null;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  onLogout: () => void;
  onLoginClick: () => void;
}

/**
 * Header Moderno "Sunshine".
 * Include il Sole interattivo che genera citazioni e l'area utente.
 */
export const Header: React.FC<HeaderProps> = ({ 
  currentUser, 
  showFavoritesOnly, 
  onToggleFavorites, 
  onLogout, 
  onLoginClick 
}) => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Carica citazione iniziale dal DB (veloce) o genera se vuoto
  useEffect(() => {
    loadInitialQuote();
  }, []);

  const loadInitialQuote = async () => {
      const q = await db.getRandomQuote();
      if (q) setQuote(q);
      else fetchNewQuote(); // Se DB vuoto, prova a caricarne una una tantum
  };

  const fetchNewQuote = async () => {
    if (loadingQuote) return;
    setLoadingQuote(true);
    try {
        // 1. Chiedi a Gemini una NUOVA citazione
        const newQuote = await generateInspirationalQuote();
        
        if (newQuote) {
            // 2. Salvala nel DB (gestisce deduplica e limite 50)
            await db.saveQuote(newQuote);
            
            // 3. Aggiorna la UI
            setQuote(newQuote);
        } else {
            // Fallback: se AI fallisce, prova a prenderne una a caso dal DB se ce ne sono
            if (!quote) {
                 const dbQuote = await db.getRandomQuote();
                 if (dbQuote) setQuote(dbQuote);
            }
        }
    } catch (e) {
        console.error("Errore recupero citazione", e);
    } finally {
        setLoadingQuote(false);
    }
  };

  const handleHeartClick = () => {
      if (currentUser) {
          onToggleFavorites();
      } else {
          onLoginClick();
      }
  };

  return (
    <header className="sticky top-0 z-40 shadow-lg shadow-orange-500/20 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto flex flex-col items-stretch">
        
        {/* Riga Superiore: Logo, Citazione Desktop, Utente */}
        <div className="flex items-center justify-between gap-4 py-3">
            {/* LOGO & SOLE INTERATTIVO */}
            <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
              <Tooltip content="Clicca per una nuova ispirazione!" position="bottom">
                <button 
                    onClick={fetchNewQuote}
                    disabled={loadingQuote}
                    className="group relative flex-shrink-0 outline-none"
                >
                    <div className={`w-10 h-10 md:w-12 md:h-12 text-yellow-100 transition-transform duration-700 ease-in-out ${loadingQuote ? 'animate-[spin_1s_linear_infinite]' : 'group-hover:rotate-45'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-md">
                            <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
                        </svg>
                    </div>
                </button>
              </Tooltip>
              
              <div className="flex flex-col">
                <h1 className="font-display font-bold text-xl md:text-2xl tracking-tight leading-none text-white drop-shadow-sm">
                  Buon Umore
                </h1>
                <span className="text-[9px] md:text-[10px] text-orange-100 uppercase tracking-widest font-medium opacity-90">
                    Notizie Positive
                </span>
              </div>
            </div>

            {/* CITAZIONE CENTRALE (Desktop) */}
            <div className="flex-1 px-4 md:px-12 text-center hidden md:block">
                <div className="relative inline-block max-w-xl">
                    <p className={`font-display italic text-lg text-white/95 leading-snug transition-opacity duration-500 ${loadingQuote ? 'opacity-50' : 'opacity-100'}`}>
                       "{quote ? quote.text : "Cose belle stanno per accadere..."}"
                    </p>
                </div>
                {!loadingQuote && quote && quote.author && (
                    <p className="text-xs text-orange-100 mt-1 font-medium tracking-wide animate-in fade-in">
                        — {quote.author}
                    </p>
                )}
            </div>

            {/* AREA UTENTE */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <Tooltip content={currentUser ? (showFavoritesOnly ? "Mostra tutte" : "I miei salvati") : "Accedi"}>
                  <button 
                    onClick={handleHeartClick}
                    className={`group p-2 rounded-full transition-all duration-300 border-2 ${
                      showFavoritesOnly && currentUser
                        ? 'bg-white text-rose-500 border-white shadow-inner' 
                        : 'bg-white/10 text-white border-transparent hover:bg-white/20'
                    }`}
                  >
                    <IconHeart filled={showFavoritesOnly && !!currentUser} className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
              </Tooltip>

              {currentUser ? (
                <>
                  <div className="flex items-center pl-1 pr-2 py-1 bg-black/10 backdrop-blur-sm rounded-full border border-white/20">
                    <img src={currentUser.avatar} alt="avatar" className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white/60" />
                  </div>
                  
                  <button onClick={onLogout} className="text-white/80 hover:text-white p-2 hidden md:block">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  </button>
                </>
              ) : (
                <button onClick={onLoginClick} className="bg-white text-orange-600 px-4 py-1.5 rounded-full font-bold text-xs md:text-sm transition shadow-lg">
                  Entra
                </button>
              )}
            </div>
        </div>
        
        {/* Citazione Mobile: Spostata qui per essere visibile ed evitare sovrapposizioni */}
        <div className="md:hidden pb-3 pt-1 px-2">
            <div className={`bg-white/10 backdrop-blur-sm rounded-xl py-2.5 px-4 text-center border border-white/10 transition-all duration-500 ${loadingQuote ? 'opacity-50 animate-pulse' : 'opacity-100'}`}>
                <p className="text-xs italic text-white leading-relaxed">
                    "{quote ? quote.text : "Lasciati ispirare dal sole..."}"
                </p>
                {quote?.author && !loadingQuote && (
                    <p className="text-[9px] text-orange-100 font-bold uppercase mt-1 opacity-80 tracking-widest">— {quote.author}</p>
                )}
            </div>
        </div>
      </div>
    </header>
  );
};
