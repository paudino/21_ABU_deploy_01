
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
    <header className={`sticky top-0 z-[60] shadow-lg transition-all duration-500 bg-gradient-to-r ${getHeaderGradient()} text-white overflow-visible`}>
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        
        <div className="flex items-center justify-between gap-2 py-2 md:py-3">
            {/* Logo e Sole */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Tooltip content="Nuova ispirazione!" position="bottom">
                <button 
                    onClick={fetchNewQuote}
                    disabled={loadingQuote}
                    className="outline-none"
                >
                    <div className={`w-9 h-9 md:w-11 md:h-11 text-yellow-100 transition-transform duration-700 ${loadingQuote ? 'animate-spin' : 'hover:rotate-45'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-md">
                            <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
                        </svg>
                    </div>
                </button>
              </Tooltip>
              
              <div className="flex flex-col">
                <h1 className="font-display font-bold text-lg md:text-2xl tracking-tight leading-none text-white">
                  Buon Umore
                </h1>
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest font-medium opacity-80">
                    Notizie Positive
                </span>
              </div>
            </div>

            {/* Citazione Desktop */}
            <div className="flex-1 px-4 text-center hidden lg:block">
                <p className={`font-display italic text-base text-white/90 line-clamp-1 transition-opacity ${loadingQuote ? 'opacity-50' : 'opacity-100'}`}>
                   "{quote ? quote.text : "Cose belle stanno per accadere..."}"
                </p>
            </div>

            {/* Azioni Destra */}
            <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 md:p-2 rounded-full transition-all bg-white/10 border ${showSettings ? 'bg-white/30 border-white' : 'border-transparent hover:bg-white/20'}`}
                >
                  <IconSettings className="w-5 h-5" />
                </button>

                {showSettings && (
                  <div className="absolute top-12 right-0 bg-white text-slate-800 shadow-2xl rounded-2xl p-4 w-56 z-[70] border border-slate-100 animate-in fade-in slide-in-from-top-2 origin-top-right">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Impostazioni</h4>
                    <div className="space-y-4">
                      <div className="flex bg-slate-100 rounded-lg p-1">
                        <button onClick={() => onSetTheme('sunshine')} className={`flex-1 py-1.5 flex items-center justify-center rounded ${theme === 'sunshine' ? 'bg-white shadow text-joy-500' : 'text-slate-400'}`}><IconSun className="w-4 h-4"/></button>
                        <button onClick={() => onSetTheme('evening')} className={`flex-1 py-1.5 flex items-center justify-center rounded ${theme === 'evening' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><IconMoon className="w-4 h-4"/></button>
                        <button onClick={() => onSetTheme('accessible')} className={`flex-1 py-1.5 flex items-center justify-center rounded ${theme === 'accessible' ? 'bg-white shadow text-black' : 'text-slate-400'}`}><IconContrast className="w-4 h-4"/></button>
                      </div>
                      <button onClick={onToggleReadableFont} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-bold ${isReadableFont ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200'}`}>
                        <span>Font Leggibile</span>
                        <div className={`w-6 h-3 rounded-full relative transition-colors ${isReadableFont ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                          <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${isReadableFont ? 'left-3.5' : 'left-0.5'}`}></div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handleHeartClick}
                className={`p-1.5 md:p-2 rounded-full transition-all border ${showFavoritesOnly && currentUser ? 'bg-white text-rose-500 border-white shadow-inner' : 'bg-white/10 text-white border-transparent hover:bg-white/20'}`}
              >
                <IconHeart filled={showFavoritesOnly && !!currentUser} className="w-5 h-5" />
              </button>

              {currentUser ? (
                <div className="flex items-center gap-1.5 bg-black/10 backdrop-blur-sm rounded-full border border-white/20 p-0.5 pr-2">
                  <img src={currentUser.avatar} alt="avatar" className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-white/40" />
                  <button onClick={onLogout} className="text-white/60 hover:text-white transition-colors ml-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  </button>
                </div>
              ) : (
                <button onClick={onLoginClick} className={`px-4 py-1.5 rounded-full font-bold text-xs transition shadow-md whitespace-nowrap ${theme === 'accessible' ? 'bg-yellow-400 text-black' : 'bg-white text-orange-600 hover:bg-orange-50'}`}>
                  Entra
                </button>
              )}
            </div>
        </div>
      </div>
    </header>
  );
};
