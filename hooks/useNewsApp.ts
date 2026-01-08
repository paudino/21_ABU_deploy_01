
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

  // 1. CARICAMENTO IMMEDIATO
  useEffect(() => {
    if (!initialLoadTriggered.current) {
        console.log("[NewsApp] Boot: Avvio caricamento iniziale.");
        initialLoadTriggered.current = true;
        const firstCat = DEFAULT_CATEGORIES[0];
        fetchNewsForCategory(firstCat.id, firstCat.label, firstCat.value, false);
    }
  }, []);

  // 2. MONITORAGGIO AUTH
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
        } catch (e) {
            console.warn("[NewsApp] Errore verifica utente:", e);
        }
    };
    checkUser();

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

    return () => { subscription.unsubscribe(); };
  }, []);

  // Caricamento Notizie
  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    setNotification(null);
    
    try {
        if (!forceAi) {
            // Cerchiamo nel DB usando sia il Label che l'ID per sicurezza
            const cached = await db.getCachedArticles(catLabel, catId);
            if (cached && cached.length > 0) {
                console.log(`[NewsApp] Caricati ${cached.length} articoli dalla cache.`);
                setArticles(cached); 
                setLoading(false); 
                isFetchingRef.current = false;
                return; 
            }
        }

        // Se non ci sono dati in cache o abbiamo forzato l'AI
        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (aiArticles && aiArticles.length > 0) {
            setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
            db.saveArticles(catLabel, aiArticles).catch(e => console.warn("[NewsApp] Errore salvataggio cache:", e));
        } else {
            // Se Gemini fallisce, proviamo comunque a caricare ciò che abbiamo nel DB come ultima risorsa
            const fallbackCached = await db.getCachedArticles(catLabel, catId);
            if (fallbackCached.length > 0) {
                setArticles(fallbackCached);
            } else {
                setNotification("Spiacenti, non abbiamo trovato notizie positive per questa categoria.");
            }
        }
    } catch (error: any) {
        console.error("[NewsApp] Errore fatale fetch:", error.message);
        setNotification("Problema tecnico nel caricamento delle notizie.");
    } finally {
        setLoading(false);
        isFetchingRef.current = false;
    }
  };

  const handleCategoryChange = (catId: string) => {
    if (activeCategoryId === catId && !showFavoritesOnly) return;
    
    setActiveCategoryId(catId);
    setShowFavoritesOnly(false);
    setArticles([]); 
    
    const cat = categories.find(c => c.id === catId);
    if (cat) fetchNewsForCategory(catId, cat.label, cat.value, false); 
  };

  const handleRefresh = () => {
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) {
          setArticles([]); 
          fetchNewsForCategory(activeCategoryId, cat.label, cat.value, true);
      }
  };

  const handleArticleUpdate = (updatedArticle: Article) => {
    setArticles(prev => prev.map(a => {
        if (updatedArticle.id && a.id === updatedArticle.id) return updatedArticle;
        if (updatedArticle.url && a.url === updatedArticle.url) return { ...updatedArticle, id: a.id || updatedArticle.id };
        return a;
    }));
    if (selectedArticle && (selectedArticle.id === updatedArticle.id || selectedArticle.url === updatedArticle.url)) {
        setSelectedArticle(updatedArticle);
    }
  };

  const handleToggleFavorite = async (article: Article) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    
    let articleId = article.id;
    let articleToUpdate = { ...article };

    if (!articleId) {
        try {
            const saved = await db.saveArticles(article.category || 'Generale', [article]);
            if (saved && saved.length > 0) {
                articleId = saved[0].id;
                articleToUpdate = saved[0];
            }
        } catch (e) {
            console.error("[NewsApp] Errore salvataggio preferito:", e);
            return;
        }
    }
    
    if (!articleId) return;

    const isCurrentlyFav = favoriteArticleIds.has(articleId);
    
    try {
        if (isCurrentlyFav) {
            setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(articleId!); return n; });
            await db.removeFavorite(articleId, currentUser.id);
        } else {
            setFavoriteArticleIds(prev => new Set(prev).add(articleId!));
            await db.addFavorite(articleId, currentUser.id);
        }
        handleArticleUpdate(articleToUpdate);
    } catch (e) {
        console.error("Errore toggle preferito:", e);
    }
  };

  return {
    categories, activeCategoryId, articles, activeCategoryLabel: categories.find(c => c.id === activeCategoryId)?.label,
    loading, selectedArticle, showLoginModal, showFavoritesOnly, currentUser, favoriteArticleIds, notification,
    setActiveCategoryId: handleCategoryChange, setSelectedArticle, setShowLoginModal, setShowFavoritesOnly,
    handleLogin: async () => {}, 
    handleLogout: async () => { 
        setCurrentUser(null); 
        setFavoriteArticleIds(new Set()); 
        setShowFavoritesOnly(false); 
        await db.signOut(); 
    },
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
