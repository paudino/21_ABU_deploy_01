
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [searchTerm, setSearchTerm] = useState<string>('');

  const notificationTimeoutRef = useRef<number | null>(null);
  // Ref per tracciare quale operazione di caricamento è l'ultima richiesta (evita race conditions)
  const currentRequestMode = useRef<string>('news');

  const showToast = useCallback((msg: string, duration = 4000) => {
    console.log("[useNewsApp] 🍞 Mostro Toast:", msg);
    if (notificationTimeoutRef.current) window.clearTimeout(notificationTimeoutRef.current);
    setNotification(msg);
    notificationTimeoutRef.current = window.setTimeout(() => {
      setNotification(null);
    }, duration);
  }, []);

  const nextArticle = selectedArticle 
    ? articles[articles.findIndex(a => a.url === selectedArticle.url) + 1] || null 
    : null;

  useEffect(() => {
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string, session: any) => {
      console.log("[useNewsApp] 🔐 Evento Auth:", event);
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
    db.getCurrentUserProfile().then(user => {
        setCurrentUser(user);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        let dbCats = await db.getCategories(currentUser?.id);
        setCategories(dbCats);
        if (!activeCategoryId && !searchTerm && dbCats.length > 0) {
            setActiveCategoryId(dbCats[0].id);
        }
      } catch (err) {
        setCategories(DEFAULT_CATEGORIES);
      }
    };
    loadCategories();
  }, [currentUser?.id]);

  const fetchNews = useCallback(async (query: string, label: string, forceAi: boolean) => {
    // Se siamo in modalità preferiti, non eseguire fetch news
    if (currentRequestMode.current === 'favorites') return;
    
    setLoading(true);
    try {
      if (!forceAi) {
        const cached = await db.getCachedArticles(label);
        if (currentRequestMode.current === 'favorites') return; // Abort se cambiato nel frattempo
        
        if (cached && cached.length > 0) {
          setArticles(cached); 
          setLoading(false); 
          return; 
        }
      }
      const aiArticles = await fetchPositiveNews(query, label);
      
      // Controllo finale prima di aggiornare lo stato
      if (currentRequestMode.current === 'favorites') return;

      if (aiArticles && aiArticles.length > 0) {
        setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
        db.saveArticles(label, aiArticles);
      } else if (forceAi) {
        showToast("Nessuna nuova notizia trovata ora.");
      }
    } catch (error: any) {
      if (error.message?.includes('429')) showToast("Limite API raggiunto. Riprova tra poco.");
    } finally {
      if (currentRequestMode.current !== 'favorites') {
        setLoading(false);
      }
    }
  }, [showToast]);

  // Gestore unificato per il caricamento dati
  useEffect(() => {
    let isMounted = true;

    if (showFavoritesOnly) {
      if (currentUser) {
        console.log("[useNewsApp] ❤️ MODALITÀ PREFERITI ATTIVATA");
        currentRequestMode.current = 'favorites';
        setLoading(true);
        setArticles([]); // SVUOTA IMMEDIATAMENTE per evitare "ghost" news

        db.getUserFavoriteArticles(currentUser.id).then(favs => {
          if (!isMounted || currentRequestMode.current !== 'favorites') return;
          console.log(`[useNewsApp] ✅ SETTING PREFERITI: ${favs.length} articoli.`);
          setArticles([...favs]); 
          setFavoriteArticleIds(new Set(favs.map(a => a.id).filter(Boolean) as string[]));
          setLoading(false);
        }).catch(err => {
          if (!isMounted || currentRequestMode.current !== 'favorites') return;
          console.error("[useNewsApp] ❌ Errore sync preferiti:", err);
          setLoading(false);
        });
      } else {
        setShowLoginModal(true);
        setShowFavoritesOnly(false);
      }
    } else {
      currentRequestMode.current = 'news';
      setArticles([]); // Svuota anche quando torni alle news per pulizia visiva
      
      if (searchTerm) {
        fetchNews(searchTerm, searchTerm, false);
      } else if (activeCategoryId && categories.length > 0) {
        const cat = categories.find(c => c.id === activeCategoryId);
        if (cat) fetchNews(cat.value, cat.label, false);
      }
    }

    return () => { isMounted = false; };
  }, [showFavoritesOnly, currentUser, activeCategoryId, categories, searchTerm, fetchNews]);

  const handleAddCategory = useCallback(async (label: string) => {
    if (!currentUser) return setShowLoginModal(true);
    const exists = categories.some(c => c.label.toLowerCase() === label.trim().toLowerCase());
    if (exists) {
        showToast(`La categoria "${label}" è già presente!`);
        return;
    }
    const cat = await db.addCategory(label, `${label} notizie positive`, currentUser.id);
    if (cat) {
      setCategories(prev => [...prev, cat]);
      setActiveCategoryId(cat.id);
      setSearchTerm('');
      showToast(`Categoria "${label}" aggiunta! ✨`);
    }
  }, [currentUser, categories, showToast]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    if (!currentUser) return;
    const catToDelete = categories.find(c => c.id === id);
    try {
        const success = await db.deleteCategory(id, currentUser.id);
        if (success) {
            setCategories(prev => prev.filter(c => c.id !== id));
            if (activeCategoryId === id) {
                setActiveCategoryId(DEFAULT_CATEGORIES[0].id);
            }
            showToast(`Categoria "${catToDelete?.label}" eliminata.`);
        }
    } catch (e) {
        showToast("Errore durante l'eliminazione.");
    }
  }, [currentUser, categories, activeCategoryId, showToast]);

  const handleToggleFavorite = async (article: Article) => {
    if (!currentUser) return setShowLoginModal(true);
    
    let artId = article.id;
    if (!artId || !/^[0-9a-fA-F-]{36}$/.test(artId)) {
      const saved = await db.saveArticles(article.category, [article]);
      if (saved && saved[0]?.id) {
          artId = saved[0].id;
          setArticles(prev => prev.map(a => a.url === article.url ? { ...a, id: artId } : a));
      } else {
          showToast("Impossibile salvare l'articolo.");
          return;
      }
    }

    const isFav = favoriteArticleIds.has(artId!);
    if (isFav) {
      const success = await db.removeFavorite(artId!, currentUser.id);
      if (success) {
          setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(artId!); return n; });
          if (showFavoritesOnly) {
              setArticles(prev => prev.filter(a => a.id !== artId));
          }
          showToast("Rimosso dai preferiti");
      }
    } else {
      const success = await db.addFavorite(artId!, currentUser.id);
      if (success) {
          setFavoriteArticleIds(prev => new Set(prev).add(artId!));
          showToast("Aggiunto ai preferiti ❤️");
      }
    }
  };

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
      setShowFavoritesOnly(false);
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
        console.log("[useNewsApp] 🚩 Cambio modalità Preferiti:", val);
        setShowFavoritesOnly(val);
    },
    handleLogout: () => db.signOut(),
    handleAddCategory,
    handleDeleteCategory,
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
    handleToggleFavorite,
    handleArticleUpdate: (updated: Article) => {
      setArticles(prev => prev.map(a => (a.id === updated.id || a.url === updated.url) ? updated : a));
    }
  };
};
