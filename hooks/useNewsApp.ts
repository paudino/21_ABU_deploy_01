
import { useState, useEffect, useRef, useCallback } from 'react';
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

  // Nuovo stato per la ricerca libera
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 1. GESTIONE AUTENTICAZIONE
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

  // 2. CARICAMENTO CATEGORIE
  useEffect(() => {
    const loadCategories = async () => {
      try {
        let dbCats = await db.getCategories(currentUser?.id);
        if (!dbCats || dbCats.length === 0) {
          setCategories(DEFAULT_CATEGORIES);
          db.seedCategories();
        } else {
          setCategories(dbCats);
        }
      } catch (err) {
        setCategories(DEFAULT_CATEGORIES);
      }
    };
    loadCategories();
  }, [currentUser?.id]);

  // 3. IMPOSTAZIONE CATEGORIA INIZIALE
  useEffect(() => {
    if (categories.length > 0 && !searchTerm && !showFavoritesOnly) {
      const isValid = categories.some(c => c.id === activeCategoryId);
      if (!activeCategoryId || !isValid) {
        setActiveCategoryId(categories[0].id);
      }
    }
  }, [categories, activeCategoryId, showFavoritesOnly, searchTerm]);

  // 4. FUNZIONE CORE CARICAMENTO NOTIZIE
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

      // Se non c'è cache o forziamo l'AI
      const aiArticles = await fetchPositiveNews(query, label);
      if (aiArticles && aiArticles.length > 0) {
        setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
        db.saveArticles(label, aiArticles).then(saved => {
          if (saved && saved.length > 0) {
              setArticles(current => {
                const idMap = new Map(saved.map(s => [s.url, s.id]));
                return current.map(a => ({ ...a, id: idMap.get(a.url) || a.id }));
              });
          }
        });
      } else {
        setNotification(forceAi ? "Nessuna nuova notizia trovata per questa ricerca." : "Archivio vuoto.");
      }
    } catch (error) {
      console.error("[FETCH-NEWS] Errore:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 5. EFFETTO REATTIVO CARICAMENTO
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
      // Ricerca Libera
      fetchNews(searchTerm, searchTerm, false);
    } else if (activeCategoryId) {
      // Categoria standard
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
      setSearchTerm(''); // Pulisce la ricerca se selezioni una categoria
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
