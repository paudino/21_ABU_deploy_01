// Fix: Change named import { React } to default import React
import React, { useEffect } from 'react';
import { Article, User } from '../types';
import { IconHeart, IconRefresh, IconX } from './Icons';
import { generateArticleImage } from '../services/geminiService';
import { db } from '../services/dbService';
import { Tooltip } from './Tooltip';

interface ArticleListProps {
  articles: Article[];
  loading: boolean;
  activeCategoryLabel?: string;
  showFavoritesOnly: boolean;
  favoriteIds: Set<string>; 
  currentUser?: User | null; 
  onArticleClick: (article: Article) => void;
  onRefresh: () => void;
  onImageGenerated?: (url: string, img: string) => void;
  onToggleFavorite?: (article: Article) => void;
  notification?: string | null; 
  onCloseFavorites?: () => void; 
}

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateString;
};

export const ArticleList: React.FC<ArticleListProps> = ({
  articles,
  loading,
  activeCategoryLabel,
  showFavoritesOnly,
  favoriteIds,
  currentUser,
  onArticleClick,
  onRefresh,
  onImageGenerated,
  onToggleFavorite,
  notification,
  onCloseFavorites
}) => {

  useEffect(() => {
    if (loading || showFavoritesOnly || articles.length === 0) return;

    let isMounted = true;

    const generateImagesSequentially = async () => {
        const articlesNeedingImage = articles.filter(a => !a.imageUrl);
        
        for (const article of articlesNeedingImage) {
            if (!isMounted) break;
            
            try {
                const newImg = await generateArticleImage(article.title);
                if (newImg && isMounted) {
                    await db.updateArticleImage(article.url, newImg);
                    if (onImageGenerated) onImageGenerated(article.url, newImg);
                }
                // Aspetta 5 secondi tra un'immagine e l'altra (Max 12 RPM)
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (e) {
                console.error("Errore generazione immagine sequenziale:", e);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    };

    // Aspetta 8 secondi prima di iniziare a generare immagini (lascia finire News/Quote/Deed)
    const timer = setTimeout(generateImagesSequentially, 8000);
    return () => { 
        isMounted = false;
        clearTimeout(timer); 
    };
  }, [articles, loading, showFavoritesOnly]);

  const showSkeletons = loading && articles.length === 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8 bg-white/60 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-white/50">
        <div>
           {showFavoritesOnly ? (
               <div className="flex items-center gap-3">
                   <h2 className="text-2xl md:text-3xl font-display font-serif font-bold text-slate-800 tracking-tight">
                      <span className="text-red-500 mr-2">♥</span>
                      I tuoi preferiti
                   </h2>
                   {onCloseFavorites && (
                       <button onClick={onCloseFavorites} className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-2 rounded-full transition"><IconX className="w-5 h-5" /></button>
                   )}
               </div>
           ) : (
               <h2 className="text-2xl md:text-3xl font-display font-serif font-bold text-slate-800 tracking-tight">
                  <span className="text-joy-500 mr-2">☀</span>
                  {activeCategoryLabel || 'Notizie'}
               </h2>
           )}
        </div>
        
        {!showFavoritesOnly && (
          <Tooltip content="Cerca nuove notizie" position="top">
            <button 
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-2 text-joy-700 hover:text-white disabled:opacity-50 font-bold bg-white border border-joy-200 px-5 py-2.5 rounded-xl hover:bg-joy-500 hover:border-joy-500 hover:shadow-lg transition-all duration-300 group"
            >
                <div className={`transition-transform duration-700 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`}><IconRefresh /></div>
                <span className="font-sans">{loading ? 'Ricerca...' : 'Aggiorna'}</span>
            </button>
          </Tooltip>
        )}
      </div>

      {notification && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-center justify-center gap-2 animate-in slide-in-from-top-4 fade-in">
              <span className="font-medium font-sans">{notification}</span>
          </div>
      )}

      {showSkeletons ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/80 rounded-2xl overflow-hidden shadow-sm border border-white h-96 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {articles.length === 0 ? (
              <div className="text-center py-24 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300/50 mx-auto max-w-2xl">
                <div className="text-6xl mb-4">🌤️</div>
                <h3 className="text-xl font-display font-serif font-bold text-slate-700 mb-2">{showFavoritesOnly ? "Nessun preferito" : "In attesa di buone nuove"}</h3>
                <p className="text-slate-500 text-lg mb-6 font-body font-sans">Nessuna notizia trovata. Prova ad aggiornare!</p>
              </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12 transition-opacity duration-300 ${loading ? 'opacity-70 grayscale-[30%]' : 'opacity-100'}`}>
              {articles.map((article, idx) => {
                const isFav = showFavoritesOnly ? true : (article.id ? favoriteIds.has(article.id) : false);
                return (
                  <div 
                    key={`${article.url}-${idx}`} 
                    onClick={() => onArticleClick(article)}
                    className={`group bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col h-full ${article.isNew ? 'border-2 border-emerald-500' : 'border border-white/60'}`}
                  >
                    <div className="h-48 bg-slate-100 rounded-t-2xl overflow-hidden relative">
                        <img 
                          src={article.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(article.title)}/600/400`} 
                          alt={article.title} 
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                          loading="lazy"
                        />
                        <div className="absolute top-3 right-3 bg-white/95 px-3 py-1 rounded-full text-xs font-bold text-brand-600 shadow-md">{(article.sentimentScore * 100).toFixed(0)}% Positivo</div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-3 uppercase font-sans">
                        <span className="bg-slate-100 px-2 py-1 rounded-md">{article.source}</span>
                        <span>{formatDate(article.date)}</span>
                      </div>
                      <h3 className="text-xl font-display font-bold text-slate-900 mb-3 leading-snug group-hover:text-joy-600 transition-colors">{article.title}</h3>
                      <p className="text-slate-600 line-clamp-3 mb-5 flex-1 text-sm font-sans">{article.summary}</p>
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                           <Tooltip content={isFav ? "Rimuovi" : "Salva"}>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   if (onToggleFavorite && currentUser) onToggleFavorite(article);
                                 }}
                                 className={`p-2 rounded-full transition-all ${isFav ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:bg-slate-50'}`}
                               >
                                 <IconHeart filled={isFav} className="w-5 h-5" />
                               </button>
                           </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
};
