
import { useState, useEffect, useRef } from 'react';
import { db, supabase } from '../services/dbService';
import { fetchPositiveNews } from '../services/geminiService';
import { Category, Article, User, DEFAULT_CATEGORIES } from '../types';

export const useNewsApp = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(''); 
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [favoriteArticleIds, setFavoriteArticleIds] = useState<Set<string>>(new Set());
  
  const [notification, setNotification] = useState<string | null>(null);

  const activeCategoryIdRef = useRef<string>('');
  const initialLoadDone = useRef(false);
  const isFetchingRef = useRef(false);

  // Monitoraggio utente e auth
  useEffect(() => {
    const checkUser = async () => {
        const user = await db.getCurrentUserProfile();
        setCurrentUser(user);
        if (user) {
            const ids = await db.getUserFavoritesIds(user.id);
            setFavoriteArticleIds(ids);
        }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const user = await db.getCurrentUserProfile();
            setCurrentUser(user);
            setShowLoginModal(false);
            if (user) {
                const ids = await db.getUserFavoritesIds(user.id);
                setFavoriteArticleIds(ids);
            }
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setFavoriteArticleIds(new Set());
            setShowFavoritesOnly(false); 
        }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // Sync categorie dal DB
  useEffect(() => {
      const refreshCategories = async () => {
          try {
              let dbCategories = await db.getCategories(currentUser?.id);
              if (!dbCategories || dbCategories.length === 0) {
                  await db.seedCategories();
                  dbCategories = await db.getCategories(currentUser?.id);
              }
              if (!dbCategories || dbCategories.length === 0) dbCategories = DEFAULT_CATEGORIES;
              setCategories(dbCategories);

              if (!activeCategoryIdRef.current && dbCategories.length > 0) {
                  const firstCat = dbCategories[0];
                  setActiveCategoryId(firstCat.id);
                  activeCategoryIdRef.current = firstCat.id;
              }
          } catch (e) {
              console.error("Errore refresh categorie:", e);
          }
      };
      refreshCategories();
  }, [currentUser]);

  // Gestione caricamento preferiti
  useEffect(() => {
    if (showFavoritesOnly && currentUser) {
        setLoading(true);
        setArticles([]);
        db.getUserFavoriteArticles(currentUser.id).then(favs => {
            setArticles(favs);
            setLoading(false);
        }).catch(err => {
            console.error("Errore caricamento preferiti:", err);
            setLoading(false);
        });
    } else if (!showFavoritesOnly && activeCategoryId) {
        // Quando torniamo dalla vista preferiti, ricarichiamo la categoria attiva
        const cat = categories.find(c => c.id === activeCategoryId);
        if (cat) fetchNewsForCategory(cat.id, cat.label, cat.value, false);
    }
  }, [showFavoritesOnly, currentUser]);

  // Caricamento Notizie
  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    if (showFavoritesOnly && !forceAi) return; 
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    setNotification(null);
    
    try {
        if (!forceAi) {
            const cached = await db.getCachedArticles(catLabel);
            if (cached && cached.length > 0) {
                setArticles(cached); 
                setLoading(false); 
                isFetchingRef.current = false;
                return; 
            }
        }

        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (aiArticles && aiArticles.length > 0) {
            const articlesWithNewTag = aiArticles.map(a => ({ ...a, isNew: true }));
            setArticles(articlesWithNewTag);
            
            db.saveArticles(catLabel, aiArticles).then(saved => {
                 setArticles(current => {
                    const idMap = new Map<string, string>();
                    saved.forEach(s => { if (s.url && s.id) idMap.set(s.url, s.id); });
                    return current.map(a => ({ ...a, id: idMap.get(a.url) || a.id }));
                 });
            });

        } else {
            setNotification("Nessuna notizia trovata in questo momento. Riprova più tardi.");
        }
    } catch (error: any) {
        console.error("[Fetch-Error]", error);
        setNotification(`Errore: ${error.message || 'Servizio momentaneamente non disponibile'}`);
    } finally {
        setLoading(false);
        isFetchingRef.current = false;
    }
  };

  const handleCategoryChange = (catId: string) => {
    if (activeCategoryIdRef.current === catId && !showFavoritesOnly) return;
    
    activeCategoryIdRef.current = catId;
    setActiveCategoryId(catId);
    
    if (showFavoritesOnly) {
        setShowFavoritesOnly(false);
    } else {
        setArticles([]); 
        const cat = categories.find(c => c.id === catId);
        if (cat) fetchNewsForCategory(catId, cat.label, cat.value, false); 
    }
  };

  const handleRefresh = () => {
      const currentId = activeCategoryIdRef.current;
      const cat = categories.find(c => c.id === currentId);
      if (cat) {
          setArticles([]); 
          fetchNewsForCategory(currentId, cat.label, cat.value, true);
      }
  };

  const handleArticleUpdate = (updatedArticle: Article) => {
    setArticles(prev => prev.map(a => {
        if (updatedArticle.id && a.id === updatedArticle.id) return updatedArticle;
        if (updatedArticle.url && a.url === updatedArticle.url) return { ...updatedArticle, id: a.id || updatedArticle.id };
        return a;
    }));
    // Sincronizza anche l'articolo selezionato se è lo stesso
    if (selectedArticle && (selectedArticle.id === updatedArticle.id || selectedArticle.url === updatedArticle.url)) {
        setSelectedArticle(updatedArticle);
    }
  };

  const handleToggleFavorite = async (article: Article) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    let articleId = article.id;
    let articleToUpdate = { ...article };

    if (!articleId) {
        const saved = await db.saveArticles(article.category || 'Generale', [article]);
        if (saved && saved.length > 0) {
            articleId = saved[0].id;
            articleToUpdate = saved[0];
        }
    }
    
    if (!articleId) return;

    const isCurrentlyFav = favoriteArticleIds.has(articleId);
    
    // Aggiornamento ottimistico UI
    if (isCurrentlyFav) {
        setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(articleId!); return n; });
        if (showFavoritesOnly) setArticles(prev => prev.filter(a => a.id !== articleId));
        await db.removeFavorite(articleId, currentUser.id);
    } else {
        setFavoriteArticleIds(prev => new Set(prev).add(articleId!));
        await db.addFavorite(articleId, currentUser.id);
    }

    // Fondamentale: aggiorna l'articolo nel set di dati e nella selezione
    handleArticleUpdate(articleToUpdate);
  };

  return {
    categories, activeCategoryId, articles, activeCategoryLabel: categories.find(c => c.id === activeCategoryId)?.label,
    loading, selectedArticle, showLoginModal, showFavoritesOnly, currentUser, favoriteArticleIds, notification,
    setActiveCategoryId: handleCategoryChange, setSelectedArticle, setShowLoginModal, setShowFavoritesOnly,
    handleLogin: async () => {}, 
    handleLogout: async () => { setCurrentUser(null); setFavoriteArticleIds(new Set()); setShowFavoritesOnly(false); await db.signOut(); },
    handleAddCategory: async (l: string) => {
        if (!currentUser) { setShowLoginModal(true); return; }
        const n = await db.addCategory(l, `${l} notizie positive`, currentUser.id);
        if (n) { setCategories(p => [...p, n]); handleCategoryChange(n.id); }
    },
    loadNews: handleRefresh,
    onImageGenerated: (u: string, i: string) => setArticles(p => p.map(a => a.url === u ? { ...a, imageUrl: i } : a)),
    handleToggleFavorite, handleArticleUpdate 
  };
};
