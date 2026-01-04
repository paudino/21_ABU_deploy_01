
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
                if (showFavoritesOnly) loadFavorites(user.id);
            }
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setFavoriteArticleIds(new Set());
            setShowFavoritesOnly(false); 
        }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

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

              const currentActiveStillExists = dbCategories.find(c => c.id === activeCategoryIdRef.current);
              if (!currentActiveStillExists && dbCategories.length > 0) {
                  const firstCat = dbCategories[0];
                  setActiveCategoryId(firstCat.id);
                  activeCategoryIdRef.current = firstCat.id;
                  if (!showFavoritesOnly && initialLoadDone.current) {
                      setArticles([]); 
                      fetchNewsForCategory(firstCat.id, firstCat.label, firstCat.value, false);
                  }
              }
          } catch (e) {
              console.error("Errore refresh categorie:", e);
          }
      };
      refreshCategories();
  }, [currentUser]);

  const loadFavorites = async (userId: string) => {
      setLoading(true);
      setArticles([]); 
      try {
          const favArticles = await db.getUserFavoriteArticles(userId);
          console.log(`%c[Source: DB-Favorites] Caricati ${favArticles.length} preferiti dal DB.`, "color: #ec4899; font-weight: bold");
          setArticles(favArticles);
          const ids = new Set(favArticles.map(a => a.id).filter(Boolean) as string[]);
          setFavoriteArticleIds(ids);
      } catch (e) {
          console.error(e);
          setNotification("Impossibile caricare i preferiti.");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      if (!initialLoadDone.current && !currentUser) return;
      const switchView = async () => {
          if (showFavoritesOnly) {
              if (currentUser) await loadFavorites(currentUser.id);
              else { setShowLoginModal(true); setShowFavoritesOnly(false); }
          } else {
              if (activeCategoryIdRef.current && categories.length > 0) {
                  const cat = categories.find(c => c.id === activeCategoryIdRef.current);
                  if (cat) { setArticles([]); await fetchNewsForCategory(cat.id, cat.label, cat.value, false); }
              }
          }
      };
      switchView();
  }, [showFavoritesOnly]); 

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const startUp = async () => {
      setLoading(true);
      try {
        await db.seedInspiration().catch(console.error);
        
        let startCat = DEFAULT_CATEGORIES[0];
        if (categories.length > 0) startCat = categories[0];
        setActiveCategoryId(startCat.id);
        activeCategoryIdRef.current = startCat.id;

        if (!showFavoritesOnly) {
           const cached = await db.getCachedArticles(startCat.label);
           if (cached && cached.length > 0) {
                console.log(`%c[Source: DB-Cache] Caricamento iniziale da archivio locale per: ${startCat.label}`, "color: #6366f1; font-weight: bold");
                setArticles(cached); 
                setLoading(false);
           } else {
                await fetchNewsForCategory(startCat.id, startCat.label, startCat.value, true);
           }
        }
        setTimeout(() => { db.cleanupOldArticles().catch(console.error); }, 10000);
      } catch (e) {
        setLoading(false);
      }
    };
    startUp();
  }, []);

  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    if (showFavoritesOnly && !forceAi) return; 
    setLoading(true);
    setNotification(null);
    
    try {
        if (!forceAi) {
            const cached = await db.getCachedArticles(catLabel);
            if (cached && cached.length > 0) {
                console.log(`%c[Source: DB-Cache] Notizie trovate in archivio per: ${catLabel}`, "color: #6366f1; font-weight: bold");
                setArticles(cached); 
                setLoading(false); 
                return; 
            }
        }

        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (aiArticles.length > 0) {
            const newArticles = aiArticles.map(a => ({ ...a, isNew: true }));
            setArticles(newArticles);
            db.saveArticles(catLabel, aiArticles).then(saved => {
                 setArticles(current => {
                    const idMap = new Map<string, string>();
                    saved.forEach(s => { if (s.url && s.id) idMap.set(s.url, s.id); });
                    return current.map(a => ({ ...a, id: idMap.get(a.url) || a.id }));
                 });
            }).catch(console.error);
        } else {
            setNotification("Nessuna nuova notizia reale trovata al momento.");
        }
    } catch (error: any) {
        setNotification("Impossibile caricare nuove notizie. Mostro quelle in archivio.");
        const cachedFallback = await db.getCachedArticles(catLabel);
        if (cachedFallback.length > 0) setArticles(cachedFallback);
    } finally {
        setLoading(false);
    }
  };

  const handleCategoryChange = (catId: string) => {
    activeCategoryIdRef.current = catId;
    setActiveCategoryId(catId);
    if (showFavoritesOnly) { setShowFavoritesOnly(false); return; }
    setArticles([]); 
    setNotification(null);
    setLoading(true);
    const cat = categories.find(c => c.id === catId);
    if (cat) fetchNewsForCategory(catId, cat.label, cat.value, false); 
  };

  const handleRefresh = () => {
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) fetchNewsForCategory(activeCategoryId, cat.label, cat.value, true);
  };

  const handleArticleUpdate = (updatedArticle: Article) => {
    setArticles(prev => prev.map(a => {
        if (updatedArticle.id && a.id === updatedArticle.id) return updatedArticle;
        if (updatedArticle.url && a.url === updatedArticle.url) return { ...updatedArticle, id: a.id || updatedArticle.id };
        return a;
    }));
  };

  const handleToggleFavorite = async (article: Article) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    let articleId = article.id;
    if (!articleId) {
        const saved = await db.saveArticles(article.category || 'Generale', [article]);
        if (saved && saved.length > 0) articleId = saved[0].id;
    }
    if (!articleId) return;
    const isCurrentlyFav = favoriteArticleIds.has(articleId);
    if (isCurrentlyFav) {
        setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(articleId!); return n; });
        if (showFavoritesOnly) setArticles(prev => prev.filter(a => a.id !== articleId));
        await db.removeFavorite(articleId, currentUser.id);
    } else {
        setFavoriteArticleIds(prev => new Set(prev).add(articleId!));
        await db.addFavorite(articleId, currentUser.id);
    }
  };

  return {
    categories, activeCategoryId, articles, activeCategoryLabel: categories.find(c => c.id === activeCategoryId)?.label,
    loading, selectedArticle, showLoginModal, showFavoritesOnly, currentUser, favoriteArticleIds, notification,
    setActiveCategoryId: handleCategoryChange, setSelectedArticle, setShowLoginModal, setShowFavoritesOnly,
    handleLogin: async () => {}, handleLogout: async () => { setCurrentUser(null); setFavoriteArticleIds(new Set()); setShowFavoritesOnly(false); await db.signOut(); },
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
