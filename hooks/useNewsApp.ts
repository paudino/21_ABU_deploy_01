
import { useState, useEffect, useRef, useCallback } from 'react';
import { db, supabase } from '../services/dbService';
import { fetchPositiveNews, generateArticleImage } from '../services/geminiService';
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

  const [searchTerm, setSearchTerm] = useState<string>('');

  const nextArticle = selectedArticle 
    ? articles[articles.findIndex(a => a.url === selectedArticle.url) + 1] || null 
    : null;

  // PRE-FETCHER DISABILITATO TEMPORANEAMENTE PER SALVARE QUOTA (429)
  // Verranno generate le immagini solo all'apertura del dettaglio o al primo caricamento utile
  useEffect(() => {
    // Logica rimossa per fermare il consumo di API Gemini in background
  }, [articles, loading]);

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
        if (!dbCats || dbCats.length === 0) {
          setCategories(DEFAULT_CATEGORIES);
          db.seedCategories();
          if (!activeCategoryId && !searchTerm) setActiveCategoryId(DEFAULT_CATEGORIES[0].id);
        } else {
          setCategories(dbCats);
          if (!activeCategoryId && !searchTerm) setActiveCategoryId(dbCats[0].id);
        }
      } catch (err) {
        setCategories(DEFAULT_CATEGORIES);
      }
    };
    loadCategories();
  }, [currentUser?.id]);

  const fetchNews = useCallback(async (query: string, label: string, forceAi: boolean) => {
    setLoading(true);
    setNotification(null);
    try {
      if (!forceAi) {
        const cached = await db.getCachedArticles(label);
        if (cached && cached.length > 0) {
          setArticles(cached); 
          setLoading(false); 
          return; 
        }
      }

      const aiArticles = await fetchPositiveNews(query, label);
      if (aiArticles && aiArticles.length > 0) {
        setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
        db.saveArticles(label, aiArticles);
      } else {
        setNotification(forceAi ? "Limite API raggiunto o nessuna notizia trovata. Riprova più tardi." : "Archivio vuoto.");
      }
    } catch (error: any) {
      console.error("[FETCH-NEWS] Errore:", error);
      if (error.message?.includes('429')) {
          setNotification("Troppe richieste a Gemini. Attendere un minuto.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showFavoritesOnly) {
      if (currentUser) {
        setLoading(true);
        db.getUserFavoriteArticles(currentUser.id).then(favs => {
          setArticles(favs);
          setFavoriteArticleIds(new Set(favs.map(a => a.id).filter(Boolean) as string[]));
          setLoading(false);
        }).catch(() => setLoading(false));
      }
    } else if (searchTerm) {
      fetchNews(searchTerm, searchTerm, false);
    } else if (activeCategoryId && categories.length > 0) {
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) fetchNews(cat.value, cat.label, false);
    }
  }, [showFavoritesOnly, currentUser, activeCategoryId, categories, searchTerm, fetchNews]);

  return {
    categories,
    activeCategoryId,
    articles,
    nextArticle, 
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
      setActiveCategoryId(id);
    },
    handleSearch: (term: string) => {
      if (!term.trim()) return;
      setShowFavoritesOnly(false);
      setActiveCategoryId('');
      setSearchTerm(term.trim());
    },
    setSelectedArticle,
    setShowLoginModal,
    setShowFavoritesOnly: (val: boolean) => {
        if (val) setSearchTerm('');
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
      if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
        const saved = await db.saveArticles(article.category, [article]);
        id = saved[0]?.id;
      }
      
      if (!id) return;

      const isFav = favoriteArticleIds.has(id);
      if (isFav) {
        setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(id!); return n; });
        if (showFavoritesOnly) setArticles(prev => prev.filter(a => a.id !== id));
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
