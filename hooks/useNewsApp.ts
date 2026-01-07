
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
        console.log("[DIAGNOSTIC-APP] Boot: Avvio caricamento iniziale.");
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
                console.log("[DIAGNOSTIC-APP] Utente loggato rilevato:", user.email);
                const profile = await db.getCurrentUserProfile();
                setCurrentUser(profile);
                if (profile) {
                    const ids = await db.getUserFavoritesIds(profile.id);
                    setFavoriteArticleIds(ids);
                }
            } else {
                console.log("[DIAGNOSTIC-APP] Sessione ospite.");
            }
        } catch (e) {
            console.warn("[DIAGNOSTIC-APP] Errore verifica utente:", e);
        }
    };
    checkUser();

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string, session: any) => {
        console.log("[DIAGNOSTIC-APP] Auth Event:", event);
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
    if (isFetchingRef.current) {
        console.log("[DIAGNOSTIC-APP] Fetch ignorato: operazione già in corso.");
        return;
    }
    
    isFetchingRef.current = true;
    setLoading(true);
    setNotification(null);
    
    console.log(`[DIAGNOSTIC-APP] STEP 1: Richiesta news per "${catLabel}" (ForceAI: ${forceAi})`);
    
    try {
        if (!forceAi) {
            console.log("[DIAGNOSTIC-APP] STEP 2: Controllo cache database...");
            const cached = await db.getCachedArticles(catLabel);
            if (cached && cached.length > 0) {
                console.log(`[DIAGNOSTIC-APP] STEP 3: Utilizzo ${cached.length} articoli dalla cache.`);
                setArticles(cached); 
                setLoading(false); 
                isFetchingRef.current = false;
                return; 
            }
            console.log("[DIAGNOSTIC-APP] STEP 2b: Cache vuota o non disponibile.");
        }

        console.log("[DIAGNOSTIC-APP] STEP 4: Avvio fetch tramite Gemini AI...");
        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (aiArticles && aiArticles.length > 0) {
            console.log(`[DIAGNOSTIC-APP] STEP 5: Ricevuti ${aiArticles.length} articoli dall'AI.`);
            setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
            
            // Salvataggio asincrono in cache
            db.saveArticles(catLabel, aiArticles).then(() => {
                console.log("[DIAGNOSTIC-APP] STEP 6: Cache aggiornata con successo.");
            }).catch(e => {
                console.warn("[DIAGNOSTIC-APP] STEP 6 Error: Salvataggio cache fallito.");
            });
        } else {
            console.warn("[DIAGNOSTIC-APP] STEP 5 Error: Nessun articolo ricevuto.");
            setNotification("Spiacenti, non abbiamo trovato notizie positive per questa categoria al momento.");
        }
    } catch (error: any) {
        console.error("[DIAGNOSTIC-APP] FATAL ERROR nel ciclo di fetch:", error.message);
        setNotification("Il servizio news ha riscontrato un problema tecnico. Riprova più tardi.");
    } finally {
        setLoading(false);
        isFetchingRef.current = false;
        console.log("[DIAGNOSTIC-APP] Operazione terminata.");
    }
  };

  const handleCategoryChange = (catId: string) => {
    if (activeCategoryId === catId && !showFavoritesOnly) return;
    
    console.log(`[DIAGNOSTIC-APP] Cambio categoria -> ${catId}`);
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
            console.error("[DIAGNOSTIC-APP] Errore salvataggio per preferiti:", e);
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
        console.log("[DIAGNOSTIC-APP] Logout eseguito.");
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
