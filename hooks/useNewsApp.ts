
import { useState, useEffect, useCallback } from 'react';
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
        setNotification(forceAi ? "Nessuna nuova notizia trovata ora." : "Archivio vuoto.");
      }
    } catch (error: any) {
      if (error.message?.includes('429')) setNotification("Limite API Gemini raggiunto. Riprova tra poco.");
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

  const handleAddCategory = async (label: string) => {
    if (!currentUser) return setShowLoginModal(true);
    const cat = await db.addCategory(label, `${label} notizie positive`, currentUser.id);
    if (cat) {
      setCategories(prev => [...prev, cat]);
      setActiveCategoryId(cat.id);
      setSearchTerm('');
      setNotification(null);
    } else {
      setNotification(`La categoria "${label}" esiste già!`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!currentUser) return;
    const success = await db.deleteCategory(id, currentUser.id);
    if (success) {
        setCategories(prev => prev.filter(c => c.id !== id));
        if (activeCategoryId === id) {
            setActiveCategoryId(DEFAULT_CATEGORIES[0].id);
        }
        setNotification("Categoria eliminata con successo.");
        setTimeout(() => setNotification(null), 3000);
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
