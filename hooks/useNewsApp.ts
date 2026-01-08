
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
  const fetchCounterRef = useRef(0);

  useEffect(() => {
    if (!initialLoadTriggered.current) {
        initialLoadTriggered.current = true;
        const first = DEFAULT_CATEGORIES[0];
        fetchNewsForCategory(first.id, first.label, first.value, false);
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
        try {
            const profile = await db.getCurrentUserProfile();
            if (profile) {
                setCurrentUser(profile);
                const ids = await db.getUserFavoritesIds(profile.id);
                setFavoriteArticleIds(ids);
            }
        } catch (e) {
            console.error("[App] Errore checkUser iniziale:", e);
        }
    };
    checkUser();

    // Supabase v2 signature: onAuthStateChange((event, session) => ...)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`[App] Auth Event: ${event}`);
        
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
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
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    const currentFetchId = ++fetchCounterRef.current;
    
    setLoading(true);
    setNotification(null);
    
    console.log(`[App] Richiesta notizie #${currentFetchId} per ${catLabel}`);
    
    try {
        // 1. Prova DB (con timeout interno)
        if (!forceAi) {
            const cached = await db.getCachedArticles(catLabel, catId);
            // Se nel frattempo l'utente ha cambiato categoria, ignoriamo il risultato
            if (currentFetchId !== fetchCounterRef.current) return;

            if (cached && cached.length > 0) {
                console.log(`[App] OK: Visualizzo ${cached.length} notizie dalla cache.`);
                setArticles(cached);
                setLoading(false);
                return;
            }
        }

        // 2. Chiamata Gemini (se DB vuoto o timeout o refresh)
        console.log("[App] Caricamento tramite AI...");
        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (currentFetchId !== fetchCounterRef.current) return;

        if (aiArticles && aiArticles.length > 0) {
            console.log(`[App] OK: Ricevute ${aiArticles.length} notizie da Gemini.`);
            setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
            db.saveArticles(catLabel, aiArticles).catch(() => {});
        } else {
            setNotification("Nessuna nuova notizia trovata. Riprova tra poco.");
            // Se Gemini fallisce, proviamo a mostrare comunque quello che c'è nel DB se disponibile
            const fallback = await db.getCachedArticles(catLabel, catId);
            if (fallback.length > 0) setArticles(fallback);
        }
    } catch (error) {
        console.error("[App] Errore critico nel flusso:", error);
        setNotification("Errore di connessione. Controlla la tua rete.");
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
