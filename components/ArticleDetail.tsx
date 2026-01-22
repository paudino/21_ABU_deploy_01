
// Fix: React is the default export from the 'react' package, so it must not be imported within curly braces.
import React, { useState, useEffect, useRef } from 'react';
import { Article, User, Comment } from '../types';
import { db } from '../services/dbService';
import { IconHeart, IconThumbUp, IconThumbDown, IconX, IconExternalLink, IconMessage, IconTrash, IconCheck } from './Icons';
import { AudioPlayer } from './AudioPlayer';
import { Tooltip } from './Tooltip';

interface ArticleDetailProps {
  article: Article;
  currentUser: User | null;
  isFavorite: boolean; 
  onClose: () => void;
  onLoginRequest: () => void;
  onToggleFavorite: (article: Article) => void; 
  onUpdate?: (article: Article) => void; 
}

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateString;
};

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ 
  article, currentUser, isFavorite, onClose, onLoginRequest, onToggleFavorite, onUpdate 
}) => {
  // Stati Contatori (Globali - visibili a tutti)
  const [likeCount, setLikeCount] = useState(article.likeCount || 0);
  const [dislikeCount, setDislikeCount] = useState(article.dislikeCount || 0);

  // Stati Utente (Se ha votato)
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [userHasDisliked, setUserHasDisliked] = useState(false);
  
  // Stati Commenti
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Stato per gestire quale commento è in fase di cancellazione
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Ref per tenere traccia dell'ID articolo (potrebbe essere creato al volo)
  const articleIdRef = useRef<string | undefined>(article.id);
  const loadingRef = useRef(false);
  const initialSyncDone = useRef(false);

  // Helper per aggiornare il padre (ArticleList)
  const updateParent = (id: string, lCount: number, dCount: number) => {
      if (onUpdate) {
          onUpdate({
              ...article,
              id: id,
              likeCount: lCount,
              dislikeCount: dCount
          });
      }
  };

  // 1. CARICAMENTO DATI INIZIALI
  useEffect(() => {
    const loadInteractionData = async () => {
      if (!articleIdRef.current) return;
      
      const id = articleIdRef.current;
      
      try {
        // A) Carica Contatori Globali dal Database (per tutti)
        const [lCount, dCount] = await Promise.all([
           db.getLikeCount(id),
           db.getDislikeCount(id)
        ]);
        
        setLikeCount(lCount);
        setDislikeCount(dCount);
        
        // SINCRONIZZAZIONE CON IL GENITORE (solo se i dati differiscono)
        if (!initialSyncDone.current && (lCount !== article.likeCount || dCount !== article.dislikeCount)) {
            updateParent(id, lCount, dCount);
            initialSyncDone.current = true;
        }
        
        // B) Carica Stato Utente (Solo se loggato)
        if (currentUser) {
          const [liked, disliked] = await Promise.all([
            db.hasUserLiked(id, currentUser.id),
            db.hasUserDisliked(id, currentUser.id)
          ]);
          setUserHasLiked(liked);
          setUserHasDisliked(disliked);
        }

        // C) Carica Commenti
        loadComments(id);

      } catch (error) {
        console.error("[LOGICA-VOTO] Errore caricamento:", error);
      }
    };

    loadInteractionData();
  }, [article.id, currentUser, article.likeCount, article.dislikeCount]); 

  const loadComments = async (artId: string) => {
      setLoadingComments(true);
      try {
          const list = await db.getComments(artId);
          setComments(list);
      } catch (e) {
          console.error("Errore loading commenti", e);
      } finally {
          setLoadingComments(false);
      }
  };

  // Helper: Assicura che l'articolo abbia un ID nel DB
  const ensureArticleSaved = async (): Promise<string | null> => {
      if (articleIdRef.current) return articleIdRef.current;
      try {
          const saved = await db.saveArticles(article.category || 'Generale', [article]);
          if (saved && saved.length > 0) {
              const newId = saved[0].id;
              articleIdRef.current = newId; 
              return newId || null;
          }
      } catch (e) {
          console.error("[LOGICA-VOTO] Errore salvataggio:", e);
      }
      return null;
  };

  // --- GESTIONE LIKE ---
  const handleLike = async () => {
      if (!currentUser) {
          onLoginRequest();
          return;
      }

      if (loadingRef.current) return;
      loadingRef.current = true;

      const wasLiked = userHasLiked;
      const wasDisliked = userHasDisliked;
      const newLikedState = !wasLiked;

      // Aggiornamento Ottimistico UI Locale
      setUserHasLiked(newLikedState);
      setLikeCount(prev => newLikedState ? prev + 1 : Math.max(0, prev - 1));
      if (newLikedState && wasDisliked) {
          setUserHasDisliked(false);
          setDislikeCount(prev => Math.max(0, prev - 1));
      }

      try {
          const targetId = await ensureArticleSaved();
          if (!targetId) throw new Error("Impossibile ottenere ID articolo");

          const resultIsLiked = await db.toggleLike(targetId, currentUser.id);
          
          const [realLikeCount, realDislikeCount] = await Promise.all([
             db.getLikeCount(targetId),
             db.getDislikeCount(targetId)
          ]);

          setLikeCount(realLikeCount);
          setDislikeCount(realDislikeCount);
          setUserHasLiked(resultIsLiked);
          if (resultIsLiked) setUserHasDisliked(false);

          updateParent(targetId, realLikeCount, realDislikeCount);
      } catch (error) {
          console.error("[LOGICA-VOTO] ERRORE Like:", error);
          setUserHasLiked(wasLiked);
          setUserHasDisliked(wasDisliked);
          setLikeCount(article.likeCount || 0);
          setDislikeCount(article.dislikeCount || 0);
      } finally {
          loadingRef.current = false;
      }
  };

  // --- GESTIONE DISLIKE ---
  const handleDislike = async () => {
      if (!currentUser) {
          onLoginRequest();
          return;
      }

      if (loadingRef.current) return;
      loadingRef.current = true;

      const wasDisliked = userHasDisliked;
      const wasLiked = userHasLiked;
      const newDislikedState = !wasDisliked;
      
      setUserHasDisliked(newDislikedState);
      setDislikeCount(prev => newDislikedState ? prev + 1 : Math.max(0, prev - 1));
      if (newDislikedState && wasLiked) {
          setUserHasLiked(false);
          setLikeCount(prev => Math.max(0, prev - 1));
      }

      try {
          const targetId = await ensureArticleSaved();
          if (!targetId) throw new Error("Impossibile ottenere ID articolo");

          const resultIsDisliked = await db.toggleDislike(targetId, currentUser.id);

          const [realLikeCount, realDislikeCount] = await Promise.all([
             db.getLikeCount(targetId),
             db.getDislikeCount(targetId)
          ]);

          setLikeCount(realLikeCount);
          setDislikeCount(realDislikeCount);
          setUserHasDisliked(resultIsDisliked);
          if (resultIsDisliked) setUserHasLiked(false);

          updateParent(targetId, realLikeCount, realDislikeCount);
      } catch (error) {
          console.error("[LOGICA-VOTO] ERRORE Dislike:", error);
          setUserHasDisliked(wasDisliked);
          setUserHasLiked(wasLiked);
          setLikeCount(article.likeCount || 0);
          setDislikeCount(article.dislikeCount || 0);
      } finally {
          loadingRef.current = false;
      }
  };

  // --- GESTIONE COMMENTI ---
  const handlePostComment = async () => {
      if (!newComment.trim()) return;
      if (!currentUser) {
          onLoginRequest();
          return;
      }
      setSubmittingComment(true);
      try {
          const targetId = await ensureArticleSaved();
          if (!targetId) throw new Error("ID mancante");

          const addedComment = await db.addComment(targetId, currentUser, newComment.trim());
          setComments([addedComment, ...comments]);
          setNewComment('');
      } catch (e) {
          console.error("Errore invio commento", e);
      } finally {
          setSubmittingComment(false);
      }
  };

  const performDeleteComment = async (commentId: string) => {
      if (!currentUser) return;
      setDeletingCommentId(null);
      const prevComments = [...comments];
      setComments(prev => prev.filter(c => c.id !== commentId));
      try {
          await db.deleteComment(commentId, currentUser.id);
      } catch (e) {
          console.error("Errore cancellazione", e);
          setComments(prevComments); 
      }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto backdrop-blur-md p-0 md:p-8 animate-in fade-in">
      <div className="bg-white md:max-w-4xl mx-auto md:rounded-2xl shadow-2xl overflow-hidden min-h-[100vh] md:min-h-[80vh] flex flex-col relative">
        <div className="absolute top-4 right-4 z-10">
            <button onClick={onClose} className="bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition"><IconX /></button>
        </div>
        
        {/* Immagine Header */}
        <div className="relative h-64 md:h-96 w-full bg-slate-200">
          <img src={article.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(article.title)}/600/400`} className="w-full h-full object-cover" alt={article.title} />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 p-6 pt-24">
            <h1 className="text-2xl md:text-4xl font-bold text-white">{article.title}</h1>
          </div>
        </div>

        <div className="p-6 md:p-10 flex-1 flex flex-col md:flex-row gap-10">
          <div className="flex-1">
            <div className="flex flex-wrap items-center text-sm text-slate-500 mb-6 gap-x-4">
               <span className="bg-slate-100 px-2 py-1 rounded">Fonte: {article.source}</span>
               <span>{formatDate(article.date)}</span>
            </div>
            
            <AudioPlayer 
                articleTitle={article.title}
                articleSummary={article.summary}
                articleUrl={article.url}
                initialAudioBase64={article.audioBase64}
                canPlay={!!currentUser}
            />

            <p className="text-lg text-slate-700 leading-relaxed mb-6">{article.summary}</p>
            
            <div className="mb-6">
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-joy-600 font-bold hover:text-joy-700 hover:underline transition-colors">
                    Leggi l'articolo completo <IconExternalLink className="w-4 h-4" />
                </a>
            </div>

            {/* SEZIONE INTERAZIONE */}
            <div className="flex flex-wrap items-center gap-4 border-t border-b py-6 mb-8">
              <Tooltip content={currentUser ? "Mi piace" : "Accedi per votare"}>
                  <button 
                    onClick={handleLike}
                    className={`
                        flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 transform border
                        ${currentUser ? 'active:scale-95 cursor-pointer' : 'cursor-default opacity-80'}
                        ${userHasLiked 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm ring-1 ring-emerald-100' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600'
                        }
                    `}
                  >
                      <IconThumbUp filled={userHasLiked} className={userHasLiked ? "scale-110" : ""} />
                      <span className="font-bold">{likeCount}</span>
                  </button>
              </Tooltip>

              <Tooltip content={currentUser ? "Non mi piace" : "Accedi per votare"}>
                  <button 
                    onClick={handleDislike}
                    className={`
                        flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 transform border
                        ${currentUser ? 'active:scale-95 cursor-pointer' : 'cursor-default opacity-80'}
                        ${userHasDisliked 
                            ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm ring-1 ring-orange-100' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-orange-50 hover:text-orange-600'
                        }
                    `}
                  >
                      <IconThumbDown filled={userHasDisliked} className={userHasDisliked ? "scale-110" : ""} />
                      <span className="font-bold">{dislikeCount}</span>
                  </button>
              </Tooltip>
              
              <div className="w-px h-8 bg-slate-200 mx-2"></div>

              <Tooltip content={currentUser ? (isFavorite ? "Rimuovi dai preferiti" : "Salva nei preferiti") : "Accedi per salvare nei preferiti"}>
                  <button 
                    onClick={() => currentUser ? onToggleFavorite(article) : onLoginRequest()} 
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full transition transform active:scale-95 border ${
                        isFavorite 
                            ? 'bg-amber-50 text-amber-500 border-amber-200' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-500'
                    }`}
                  >
                      <IconHeart filled={isFavorite} />
                      <span>{isFavorite ? 'Salvato' : 'Salva'}</span>
                  </button>
              </Tooltip>
            </div>

            {/* SEZIONE COMMENTI */}
            <div>
               <h3 className="text-xl font-display font-bold text-slate-800 mb-6 flex items-center gap-2">
                   <IconMessage className="w-5 h-5 text-joy-500" />
                   Commenti
               </h3>
               
               <div className="flex gap-4 mb-8">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden">
                        {currentUser ? (
                            <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover" />
                        ) : (
                             <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">?</div>
                        )}
                    </div>
                    <div className="flex-1 relative">
                        {currentUser ? (
                            <>
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Condividi un pensiero positivo..."
                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-joy-400 focus:border-joy-400 outline-none resize-y min-h-[80px] bg-slate-50 focus:bg-white transition"
                                    disabled={submittingComment}
                                />
                                <div className="flex justify-end mt-2">
                                    <button 
                                        onClick={handlePostComment}
                                        disabled={!newComment.trim() || submittingComment}
                                        className="bg-joy-500 text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-joy-600 disabled:opacity-50 transition shadow-sm"
                                    >
                                        {submittingComment ? 'Invio...' : 'Invia'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div 
                                onClick={onLoginRequest}
                                className="w-full border border-slate-200 border-dashed rounded-xl p-4 bg-slate-50 text-slate-500 cursor-pointer hover:bg-slate-100 hover:text-joy-600 transition flex items-center justify-center gap-2"
                            >
                                <span>Effettua l'accesso per commentare</span>
                            </div>
                        )}
                    </div>
               </div>

               <div className="space-y-6">
                    {loadingComments ? (
                        <p className="text-center text-slate-400 py-4 italic">Caricamento commenti...</p>
                    ) : comments.length === 0 ? (
                        <p className="text-center text-slate-400 py-4 border border-dashed rounded-xl font-sans">Nessun commento ancora. Sii il primo!</p>
                    ) : (
                        comments.map(comment => (
                            <div key={comment.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex-shrink-0 overflow-hidden border border-indigo-100">
                                    <img 
                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} 
                                        alt={comment.username} 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 bg-white p-4 rounded-xl rounded-tl-none border border-slate-100 shadow-sm relative group">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-800 text-sm font-sans">{comment.username}</span>
                                        <span className="text-xs text-slate-400 font-sans">
                                            {new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(comment.timestamp))}
                                        </span>
                                    </div>
                                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line font-sans">{comment.text}</p>
                                    
                                    {currentUser && currentUser.id === comment.userId && (
                                        <div className="absolute bottom-3 right-3">
                                            {deletingCommentId === comment.id ? (
                                                <div className="flex items-center gap-2 bg-white shadow-sm border border-slate-100 rounded-full px-2 py-1">
                                                    <button onClick={() => performDeleteComment(comment.id)} className="text-emerald-500 hover:text-emerald-700 p-1 transition"><IconCheck className="w-4 h-4" /></button>
                                                    <button onClick={() => setDeletingCommentId(null)} className="text-red-500 hover:text-red-700 p-1 transition"><IconX className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setDeletingCommentId(comment.id)} className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-1"><IconTrash className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
