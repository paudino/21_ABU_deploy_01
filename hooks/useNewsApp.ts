
import { useState, useEffect, useCallback, useRef } from 'react';
import { db, supabase } from '../services/dbService';
import { fetchPositiveNews } from '../services/geminiService';
import { Category, Article, User, DEFAULT_CATEGORIES } from '../types';

const CACHE_TTL_MINUTES = 60; // Le notizie sono fresche per un'ora

export const useNewsApp = () => {
  // Inizializzazione con default per evitare blocchi dell'interfaccia
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('tech'); 
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [favoriteArticleIds, setFavoriteArticleIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const activeFetchIdRef = useRef<number>(0);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string, session: any) => {
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

    db.getCurrentUserProfile().then(setCurrentUser);
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        let dbCats = await db.getCategories(currentUser?.id);
        if (dbCats && dbCats.length > 0) {
          setCategories(dbCats);
        } else if (!categories || categories.length === 0) {
          setCategories(DEFAULT_CATEGORIES);
          db.seedCategories();
        }
      } catch (err) {
        if (!categories || categories.length === 0) setCategories(DEFAULT_CATEGORIES);
      }
    };
    loadCategories();
  }, [currentUser?.id]);

  useEffect(() => {
    if (categories.length > 0 && !searchTerm && !showFavoritesOnly) {
      const isValid = categories.some(c => c.id === activeCategoryId);
      if (!activeCategoryId || !isValid) {
        setActiveCategoryId(categories[0].id);
      }
    }
  }, [categories, activeCategoryId, showFavoritesOnly, searchTerm]);

  const fetchNews = useCallback(async (query: string, label: string, forceAi: boolean) => {
    const currentFetchId = ++activeFetchIdRef.current;
    
    isFetchingRef.current = true;
    setLoading(true);
    setNotification(null);

    try {
      if (!forceAi) {
        const freshCached = await db.getCachedArticles(label, CACHE_TTL_MINUTES);
        if (currentFetchId !== activeFetchIdRef.current) return;

        if (freshCached && freshCached.length > 0) {
          setArticles(freshCached);
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }
        
        const oldCached = await db.getCachedArticles(label, 0);
        if (currentFetchId === activeFetchIdRef.current && oldCached.length > 0) {
            setArticles(oldCached);
        }
      }

      const aiArticles = await fetchPositiveNews(query, label);
      if (currentFetchId !== activeFetchIdRef.current) return;

      if (aiArticles && aiArticles.length > 0) {
        setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
        
        db.saveArticles(label, aiArticles).then(saved => {
          if (saved && saved.length > 0 && currentFetchId === activeFetchIdRef.current) {
              setArticles(current => {
                const idMap = new Map(saved.map(s => [s.url, s.id]));
                return current.map(a => ({ ...a, id: idMap.get(a.url) || a.id }));
              });
          }
        });
      } else {
        setArticles(prev => {
            if (prev.length === 0) setNotification("Nessuna nuova notizia trovata.");
            return prev;
        });
      }
    } catch (error) {
      console.error("[FETCH-NEWS] Errore:", error);
    } finally {
      if (currentFetchId === activeFetchIdRef.current) {
        setLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (showFavoritesOnly) {
      if (currentUser) {
        const currentFetchId = ++activeFetchIdRef.current;
        setLoading(true);
        db.getUserFavoriteArticles(currentUser.id).then(favs => {
          if (currentFetchId === activeFetchIdRef.current) {
            setArticles(favs);
            setFavoriteArticleIds(new Set(favs.map(a => a.id).filter(Boolean) as string[]));
            setLoading(false);
          }
        }).catch(() => {
          if (currentFetchId === activeFetchIdRef.current) setLoading(false);
        });
      }
    } else if (searchTerm) {
      fetchNews(searchTerm, searchTerm, false);
    } else if (activeCategoryId) {
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) fetchNews(cat.value, cat.label, false);
    }
  }, [showFavoritesOnly, currentUser, activeCategoryId, categories, searchTerm, fetchNews]);

  return {
    categories,
    activeCategoryId,
    articles,
    activeCategoryLabel: searchTerm ? `Ricerca: ${searchTerm}` : categories.find(c => c.id === activeCategoryId)?.label,
    loading,
    selectedArticle,
    showLoginModal,
    showFavoritesOnly,
    currentUser,
    favoriteArticleIds,
    notification,
    setActiveCategoryId: (id: string) => {
      setSearchTerm(''); 
      setShowFavoritesOnly(false);
      setActiveCategoryId(id);
    },
    handleSearch: (term: string) => {
      const clean = term?.trim();
      if (!clean) return;
      setActiveCategoryId(''); 
      setShowFavoritesOnly(false);
      setSearchTerm(clean);
    },
    setSelectedArticle,
    setShowLoginModal,
    setShowFavoritesOnly: (val: boolean) => {
        if (val) {
          setSearchTerm('');
          setActiveCategoryId('');
        }
        setShowFavoritesOnly(val);
    },
    handleLogout: () => {
      setCurrentUser(null);
      setFavoriteArticleIds(new Set());
      db.signOut();
    },
    handleAddCategory: async (label: string) => {
      if (!currentUser) return setShowLoginModal(true);
      const cat = await db.addCategory(label, `${label} notizie positive`, currentUser.id);
      if (cat) {
        setCategories(prev => [...prev, cat]);
        setSearchTerm('');
        setActiveCategoryId(cat.id);
      }
    },
    loadNews: () => {
      if (searchTerm) {
        fetchNews(searchTerm, searchTerm, true);
      } else {
        const cat = categories.find(c => c.id === activeCategoryId);
        if (cat) fetchNews(cat.value, cat.label, true);
      }
    },
    onImageGenerated: (url: string, img: string) => {
      setArticles(prev => prev.map(a => a.url === url ? { ...a, imageUrl: img } : a));
    },
    handleToggleFavorite: async (article: Article) => {
      if (!currentUser) return setShowLoginModal(true);
      let id = article.id;
      if (!id) {
        const saved = await db.saveArticles(article.category, [article]);
        id = saved[0]?.id;
      }
      if (!id) return;

      const isFav = favoriteArticleIds.has(id);
      if (isFav) {
        setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(id!); return n; });
        if (showFavoritesOnly) {
          setArticles(prev => prev.filter(a => a.id !== id));
        }
        await db.removeFavorite(id, currentUser.id);
      } else {
        setFavoriteArticleIds(prev => new Set(prev).add(id!));
        await db.addFavorite(id, currentUser.id);
      }
    },
    handleArticleUpdate: (updated: Article) => {
      setArticles(prev => prev.map(a => (a.id === updated.id || a.url === updated.url) ? updated : a));
      setSelectedArticle(prev => (prev && (prev.id === updated.id || prev.url === updated.url)) ? updated : prev);
    }
  };
};
