
import { useState, useEffect, useRef } from 'react';
import { db, supabase } from '../services/dbService';
import { fetchPositiveNews } from '../services/geminiService';
import { Category, Article, User, DEFAULT_CATEGORIES } from '../types';

export const useNewsApp = () => {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(DEFAULT_CATEGORIES[0].id); 
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false); 
  
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [favoriteArticleIds, setFavoriteArticleIds] = useState<Set<string>>(new Set());
  
  const [notification, setNotification] = useState<string | null>(null);

  const initialLoadTriggered = useRef(false);
  const fetchCounterRef = useRef(0);

  // 1. Caricamento notizie iniziale (pubblico)
  useEffect(() => {
    if (!initialLoadTriggered.current) {
        initialLoadTriggered.current = true;
        const first = DEFAULT_CATEGORIES[0];
        fetchNewsForCategory(first.id, first.label, first.value, false);
    }
  }, []);

  // 2. Gestione Autenticazione con Timeout di sicurezza e logging
  useEffect(() => {
    const initAuth = async () => {
        // Aumentato timeout a 10 secondi per maggiore resilienza
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AUTH_TIMEOUT")), 10000));
        
        try {
            console.log("[Auth] Inizializzazione sessione...");
            const { data, error: sessionError } = await Promise.race([
                supabase.auth.getSession(),
                timeoutPromise
            ]) as any;
            
            if (sessionError) throw sessionError;
            
            const session = data?.session;
            if (session?.user) {
                console.log("[Auth] Sessione trovata per:", session.user.email);
                const profile = await db.getCurrentUserProfile();
                if (profile) {
                    setCurrentUser(profile);
                    const ids = await db.getUserFavoritesIds(profile.id);
                    setFavoriteArticleIds(ids);
                }
            } else {
                console.log("[Auth] Nessuna sessione attiva.");
                setCurrentUser(null);
            }
        } catch (e) {
            console.error("[Auth] Errore inizializzazione lenta o fallita:", e);
        } finally {
            setAuthInitialized(true);
        }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("[Auth] Evento cambiamento stato:", event);
        if (event === 'SIGNED_IN') {
            if (session?.user) {
                const profile = await db.getCurrentUserProfile();
                setCurrentUser(profile);
                setShowLoginModal(false);
                if (profile) {
                    const ids = await db.getUserFavoritesIds(profile.id);
                    setFavoriteArticleIds(ids);
                }
            }
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setFavoriteArticleIds(new Set());
            setShowFavoritesOnly(false);
        } else if (event === 'INITIAL_SESSION') {
             // Gestito già da initAuth, ma utile per debug
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    const currentFetchId = ++fetchCounterRef.current;
    setLoading(true);
    setNotification(null);
    
    try {
        if (!forceAi) {
            const cached = await db.getCachedArticles(catLabel, catId);
            if (currentFetchId !== fetchCounterRef.current) return;
            
            if (cached && cached.length > 0) {
                setArticles(cached);
                setLoading(false);
                return;
            }
        }

        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (currentFetchId !== fetchCounterRef.current) return;

        if (aiArticles && aiArticles.length > 0) {
            setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
            db.saveArticles(catLabel, aiArticles).catch(() => {});
        } else {
            setNotification("Nessuna nuova notizia trovata al momento. Mostro quelle salvate.");
            const fallback = await db.getCachedArticles(catLabel, catId);
            if (fallback.length > 0) setArticles(fallback);
        }
    } catch (error: any) {
        console.error("Fetch error:", error);
        if (error.message === "API_KEY_MISSING") {
             setNotification("Configura la chiave API di Google per sbloccare l'IA.");
        } else {
             setNotification("Impossibile caricare le notizie aggiornate. Riprova tra poco.");
        }
        // Fallback su cache in caso di errore
        const fallback = await db.getCachedArticles(catLabel, catId);
        if (fallback.length > 0) setArticles(fallback);
    } finally {
        if (currentFetchId === fetchCounterRef.current) {
            setLoading(false);
        }
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
    isAppLoading: !authInitialized,
    loading, 
    selectedArticle, showLoginModal, showFavoritesOnly, currentUser, 
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
            await db.removeFavorite(id, currentUser.id).catch(() => {});
        } else {
            setFavoriteArticleIds(p => new Set(p).add(id!));
            await db.addFavorite(id, currentUser.id).catch(() => {});
        }
    }, 
    handleArticleUpdate: (updated: Article) => {
        setArticles(prev => prev.map(a => (a.url === updated.url || a.id === updated.id) ? { ...a, ...updated } : a));
    }
  };
};
