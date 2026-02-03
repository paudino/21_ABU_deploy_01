
import React, { useState, useEffect } from 'react';
import { User, Quote, Theme } from '../types';
import { IconHeart, IconSun, IconMoon, IconContrast, IconType, IconSettings } from './Icons';
import { db } from '../services/dbService';
import { generateInspirationalQuote } from '../services/geminiService';
import { Tooltip } from './Tooltip';

interface HeaderProps {
  currentUser: User | null;
  showFavoritesOnly: boolean;
  theme: Theme;
  isReadableFont: boolean;
  onToggleFavorites: () => void;
  onLogout: () => void;
  onLoginClick: () => void;
  onSetTheme: (theme: Theme) => void;
  onToggleReadableFont: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentUser, 
  showFavoritesOnly,
  theme,
  isReadableFont,
  onToggleFavorites, 
  onLogout, 
  onLoginClick,
  onSetTheme,
  onToggleReadableFont
}) => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadInitialQuote();
  }, []);

  const loadInitialQuote = async () => {
      const q = await db.getRandomQuote();
      if (q) setQuote(q);
      else fetchNewQuote();
  };

  const fetchNewQuote = async () => {
    if (loadingQuote) return;
    setLoadingQuote(true);
    try {
        const newQuote = await generateInspirationalQuote();
        if (newQuote) {
            await db.saveQuote(newQuote);
            setQuote(newQuote);
        } else {
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

  const getHeaderGradient = () => {
    switch (theme) {
      case 'evening': return 'from-slate-900 via-indigo-900 to-amber-900';
      case 'accessible': return 'from-black via-black to-black border-b border-yellow-400';
      default: return 'from-amber-500 via-orange-500 to-rose-500';
    }
  };

  return (
    <header className={`sticky top-0 z-[60] shadow-lg transition-all duration-500 ${theme === 'accessible' ? '' : 'shadow-orange-500/20'} bg-gradient-to-r ${getHeaderGradient()} text-white`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto flex flex-col items-stretch">
        
        <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
              <Tooltip content="Nuova ispirazione!" position="bottom">
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
                <span className={`text-[9px] md:text-[10px] uppercase tracking-widest font-medium opacity-90 ${theme === 'accessible' ? 'text-yellow-400' : 'text-orange-100'}`}>
                    Notizie Positive
                </span>
              </div>
            </div>

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

            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              {/* Menu Impostazioni */}
              <div className="relative">
                <Tooltip content="Vista & Leggibilità" position="bottom">
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 rounded-full transition-all duration-300 bg-white/10 border-2 ${showSettings ? 'bg-white/30 border-white' : 'border-transparent hover:bg-white/20'}`}
                  >
                    <IconSettings className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </Tooltip>

                {showSettings && (
                  <div className="absolute top-14 right-0 bg-white text-slate-800 shadow-2xl rounded-2xl p-4 w-64 z-[70] border border-slate-100 animate-in fade-in slide-in-from-top-2 origin-top-right">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Personalizza Vista</h4>
                    
                    {/* Switch Temi */}
                    <div className="space-y-2 mb-6">
                      <p className="text-[10px] font-bold text-slate-500 ml-1">TEMA</p>
                      <div className="flex bg-slate-100 rounded-xl p-1">
                        <button 
                          onClick={() => onSetTheme('sunshine')}
                          className={`flex-1 py-2 flex items-center justify-center rounded-lg transition-all ${theme === 'sunshine' ? 'bg-white shadow-sm text-joy-500' : 'text-slate-400'}`}
                        >
                          <IconSun className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onSetTheme('evening')}
                          className={`flex-1 py-2 flex items-center justify-center rounded-lg transition-all ${theme === 'evening' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                        >
                          <IconMoon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onSetTheme('accessible')}
                          className={`flex-1 py-2 flex items-center justify-center rounded-lg transition-all ${theme === 'accessible' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                        >
                          <IconContrast className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Toggle Font */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 ml-1 uppercase">Leggibilità</p>
                      <button 
                        onClick={onToggleReadableFont}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${isReadableFont ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                      >
                        <div className="flex items-center gap-2">
                          <IconType className="w-4 h-4" />
                          <span className="text-xs font-bold">Font Alta Leggibilità</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${isReadableFont ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isReadableFont ? 'left-4.5' : 'left-0.5'}`}></div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Tooltip content={currentUser ? (showFavoritesOnly ? "Mostra tutte" : "I miei salvati") : "Accedi"} position="bottom">
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
                <button onClick={onLoginClick} className={`px-4 py-1.5 rounded-full font-bold text-xs md:text-sm transition shadow-lg ${theme === 'accessible' ? 'bg-yellow-400 text-black' : 'bg-white text-orange-600'}`}>
                  Entra
                </button>
              )}
            </div>
        </div>
        
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
