
import { useState, useEffect, useRef } from 'react';
import { db, supabase } from '../services/dbService';
import { fetchPositiveNews } from '../services/geminiService';
import { Category, Article, User, DEFAULT_CATEGORIES } from '../types';

export const useNewsApp = () => {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(DEFAULT_CATEGORIES[0].id); 
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [favoriteArticleIds, setFavoriteArticleIds] = useState<Set<string>>(new Set());
  
  const [notification, setNotification] = useState<string | null>(null);

  const initialLoadTriggered = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!initialLoadTriggered.current) {
        initialLoadTriggered.current = true;
        const firstCat = DEFAULT_CATEGORIES[0];
        fetchNewsForCategory(firstCat.id, firstCat.label, firstCat.value, false);
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
        try {
            const { data: { user } } = await (supabase.auth as any).getUser();
            if (user) {
                const profile = await db.getCurrentUserProfile();
                setCurrentUser(profile);
                if (profile) {
                    const ids = await db.getUserFavoritesIds(profile.id);
                    setFavoriteArticleIds(ids);
                }
            }
        } catch (e) {}
    };
    checkUser();

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string) => {
        if (event === 'SIGNED_IN') {
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

  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    setNotification(null);
    
    console.log(`[NewsApp] Avvio caricamento per: ${catLabel}`);
    
    try {
        if (!forceAi) {
            const cached = await db.getCachedArticles(catLabel, catId);
            if (cached && cached.length > 0) {
                console.log(`[NewsApp] OK: Mostro ${cached.length} articoli dal DB.`);
                setArticles(cached); 
                setLoading(false); 
                isFetchingRef.current = false;
                return; 
            }
            console.log(`[NewsApp] DB vuoto per ${catLabel}, chiedo all'AI...`);
        }

        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (aiArticles && aiArticles.length > 0) {
            setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
            db.saveArticles(catLabel, aiArticles).catch(() => {});
        } else {
            const fallback = await db.getCachedArticles(catLabel, catId);
            if (fallback.length > 0) {
                setArticles(fallback);
            } else {
                setNotification("Nessuna notizia trovata al momento.");
            }
        }
    } catch (error: any) {
        console.error("[NewsApp] Errore fetch:", error);
        setNotification("Errore di connessione.");
    } finally {
        setLoading(false);
        isFetchingRef.current = false;
    }
  };

  const handleCategoryChange = (catId: string) => {
    if (activeCategoryId === catId && !showFavoritesOnly) return;
    setActiveCategoryId(catId);
    setShowFavoritesOnly(false);
    const cat = categories.find(c => c.id === catId);
    if (cat) fetchNewsForCategory(catId, cat.label, cat.value, false); 
  };

  const handleRefresh = () => {
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) fetchNewsForCategory(activeCategoryId, cat.label, cat.value, true);
  };

  const handleArticleUpdate = (updatedArticle: Article) => {
    setArticles(prev => prev.map(a => (a.url === updatedArticle.url || a.id === updatedArticle.id) ? { ...a, ...updatedArticle } : a));
  };

  const handleToggleFavorite = async (article: Article) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    let id = article.id;
    if (!id) {
        const saved = await db.saveArticles(article.category, [article]);
        if (saved.length > 0) id = saved[0].id;
    }
    if (!id) return;

    const isFav = favoriteArticleIds.has(id);
    try {
        if (isFav) {
            setFavoriteArticleIds(p => { const n = new Set(p); n.delete(id!); return n; });
            await db.removeFavorite(id, currentUser.id);
        } else {
            setFavoriteArticleIds(p => new Set(p).add(id!));
            await db.addFavorite(id, currentUser.id);
        }
    } catch (e) {}
  };

  return {
    categories, activeCategoryId, articles, activeCategoryLabel: categories.find(c => c.id === activeCategoryId)?.label,
    loading, selectedArticle, showLoginModal, showFavoritesOnly, currentUser, favoriteArticleIds, notification,
    setActiveCategoryId: handleCategoryChange, setSelectedArticle, setShowLoginModal, setShowFavoritesOnly,
    handleLogin: () => setShowLoginModal(true), 
    handleLogout: () => db.signOut(),
    handleAddCategory: async (l: string) => {
        if (!currentUser) { setShowLoginModal(true); return; }
        const n = await db.addCategory(l, l, currentUser.id);
        if (n) { setCategories(p => [...p, n]); handleCategoryChange(n.id); }
    },
    loadNews: handleRefresh,
    onImageGenerated: (u: string, i: string) => setArticles(p => p.map(a => a.url === u ? { ...a, imageUrl: i } : a)),
    handleToggleFavorite, handleArticleUpdate 
  };
};
