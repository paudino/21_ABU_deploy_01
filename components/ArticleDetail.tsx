
import React, { useState, useEffect, useRef } from 'react';
import { Article, User, Comment } from '../types';
import { db } from '../services/dbService';
import { generateArticleImage } from '../services/geminiService';
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
  const [likeCount, setLikeCount] = useState(article.likeCount || 0);
  const [dislikeCount, setDislikeCount] = useState(article.dislikeCount || 0);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [userHasDisliked, setUserHasDisliked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(article.imageUrl);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const articleIdRef = useRef<string | undefined>(article.id);
  const loadingRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      if (article.id) {
          articleIdRef.current = article.id;
          const id = article.id;
          db.getLikeCount(id).then(setLikeCount);
          db.getDislikeCount(id).then(setDislikeCount);
          if (currentUser) {
              db.hasUserLiked(id, currentUser.id).then(setUserHasLiked);
              db.hasUserDisliked(id, currentUser.id).then(setUserHasDisliked);
          }
          loadComments(id);
      }

      if (!article.imageUrl || article.imageUrl.includes('picsum.photos')) {
          try {
              const img = await generateArticleImage(article.title);
              if (img) {
                  setCurrentImageUrl(img);
                  db.updateArticleImage(article.url, img).catch(() => {});
                  if (onUpdate) onUpdate({ ...article, imageUrl: img });
              }
          } catch(e) {}
      }
    };
    loadData();
  }, [article.id, currentUser]);

  const loadComments = async (artId: string) => {
      setLoadingComments(true);
      try {
          const list = await db.getComments(artId);
          setComments(list);
      } catch (e) {} finally {
          setLoadingComments(false);
      }
  };

  const ensureArticleSaved = async (): Promise<string | null> => {
      if (articleIdRef.current) return articleIdRef.current;
      try {
          const saved = await db.saveArticles(article.category || 'Generale', [article]);
          if (saved && saved.length > 0) {
              articleIdRef.current = saved[0].id;
              if (onUpdate) onUpdate(saved[0]);
              return saved[0].id || null;
          }
      } catch (e) {}
      return null;
  };

  const handleLike = async () => {
      if (!currentUser || loadingRef.current) return;
      loadingRef.current = true;
      const wasLiked = userHasLiked;
      setUserHasLiked(!wasLiked);
      setLikeCount(p => !wasLiked ? p + 1 : Math.max(0, p - 1));
      try {
          const targetId = await ensureArticleSaved();
          if (targetId) await db.toggleLike(targetId, currentUser.id);
      } catch (e) {
          setUserHasLiked(wasLiked);
      } finally { loadingRef.current = false; }
  };

  const handleDislike = async () => {
      if (!currentUser || loadingRef.current) return;
      loadingRef.current = true;
      const wasDisliked = userHasDisliked;
      setUserHasDisliked(!wasDisliked);
      setDislikeCount(p => !wasDisliked ? p + 1 : Math.max(0, p - 1));
      try {
          const targetId = await ensureArticleSaved();
          if (targetId) await db.toggleDislike(targetId, currentUser.id);
      } catch (e) {
          setUserHasDisliked(wasDisliked);
      } finally { loadingRef.current = false; }
  };

  const handlePostComment = async () => {
      if (!newComment.trim() || !currentUser) return;
      setSubmittingComment(true);
      try {
          const targetId = await ensureArticleSaved();
          if (targetId) {
              const added = await db.addComment(targetId, currentUser, newComment.trim());
              setComments([added, ...comments]);
              setNewComment('');
          }
      } catch (e) {} finally { setSubmittingComment(false); }
  };

  const handleDeleteConfirm = async (commentId: string) => {
    if (!currentUser) return;
    try {
        await db.deleteComment(commentId, currentUser.id);
        setComments(prev => prev.filter(c => c.id !== commentId));
        setDeletingCommentId(null);
    } catch (e) {
        alert("Errore durante l'eliminazione.");
        setDeletingCommentId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto backdrop-blur-md p-0 md:p-8 animate-in fade-in">
      <div className="bg-white md:max-w-4xl mx-auto md:rounded-2xl shadow-2xl overflow-hidden min-h-[100vh] md:min-h-[80vh] flex flex-col relative text-slate-900">
        <div className="absolute top-4 right-4 z-10">
            <button onClick={onClose} className="bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition"><IconX /></button>
        </div>
        
        <div className="relative h-64 md:h-96 w-full bg-slate-200">
          <img src={currentImageUrl || `https://picsum.photos/seed/${encodeURIComponent(article.title)}/600/400`} className="w-full h-full object-cover" alt={article.title}/>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 p-6 pt-24">
            <h1 className="text-2xl md:text-4xl font-bold text-white font-display">{article.title}</h1>
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

            <p className="text-lg text-slate-700 leading-relaxed mb-6 font-body">{article.summary}</p>
            
            <div className="mb-6">
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-joy-600 font-bold hover:text-joy-700 hover:underline transition-colors">
                    Leggi l'articolo completo <IconExternalLink className="w-4 h-4" />
                </a>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-b py-6 mb-8">
              <button onClick={handleLike} className={`flex items-center space-x-2 px-4 py-2 rounded-full transition border ${userHasLiked ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  <IconThumbUp filled={userHasLiked} />
                  <span className="font-bold">{likeCount}</span>
              </button>
              <button onClick={handleDislike} className={`flex items-center space-x-2 px-4 py-2 rounded-full transition border ${userHasDisliked ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  <IconThumbDown filled={userHasDisliked} />
                  <span className="font-bold">{dislikeCount}</span>
              </button>
              <button onClick={() => onToggleFavorite(article)} className={`flex items-center space-x-2 px-4 py-2 rounded-full transition border ${isFavorite ? 'bg-amber-50 text-amber-500 border-amber-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  <IconHeart filled={isFavorite} />
                  <span>{isFavorite ? 'Salvato' : 'Salva'}</span>
              </button>
            </div>

            <div className="space-y-6">
                <h3 className="text-xl font-display font-bold text-slate-800 mb-4">Commenti</h3>
                {currentUser && (
                    <div className="flex gap-2 mb-8">
                        <textarea 
                            value={newComment} 
                            onChange={e => setNewComment(e.target.value)} 
                            className="flex-1 border p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-joy-400 focus:border-joy-400 outline-none transition resize-none" 
                            rows={2}
                            placeholder="Lascia un commento..." 
                        />
                        <button 
                            onClick={handlePostComment} 
                            disabled={submittingComment || !newComment.trim()} 
                            className="bg-joy-500 text-white px-6 rounded-xl font-bold hover:bg-joy-600 transition disabled:opacity-50 shadow-md shadow-joy-100"
                        >
                            Invia
                        </button>
                    </div>
                )}
                <div className="space-y-4">
                    {comments.length === 0 ? (
                        <p className="text-slate-400 italic text-sm">Nessun commento ancora. Sii il primo!</p>
                    ) : (
                        comments.map(c => (
                            <div key={c.id} className="p-4 bg-slate-50 rounded-xl group relative border border-slate-100 transition-all hover:bg-slate-100/50">
                                <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-joy-100 text-joy-600 rounded-full flex items-center justify-center text-[10px]">{c.username.charAt(0).toUpperCase()}</div>
                                        <span>{c.username}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span>{new Date(c.timestamp).toLocaleDateString()}</span>
                                        {currentUser && currentUser.id === c.userId && (
                                            <div className="flex items-center gap-1">
                                                {deletingCommentId === c.id ? (
                                                    <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                                                        <button 
                                                            onClick={() => handleDeleteConfirm(c.id)}
                                                            className="text-emerald-500 hover:text-emerald-600 p-1"
                                                            title="Conferma eliminazione"
                                                        >
                                                            <IconCheck className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setDeletingCommentId(null)}
                                                            className="text-rose-500 hover:text-rose-600 p-1"
                                                            title="Annulla"
                                                        >
                                                            <IconX className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => setDeletingCommentId(c.id)}
                                                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                        title="Elimina commento"
                                                    >
                                                        <IconTrash className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{c.text}</p>
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
