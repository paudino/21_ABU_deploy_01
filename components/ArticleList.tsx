
// Fix: React must be imported to use JSX and React.FC
import React, { useEffect, useRef } from 'react';
import { Article, User } from '../types';
import { IconHeart, IconRefresh, IconMicrophoneOn, IconMicOff, IconX, IconThumbUp, IconThumbDown, IconShare } from './Icons';
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
  onLoginRequest?: () => void;
  onShareClick?: (article: Article) => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
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
  onCloseFavorites,
  onLoginRequest,
  onShareClick
}) => {

  const generatingUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (loading || showFavoritesOnly || articles.length === 0) {
      generatingUrlsRef.current.clear();
      return;
    }

    // Generazione immagini intelligente
    const generateImages = async () => {
        // Prendiamo solo articoli che non hanno immagine e non sono già in fase di generazione
        const articlesNeedingImage = articles.filter(a => !a.imageUrl && !generatingUrlsRef.current.has(a.url));
        
        if (articlesNeedingImage.length === 0) return;

        articlesNeedingImage.forEach(async (article) => {
            generatingUrlsRef.current.add(article.url);
            try {
                const newImg = await generateArticleImage(article.title);
                if (newImg) {
                    await db.updateArticleImage(article.url, newImg);
                    if (onImageGenerated) {
                        onImageGenerated(article.url, newImg);
                    }
                }
            } catch (e) {
                console.error("Errore generazione immagine:", e);
                // In caso di errore permettiamo un nuovo tentativo in futuro rimuovendo dalla ref
                generatingUrlsRef.current.delete(article.url);
            }
        });
    };

    const timeout = setTimeout(generateImages, 2000);
    return () => clearTimeout(timeout);
  }, [articles, loading, showFavoritesOnly, onImageGenerated]);

  const showSkeletons = loading && articles.length === 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[60vh]">
        
      <div className="flex justify-between items-center mb-8 bg-white/60 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-white/50">
        <div>
           {showFavoritesOnly ? (
               <div className="flex items-center gap-3">
                   <h2 className="text-2xl md:text-3xl font-display font-serif font-bold text-slate-800 tracking-tight">
                      <span className="text-red-500 mr-2">♥</span>
                      I tuoi preferiti
                   </h2>
                   {onCloseFavorites && (
                       <button 
                         onClick={onCloseFavorites}
                         className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-2 rounded-full transition"
                         title="Torna alle notizie"
                       >
                           <IconX className="w-5 h-5" />
                       </button>
                   )}
               </div>
           ) : (
               <h2 className="text-2xl md:text-3xl font-display font-serif font-bold text-slate-800 tracking-tight">
                  <span className="text-joy-500 mr-2">☀</span>
                  {activeCategoryLabel || 'Notizie'}
               </h2>
           )}
           <p className="text-sm text-slate-500 mt-1 font-body font-sans italic">
              {showFavoritesOnly ? 'La tua collezione personale di positività.' : 'Solo buone notizie, selezionate per te.'}
           </p>
        </div>
        
        {!showFavoritesOnly && (
          <Tooltip content="Cerca nuove notizie" position="top">
            <button 
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-2 text-joy-700 hover:text-white disabled:opacity-50 font-bold bg-white border border-joy-200 px-5 py-2.5 rounded-xl hover:bg-joy-500 hover:border-joy-500 hover:shadow-lg transition-all duration-300 group"
            >
                <div className={`transition-transform duration-700 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`}>
                    <IconRefresh />
                </div>
                <span className="font-sans">{loading ? 'Ricerca...' : 'Aggiorna'}</span>
            </button>
          </Tooltip>
        )}
      </div>

      {notification && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-center justify-center gap-2 animate-in slide-in-from-top-4 fade-in">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
              </svg>
              <span className="font-medium font-sans">{notification}</span>
          </div>
      )}

      {showSkeletons ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white/80 rounded-2xl overflow-hidden shadow-sm border border-white h-96 animate-pulse">
              <div className="h-48 bg-slate-200/50"></div>
              <div className="p-6 space-y-3">
                <div className="h-6 bg-slate-200/50 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200/50 rounded w-full"></div>
                <div className="h-4 bg-slate-200/50 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {!loading && articles.length === 0 ? (
              <div className="text-center py-24 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300/50 mx-auto max-w-2xl animate-in fade-in zoom-in-95 duration-500">
                <div className="text-6xl mb-4">🌤️</div>
                <h3 className="text-xl font-display font-serif font-bold text-slate-700 mb-2">
                    {showFavoritesOnly ? "Nessun preferito ancora" : "In attesa di buone nuove"}
                </h3>
                <p className="text-slate-500 text-lg mb-6 font-body font-sans px-4">
                  {showFavoritesOnly 
                    ? "Salva le notizie che ti fanno sorridere per ritrovarle qui." 
                    : "Stiamo preparando nuove storie positive per te. Prova ad aggiornare tra un istante!"}
                </p>
                {showFavoritesOnly && onCloseFavorites && (
                  <button onClick={onCloseFavorites} className="text-joy-600 hover:text-joy-700 font-bold hover:underline font-sans">
                    Torna alle notizie
                  </button>
                )}
              </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12 transition-all duration-500 ${loading && articles.length > 0 ? 'opacity-50 grayscale-[20%]' : 'opacity-100'}`}>
              {articles.map((article, idx) => {
                const isFav = article.id ? favoriteIds.has(article.id) : false;
                
                return (
                  <div 
                    key={`${article.url}-${idx}`} 
                    onClick={() => onArticleClick(article)}
                    className={`group bg-gradient-to-br from-white via-white/95 to-indigo-50/20 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:shadow-joy-500/10 hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col h-full 
                      ${article.isNew 
                          ? 'border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] relative z-10' 
                          : 'border border-white/80'
                      }`}
                  >
                    <div className="h-48 bg-slate-100 rounded-t-2xl overflow-hidden relative">
                        <img 
                          src={article.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(article.title)}/600/400`} 
                          alt={article.title} 
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-in-out"
                          loading="lazy"
                        />
                        
                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-brand-600 shadow-md flex items-center gap-1 font-sans">
                           <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                          {(article.sentimentScore * 100).toFixed(0)}% Positivo
                        </div>

                        {article.isNew && (
                          <div className="absolute top-0 left-0 z-20">
                              <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white pl-4 pr-6 py-2 rounded-br-3xl shadow-lg shadow-emerald-900/20 flex items-center gap-2">
                                  <span className="font-bold tracking-wide text-xs font-sans">NUOVA</span>
                              </div>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end justify-center pb-4">
                            <span className="text-white font-medium border border-white/50 px-4 py-1 rounded-full bg-white/20 backdrop-blur-md font-sans">Leggi notizia</span>
                        </div>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col rounded-b-2xl">
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-3 uppercase tracking-wider font-semibold font-sans">
                        <span className="bg-slate-100 px-2 py-1 rounded-md">{article.source}</span>
                        <span>{formatDate(article.date)}</span>
                      </div>
                      <h3 className="text-xl font-display font-serif font-bold text-slate-900 mb-3 leading-snug group-hover:text-joy-600 transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-slate-600 line-clamp-3 mb-5 flex-1 text-sm leading-relaxed font-body font-sans">
                        {article.summary}
                      </p>
                      
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-400 font-sans">
                          <div className="flex items-center gap-3">
                               <Tooltip content={currentUser ? "Ascolta l'articolo (AI)" : "Accedi per abilitare l'audio"} position="top">
                                    <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full border ${currentUser ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                       {currentUser ? <IconMicrophoneOn className="w-3.5 h-3.5" /> : <IconMicOff className="w-3.5 h-3.5" />}
                                    </div>
                               </Tooltip>
                               
                               <Tooltip content={currentUser ? "Condividi questa notizia" : "Accedi per condividere"} position="top">
                                    <button 
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          if (onShareClick) onShareClick(article);
                                      }}
                                      className={`p-2 rounded-full transition-all duration-300 ${currentUser ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-300'}`}
                                    >
                                        <IconShare className="w-4 h-4" />
                                    </button>
                               </Tooltip>
                               
                               <div className="flex items-center gap-3 text-slate-400 select-none ml-1">
                                   <div className="flex items-center gap-0.5" title="Like">
                                      <IconThumbUp className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-bold">{article.likeCount || 0}</span>
                                   </div>
                                   <div className="flex items-center gap-0.5" title="Dislike">
                                      <IconThumbDown className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-bold">{article.dislikeCount || 0}</span>
                                   </div>
                               </div>
                          </div>

                           <Tooltip content={isFav ? "Rimuovi dai preferiti" : "Salva nei preferiti"} position="top" align="right">
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   if (onToggleFavorite && currentUser) onToggleFavorite(article);
                                   else if (onLoginRequest) onLoginRequest();
                                 }}
                                 className={`
                                   p-2 rounded-full transition-all duration-300 transform active:scale-90
                                   ${isFav 
                                      ? 'text-red-500 bg-red-50 hover:bg-red-100 border border-red-100' 
                                      : 'text-slate-400 hover:text-red-500 hover:bg-slate-50'
                                   }
                                 `}
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
