
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
        console.log("[useNewsApp] 📂 Categorie caricate:", dbCats.length);
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
    setLoading(true);
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
      } else if (forceAi) {
        showToast("Nessuna nuova notizia trovata ora.");
      }
    } catch (error: any) {
      if (error.message?.includes('429')) showToast("Limite API raggiunto. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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

  const handleAddCategory = useCallback(async (label: string) => {
    if (!currentUser) return setShowLoginModal(true);
    
    const exists = categories.some(c => c.label.toLowerCase() === label.trim().toLowerCase());
    if (exists) {
        showToast(`La categoria "${label}" è già presente nel tuo elenco!`);
        return;
    }

    const cat = await db.addCategory(label, `${label} notizie positive`, currentUser.id);
    if (cat) {
      setCategories(prev => [...prev, cat]);
      setActiveCategoryId(cat.id);
      setSearchTerm('');
      showToast(`Categoria "${label}" aggiunta con successo! ✨`);
    } else {
      showToast(`Impossibile aggiungere: la categoria "${label}" esiste già.`);
    }
  }, [currentUser, categories, showToast]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    console.log("[useNewsApp] 🗑️ Inizio handleDeleteCategory ID:", id);
    if (!currentUser) {
        console.warn("[useNewsApp] Tentativo eliminazione senza utente loggato");
        return;
    }

    const catToDelete = categories.find(c => c.id === id);
    console.log("[useNewsApp] 📂 Categoria da eliminare:", catToDelete?.label);

    try {
        const success = await db.deleteCategory(id, currentUser.id);
        console.log("[useNewsApp] 🌍 Risultato DB deleteCategory:", success);

        if (success) {
            setCategories(prev => {
                const filtered = prev.filter(c => c.id !== id);
                console.log("[useNewsApp] 📉 Stato locale aggiornato, rimaste:", filtered.length);
                return filtered;
            });
            
            if (activeCategoryId === id) {
                console.log("[useNewsApp] 🔄 Categoria attiva eliminata, resetto a default");
                setActiveCategoryId(DEFAULT_CATEGORIES[0].id);
            }
            showToast(`Categoria "${catToDelete?.label || 'personalizzata'}" eliminata.`);
        } else {
            console.error("[useNewsApp] ❌ Eliminazione DB fallita");
            showToast("Errore durante l'eliminazione della categoria.");
        }
    } catch (e) {
        console.error("[useNewsApp] ❌ Eccezione durante eliminazione:", e);
        showToast("Errore di rete durante l'eliminazione.");
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
          if (selectedArticle?.url === article.url) setSelectedArticle({ ...selectedArticle, id: artId });
      } else return;
    }

    const isFav = favoriteArticleIds.has(artId);
    if (isFav) {
      const success = await db.removeFavorite(artId, currentUser.id);
      if (success) setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(artId!); return n; });
    } else {
      const success = await db.addFavorite(artId, currentUser.id);
      if (success) setFavoriteArticleIds(prev => new Set(prev).add(artId!));
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
    setShowFavoritesOnly,
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
