
import { useState, useEffect, useCallback, useRef } from 'react';
import { db, supabase } from '../services/dbService';
import { fetchPositiveNews } from '../services/geminiService';
import { Category, Article, User, DEFAULT_CATEGORIES } from '../types';

const CACHE_TTL_MINUTES = 60; 

export const useNewsApp = () => {
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
        }
      } catch (err) {}
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
      // 1. TENTA IL DB (Con attesa aumentata)
      if (!forceAi) {
        console.log(`[NEWS-APP] 📂 Controllo cache per: ${label}`);
        const freshCached = await db.getCachedArticles(label, CACHE_TTL_MINUTES);
        
        if (currentFetchId !== activeFetchIdRef.current) return;

        if (freshCached && freshCached.length > 0) {
          console.log(`[NEWS-APP] ✅ Cache valida trovata.`);
          setArticles(freshCached);
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }
        console.log(`[NEWS-APP] 📭 Cache vuota o DB lento.`);
      }

      // 2. TENTA L'AI (Solo se necessario o forzato)
      // Aspettiamo un secondo extra per distanziare le chiamate
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (currentFetchId !== activeFetchIdRef.current) return;

      console.log(`[NEWS-APP] 🤖 Lancio generazione AI per: ${label}`);
      const aiArticles = await fetchPositiveNews(query, label);
      
      if (currentFetchId !== activeFetchIdRef.current) return;

      if (aiArticles && aiArticles.length > 0) {
        setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
        db.saveArticles(label, aiArticles);
      } else {
        // Fallback estremo: prova a recuperare QUALSIASI cosa dal DB anche se vecchia
        const oldCached = await db.getCachedArticles(label, 0);
        if (currentFetchId === activeFetchIdRef.current) {
          if (oldCached.length > 0) {
            setArticles(oldCached);
            setNotification("Servizio AI al momento limitato. Visualizzo notizie meno recenti.");
          } else {
            setNotification("Nessuna notizia disponibile al momento. Il server sta riposando, riprova tra poco!");
          }
        }
      }
    } catch (error) {
      console.error("[FETCH-NEWS] ❌ Errore critico:", error);
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
            setLoading(false);
          }
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
        setActiveCategoryId(cat.id);
      }
    },
    loadNews: () => {
      if (searchTerm) fetchNews(searchTerm, searchTerm, true);
      else {
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
