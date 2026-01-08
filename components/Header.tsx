
import React, { useState, useEffect } from 'react';
import { User, Quote } from '../types';
import { IconHeart, IconRefresh } from './Icons';
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

// Removed conflicting local 'declare global' block to resolve identical modifiers and type mismatch errors.
// We will access window.aistudio using type casting at call sites.

export const Header: React.FC<HeaderProps> = ({ 
  currentUser, 
  showFavoritesOnly, 
  onToggleFavorites, 
  onLogout, 
  onLoginClick 
}) => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    checkApiKey();
    const timer = setTimeout(() => {
        loadInitialQuote();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const checkApiKey = async () => {
      try {
          // Access aistudio via any cast to bypass global declaration conflicts
          const aistudio = (window as any).aistudio;
          if (aistudio) {
              const has = await aistudio.hasSelectedApiKey();
              setHasApiKey(has || !!process.env.API_KEY);
          } else {
              setHasApiKey(!!process.env.API_KEY);
          }
      } catch (e) {
          setHasApiKey(!!process.env.API_KEY);
      }
  };

  const handleActivateAI = async () => {
      // Access aistudio via any cast to bypass global declaration conflicts
      const aistudio = (window as any).aistudio;
      if (aistudio) {
          await aistudio.openSelectKey();
          setHasApiKey(true);
          // Riprova a caricare la citazione dopo l'attivazione
          loadInitialQuote();
      }
  };

  const loadInitialQuote = async () => {
      const q = await db.getRandomQuote();
      if (q) setQuote(q);
      else if (hasApiKey) fetchNewQuote();
  };

  const fetchNewQuote = async () => {
    if (loadingQuote || !hasApiKey) return;
    setLoadingQuote(true);
    try {
        const newQuote = await generateInspirationalQuote();
        if (newQuote) {
            await db.saveQuote(newQuote);
            setQuote(newQuote);
        } else if (!quote) {
             const dbQuote = await db.getRandomQuote();
             if (dbQuote) setQuote(dbQuote);
        }
    } catch (e) {
        console.error("Errore recupero citazione", e);
    } finally {
        setLoadingQuote(false);
    }
  };

  const handleHeartClick = () => {
      if (currentUser) onToggleFavorites();
      else onLoginClick();
  };

  return (
    <header className="sticky top-0 z-40 shadow-lg shadow-orange-500/20 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto min-h-[5rem] py-2 flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-4 self-start md:self-center">
          <Tooltip content={hasApiKey ? "Clicca per una nuova ispirazione!" : "Attiva AI per citazioni live"} position="bottom">
            <button 
                onClick={hasApiKey ? fetchNewQuote : handleActivateAI}
                disabled={loadingQuote}
                className="group relative flex-shrink-0 outline-none"
            >
                <div className={`w-12 h-12 text-yellow-100 transition-transform duration-700 ease-in-out ${loadingQuote ? 'animate-[spin_1s_linear_infinite]' : 'group-hover:rotate-45'} ${!hasApiKey ? 'opacity-50' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-md">
                        <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
                    </svg>
                </div>
            </button>
          </Tooltip>
          
          <div className="flex flex-col">
            <h1 className="font-display font-bold text-2xl tracking-tight leading-none text-white drop-shadow-sm">
              L'angolo del Buon Umore
            </h1>
            <span className="text-[10px] text-orange-100 uppercase tracking-[0.2em] font-medium opacity-90">
                Solo Notizie Positive
            </span>
          </div>
        </div>

        <div className="flex-1 px-4 md:px-12 text-center hidden md:block">
            <div className="relative inline-block max-w-xl">
                <span className="absolute -top-4 -left-2 text-4xl text-white/30 font-serif leading-none">“</span>
                <p className={`font-display italic text-lg text-white/95 leading-snug transition-opacity duration-500 ${loadingQuote ? 'opacity-0' : 'opacity-100'}`}>
                   {quote ? quote.text : (hasApiKey ? "Cercando ispirazione per te..." : "Attiva l'AI per iniziare la giornata con un sorriso.")}
                </p>
                <span className="absolute -bottom-4 -right-2 text-4xl text-white/30 font-serif leading-none">”</span>
            </div>
            {!loadingQuote && quote && quote.author && (
                <p className="text-xs text-orange-100 mt-1 font-medium tracking-wide animate-in fade-in">
                    — {quote.author}
                </p>
            )}
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          {!hasApiKey && (
              <button 
                onClick={handleActivateAI}
                className="bg-yellow-400 text-slate-900 px-4 py-2 rounded-full font-bold text-xs hover:bg-yellow-300 transition animate-pulse shadow-lg"
              >
                Attiva AI 🚀
              </button>
          )}

          <Tooltip content={currentUser ? (showFavoritesOnly ? "Mostra tutte le notizie" : "Vedi i miei salvati") : "Accedi per vedere i preferiti"}>
              <button 
                onClick={handleHeartClick}
                className={`group p-2 rounded-full transition-all duration-300 border-2 ${
                  showFavoritesOnly && currentUser
                    ? 'bg-white text-rose-500 border-white shadow-inner' 
                    : 'bg-white/10 text-white border-transparent hover:bg-white/20'
                }`}
              >
                <IconHeart filled={showFavoritesOnly && !!currentUser} className={showFavoritesOnly && !!currentUser ? "animate-pulse" : "group-hover:scale-110 transition"} />
              </button>
          </Tooltip>

          {currentUser ? (
            <>
              <div className="flex items-center pl-1 pr-3 py-1 bg-black/10 backdrop-blur-sm rounded-full border border-white/20">
                <img src={currentUser.avatar} alt="avatar" className="w-8 h-8 rounded-full border-2 border-white/60 shadow-sm" />
                <div className="ml-2 flex flex-col text-left hidden lg:flex">
                    <span className="text-xs text-orange-100 uppercase font-bold tracking-wider">Ciao,</span>
                    <span className="text-sm font-bold leading-none">{currentUser.username}</span>
                </div>
              </div>
              <Tooltip content="Disconnetti">
                  <button onClick={onLogout} className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                  </button>
              </Tooltip>
            </>
          ) : (
            <button onClick={onLoginClick} className="bg-white text-orange-600 px-5 py-2 rounded-full font-bold text-sm hover:bg-orange-50 transition shadow-lg shadow-black/10 transform hover:-translate-y-0.5">
              Accedi
            </button>
          )}
        </div>
      </div>
      
      <div className="md:hidden bg-black/10 px-4 py-3 text-center border-t border-white/10">
          <p className="text-sm italic text-white/90">
              "{quote ? quote.text : (hasApiKey ? "Un momento di riflessione..." : "Attiva l'AI dalla barra in alto.")}"
          </p>
      </div>
    </header>
  );
};
