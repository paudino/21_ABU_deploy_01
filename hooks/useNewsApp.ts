
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

  // Effetto per il caricamento iniziale
  useEffect(() => {
    if (!initialLoadTriggered.current) {
        console.log("[App] Boot iniziale...");
        initialLoadTriggered.current = true;
        const first = DEFAULT_CATEGORIES[0];
        fetchNewsForCategory(first.id, first.label, first.value, false);
    }
  }, []);

  // Effetto per l'utente
  useEffect(() => {
    const checkUser = async () => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (user) {
            const profile = await db.getCurrentUserProfile();
            setCurrentUser(profile);
            if (profile) {
                const ids = await db.getUserFavoritesIds(profile.id);
                setFavoriteArticleIds(ids);
            }
        }
    };
    checkUser();

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string) => {
        if (event === 'SIGNED_IN') {
            const profile = await db.getCurrentUserProfile();
            setCurrentUser(profile);
            setShowLoginModal(false);
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setFavoriteArticleIds(new Set());
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    if (isFetchingRef.current && !forceAi) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    setNotification(null);
    
    console.log(`[App] Avvio fetchNews per ${catLabel}...`);
    
    try {
        // 1. Prova a leggere dal DB
        if (!forceAi) {
            const cached = await db.getCachedArticles(catLabel, catId);
            if (cached && cached.length > 0) {
                console.log(`[App] Dati ricevuti dal DB: ${cached.length} articoli.`);
                setArticles(cached);
                setLoading(false);
                isFetchingRef.current = false;
                return;
            }
        }

        // 2. Se DB vuoto o forceAi, chiedi a Gemini
        console.log("[App] Cache vuota o Refresh: Chiamata Gemini in corso...");
        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (aiArticles && aiArticles.length > 0) {
            console.log(`[App] Dati ricevuti dall'AI: ${aiArticles.length} articoli.`);
            setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
            // Salvataggio asincrono in background
            db.saveArticles(catLabel, aiArticles).catch(() => {});
        } else {
            setNotification("Nessuna nuova notizia trovata al momento.");
        }
    } catch (error) {
        console.error("[App] Errore nel flusso di fetch:", error);
        setNotification("Si è verificato un errore nel caricamento.");
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

  return {
    categories, activeCategoryId, articles, 
    activeCategoryLabel: categories.find(c => c.id === activeCategoryId)?.label,
    loading, selectedArticle, showLoginModal, showFavoritesOnly, currentUser, 
    favoriteArticleIds, notification,
    setActiveCategoryId: handleCategoryChange, 
    setSelectedArticle, 
    setShowLoginModal, 
    setShowFavoritesOnly,
    handleLogin: () => setShowLoginModal(true), 
    handleLogout: () => db.signOut(),
    handleAddCategory: async (l: string) => {
        if (!currentUser) { setShowLoginModal(true); return; }
        const n = await db.addCategory(l, l, currentUser.id);
        if (n) { setCategories(p => [...p, n]); handleCategoryChange(n.id); }
    },
    loadNews: () => {
        const cat = categories.find(c => c.id === activeCategoryId);
        if (cat) fetchNewsForCategory(activeCategoryId, cat.label, cat.value, true);
    },
    onImageGenerated: (u: string, i: string) => setArticles(p => p.map(a => a.url === u ? { ...a, imageUrl: i } : a)),
    handleToggleFavorite: async (article: Article) => {
        if (!currentUser) { setShowLoginModal(true); return; }
        let id = article.id;
        if (!id) {
            const saved = await db.saveArticles(article.category, [article]);
            if (saved.length > 0) id = saved[0].id;
        }
        if (!id) return;
        if (favoriteArticleIds.has(id)) {
            setFavoriteArticleIds(p => { const n = new Set(p); n.delete(id!); return n; });
            await db.removeFavorite(id, currentUser.id);
        } else {
            setFavoriteArticleIds(p => new Set(p).add(id!));
            await db.addFavorite(id, currentUser.id);
        }
    }, 
    handleArticleUpdate: (updated: Article) => {
        setArticles(prev => prev.map(a => (a.url === updated.url || a.id === updated.id) ? { ...a, ...updated } : a));
    }
  };
};
