// Fix: React is the default export from the 'react' package
import React, { useState, useEffect, useRef } from 'react';
import { Article, User, Comment } from '../types';
import { db } from '../services/dbService';
import { IconHeart, IconThumbUp, IconThumbDown, IconX, IconExternalLink, IconMessage, IconTrash, IconCheck, IconShare } from './Icons';
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
  onShareClick?: () => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateString;
};

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ 
  article, currentUser, isFavorite, onClose, onLoginRequest, onToggleFavorite, onUpdate, onShareClick 
}) => {
  const [likeCount, setLikeCount] = useState(article.likeCount || 0);
  const [dislikeCount, setDislikeCount] = useState(article.dislikeCount || 0);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [userHasDisliked, setUserHasDisliked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const articleIdRef = useRef<string | undefined>(article.id);
  const loadingRef = useRef(false);

  useEffect(() => {
    articleIdRef.current = article.id;
  }, [article.id]);

  useEffect(() => {
    const loadData = async () => {
      let currentId = article.id; 
      if (!currentId) return;
      
      try {
        const [lCount, dCount] = await Promise.all([
           db.getLikeCount(currentId),
           db.getDislikeCount(currentId)
        ]);
        
        setLikeCount(lCount);
        setDislikeCount(dCount);
        
        if (currentUser) {
          const [liked, disliked] = await Promise.all([
            db.hasUserLiked(currentId, currentUser.id),
            db.hasUserDisliked(currentId, currentUser.id)
          ]);
          setUserHasLiked(liked);
          setUserHasDisliked(disliked);
        }
        loadComments(currentId);
      } catch (error) {
        console.error("Errore caricamento interazioni:", error);
      }
    };
    loadData();
  }, [article.id, currentUser]); 

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
          console.error("Errore salvataggio articolo:", e);
      }
      return null;
  };

  const handleLike = async () => {
      if (!currentUser) { onLoginRequest(); return; }
      if (loadingRef.current) return;
      loadingRef.current = true;

      try {
          const targetId = await ensureArticleSaved();
          if (!targetId) throw new Error("ID mancante");

          const isLiked = await db.toggleLike(targetId, currentUser.id);
          const newLikeCount = await db.getLikeCount(targetId);
          const newDislikeCount = await db.getDislikeCount(targetId);

          setLikeCount(newLikeCount);
          setDislikeCount(newDislikeCount);
          setUserHasLiked(isLiked);
          if (isLiked) setUserHasDisliked(false);

          if (onUpdate) onUpdate({ ...article, id: targetId, likeCount: newLikeCount, dislikeCount: newDislikeCount });
      } catch (error) {
          console.error("Errore Like:", error);
      } finally {
          loadingRef.current = false;
      }
  };

  const handleDislike = async () => {
      if (!currentUser) { onLoginRequest(); return; }
      if (loadingRef.current) return;
      loadingRef.current = true;

      try {
          const targetId = await ensureArticleSaved();
          if (!targetId) throw new Error("ID mancante");

          const isDisliked = await db.toggleDislike(targetId, currentUser.id);
          const newLikeCount = await db.getLikeCount(targetId);
          const newDislikeCount = await db.getDislikeCount(targetId);

          setLikeCount(newLikeCount);
          setDislikeCount(newDislikeCount);
          setUserHasDisliked(isDisliked);
          if (isDisliked) setUserHasLiked(false);

          if (onUpdate) onUpdate({ ...article, id: targetId, likeCount: newLikeCount, dislikeCount: newDislikeCount });
      } catch (error) {
          console.error("Errore Dislike:", error);
      } finally {
          loadingRef.current = false;
      }
  };

  const handlePostComment = async () => {
      if (!newComment.trim() || !currentUser) return;
      setSubmittingComment(true);
      try {
          const targetId = await ensureArticleSaved();
          if (!targetId) return;
          const added = await db.addComment(targetId, currentUser, newComment.trim());
          setComments([added, ...comments]);
          setNewComment('');
      } catch (e) {
          console.error("Errore invio commento", e);
      } finally {
          setSubmittingComment(false);
      }
  };

  const performDeleteComment = async (commentId: string) => {
    if (!currentUser) return;
    try {
        await db.deleteComment(commentId, currentUser.id);
        setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
        console.error("Errore cancellazione commento", e);
    } finally {
        setDeletingCommentId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto backdrop-blur-md p-0 md:p-8 animate-in fade-in">
      <div className="bg-white md:max-w-4xl mx-auto md:rounded-2xl shadow-2xl overflow-hidden min-h-[100vh] md:min-h-[80vh] flex flex-col relative">
        <div className="absolute top-4 right-4 z-10">
            <button onClick={onClose} className="bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition"><IconX /></button>
        </div>
        
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
            
            <AudioPlayer articleTitle={article.title} articleSummary={article.summary} articleUrl={article.url} initialAudioBase64={article.audioBase64} canPlay={!!currentUser} />

            <p className="text-lg text-slate-700 leading-relaxed mb-6">{article.summary}</p>
            
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-joy-600 font-bold hover:text-joy-700 hover:underline transition-colors">
                    Leggi l'articolo completo <IconExternalLink className="w-4 h-4" />
                </a>
                
                <button onClick={onShareClick} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm group">
                    <IconShare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    Condividi Notizia
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-b py-6 mb-8">
              <Tooltip content={currentUser ? "Mi piace" : "Accedi per votare"}>
                  <button onClick={handleLike} className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all border ${userHasLiked ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'}`}>
                      <IconThumbUp filled={userHasLiked} />
                      <span className="font-bold">{likeCount}</span>
                  </button>
              </Tooltip>

              <Tooltip content={currentUser ? "Non mi piace" : "Accedi per votare"}>
                  <button onClick={handleDislike} className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all border ${userHasDisliked ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-orange-50'}`}>
                      <IconThumbDown filled={userHasDisliked} />
                      <span className="font-bold">{dislikeCount}</span>
                  </button>
              </Tooltip>
              
              <div className="w-px h-8 bg-slate-200 mx-2"></div>

              <Tooltip content={currentUser ? (isFavorite ? "Rimuovi dai preferiti" : "Salva nei preferiti") : "Accedi per salvare"}>
                  {/* Fix: changed onLoginClick to onLoginRequest to match the prop name */}
                  <button onClick={() => currentUser ? onToggleFavorite(article) : onLoginRequest()} className={`flex items-center space-x-2 px-4 py-2 rounded-full border ${isFavorite ? 'bg-amber-50 text-amber-500 border-amber-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                      <IconHeart filled={isFavorite} />
                      <span>{isFavorite ? 'Salvato' : 'Salva'}</span>
                  </button>
              </Tooltip>
            </div>

            <div>
               <h3 className="text-xl font-display font-bold text-slate-800 mb-6 flex items-center gap-2">
                   <IconMessage className="w-5 h-5 text-joy-500" />
                   Commenti
               </h3>
               
               <div className="flex gap-4 mb-8">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden">
                        {currentUser ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-100">?</div>}
                    </div>
                    <div className="flex-1">
                        <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Un pensiero positivo..." className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-joy-400 outline-none resize-y min-h-[80px]" />
                        <div className="flex justify-end mt-2">
                            <button onClick={handlePostComment} disabled={!newComment.trim() || submittingComment} className="bg-joy-500 text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-joy-600 disabled:opacity-50 transition">
                                {submittingComment ? 'Invio...' : 'Invia'}
                            </button>
                        </div>
                    </div>
               </div>

               <div className="space-y-6">
                    {loadingComments ? (
                        <p className="text-center text-slate-400 py-4 italic">Caricamento...</p> 
                    ) : comments.length === 0 ? (
                        <p className="text-center text-slate-400 py-4 border border-dashed rounded-xl">Sii il primo!</p> 
                    ) : (
                        comments.map(comment => (
                            <div key={comment.id} className="flex gap-4 animate-in fade-in">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex-shrink-0 overflow-hidden border">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} className="w-full h-full" />
                                </div>
                                <div className="flex-1 bg-white p-4 rounded-xl rounded-tl-none border border-slate-100 shadow-sm relative group">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-800 text-sm">{comment.username}</span>
                                        <span className="text-xs text-slate-400">{new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(comment.timestamp))}</span>
                                    </div>
                                    <p className="text-slate-600 text-sm leading-relaxed">{comment.text}</p>
                                    
                                    {currentUser?.id === comment.userId && (
                                        <div className="absolute bottom-3 right-3 flex items-center gap-1">
                                            {deletingCommentId === comment.id ? (
                                                <div className="flex items-center gap-1 bg-white border shadow-sm rounded-full p-1 animate-in zoom-in">
                                                    <button 
                                                        onClick={() => performDeleteComment(comment.id)} 
                                                        className="text-emerald-500 hover:bg-emerald-50 p-1 rounded-full transition"
                                                    >
                                                        <IconCheck className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => setDeletingCommentId(null)} 
                                                        className="text-red-500 hover:bg-red-50 p-1 rounded-full transition"
                                                    >
                                                        <IconX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setDeletingCommentId(comment.id)} 
                                                    className="text-slate-400 hover:text-red-500 p-1 rounded-full transition-colors"
                                                    title="Elimina commento"
                                                >
                                                    <IconTrash className="w-4 h-4" />
                                                </button>
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
