
import { useState, useEffect, useRef } from 'react';
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

  const activeCategoryIdRef = useRef<string>('');
  const initialLoadDone = useRef(false);
  const isFetchingRef = useRef(false);

  // Monitoraggio utente e auth
  useEffect(() => {
    const checkUser = async () => {
        const user = await db.getCurrentUserProfile();
        setCurrentUser(user);
        if (user) {
            const ids = await db.getUserFavoritesIds(user.id);
            setFavoriteArticleIds(ids);
        }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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

  // Sync categorie dal DB
  useEffect(() => {
      const refreshCategories = async () => {
          try {
              let dbCategories = await db.getCategories(currentUser?.id);
              if (!dbCategories || dbCategories.length === 0) {
                  await db.seedCategories();
                  dbCategories = await db.getCategories(currentUser?.id);
              }
              if (!dbCategories || dbCategories.length === 0) dbCategories = DEFAULT_CATEGORIES;
              setCategories(dbCategories);

              // Se non c'è una categoria attiva, imposta la prima
              if (!activeCategoryIdRef.current && dbCategories.length > 0) {
                  const firstCat = dbCategories[0];
                  setActiveCategoryId(firstCat.id);
                  activeCategoryIdRef.current = firstCat.id;
              }
          } catch (e) {
              console.error("Errore refresh categorie:", e);
          }
      };
      refreshCategories();
  }, [currentUser]);

  // Caricamento Notizie
  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    if (showFavoritesOnly && !forceAi) return; 
    if (isFetchingRef.current) {
        console.warn("[Fetch] Già in corso, ignoro richiesta.");
        return;
    }
    
    isFetchingRef.current = true;
    setLoading(true);
    setNotification(null);
    
    try {
        // Se NON è un refresh forzato, controlliamo la cache locale
        if (!forceAi) {
            const cached = await db.getCachedArticles(catLabel);
            if (cached && cached.length > 0) {
                console.log(`%c[Source: DB-Cache] Dati caricati dall'archivio per: ${catLabel}`, "color: #6366f1; font-weight: bold");
                setArticles(cached); 
                setLoading(false); 
                isFetchingRef.current = false;
                return; 
            }
        } else {
            console.log(`%c[Source: FORCE-AI] Ignoro cache e cerco nuove notizie per: ${catLabel}`, "color: #f59e0b; font-weight: bold");
        }

        // Chiamata all'AI (che include il recupero RSS)
        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (aiArticles && aiArticles.length > 0) {
            // Mostriamo subito i risultati (sia quelli tradotti da Gemini che il fallback RSS originale)
            const articlesWithNewTag = aiArticles.map(a => ({ ...a, isNew: true }));
            setArticles(articlesWithNewTag);
            
            // Salvataggio in background per le prossime volte
            db.saveArticles(catLabel, aiArticles).then(saved => {
                 setArticles(current => {
                    const idMap = new Map<string, string>();
                    saved.forEach(s => { if (s.url && s.id) idMap.set(s.url, s.id); });
                    return current.map(a => ({ ...a, id: idMap.get(a.url) || a.id }));
                 });
            }).catch(err => console.error("[DB] Errore salvataggio:", err));

        } else {
            setNotification("Nessuna notizia trovata in questo momento. Riprova più tardi.");
        }
    } catch (error: any) {
        console.error("%c[Fetch-Error] Impossibile recuperare notizie:", "color: #ef4444", error);
        setNotification(`Errore: ${error.message || 'Servizio momentaneamente non disponibile'}`);
        
        // Fallback estremo: se non abbiamo nulla, proviamo a mostrare quello che c'è nel DB
        if (articles.length === 0) {
            const cachedFallback = await db.getCachedArticles(catLabel);
            if (cachedFallback.length > 0) setArticles(cachedFallback);
        }
    } finally {
        setLoading(false);
        isFetchingRef.current = false;
    }
  };

  // Caricamento iniziale
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    
    const startUp = async () => {
      setLoading(true);
      try {
        await db.seedInspiration().catch(console.error);
        
        // Aspettiamo un attimo che le categorie siano caricate dal DB
        setTimeout(async () => {
            const currentCat = categories.find(c => c.id === activeCategoryIdRef.current) || DEFAULT_CATEGORIES[0];
            if (!showFavoritesOnly) {
               await fetchNewsForCategory(currentCat.id, currentCat.label, currentCat.value, false);
            }
        }, 500);

        setTimeout(() => { db.cleanupOldArticles().catch(console.error); }, 15000);
      } catch (e) {
        setLoading(false);
      }
    };
    startUp();
  }, [categories.length]); // Si attiva quando le categorie sono pronte

  const handleCategoryChange = (catId: string) => {
    if (activeCategoryIdRef.current === catId && !showFavoritesOnly) return;
    
    console.log(`[UI] Cambio categoria -> ${catId}`);
    activeCategoryIdRef.current = catId;
    setActiveCategoryId(catId);
    
    if (showFavoritesOnly) {
        setShowFavoritesOnly(false);
        return; 
    }

    setArticles([]); // Pulisci la vista per feedback immediato
    const cat = categories.find(c => c.id === catId);
    if (cat) fetchNewsForCategory(catId, cat.label, cat.value, false); 
  };

  const handleRefresh = () => {
      // Usiamo il Ref per essere sicuri di avere l'ID corrente reale
      const currentId = activeCategoryIdRef.current;
      const cat = categories.find(c => c.id === currentId);
      console.log(`[UI] Richiesta refresh per categoria ID: ${currentId} (${cat?.label})`);
      if (cat) {
          setArticles([]); // Feedback visivo immediato (mostra skeleton)
          fetchNewsForCategory(currentId, cat.label, cat.value, true);
      }
  };

  const handleArticleUpdate = (updatedArticle: Article) => {
    setArticles(prev => prev.map(a => {
        if (updatedArticle.id && a.id === updatedArticle.id) return updatedArticle;
        if (updatedArticle.url && a.url === updatedArticle.url) return { ...updatedArticle, id: a.id || updatedArticle.id };
        return a;
    }));
  };

  const handleToggleFavorite = async (article: Article) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    let articleId = article.id;
    if (!articleId) {
        const saved = await db.saveArticles(article.category || 'Generale', [article]);
        if (saved && saved.length > 0) articleId = saved[0].id;
    }
    if (!articleId) return;
    const isCurrentlyFav = favoriteArticleIds.has(articleId);
    if (isCurrentlyFav) {
        setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(articleId!); return n; });
        if (showFavoritesOnly) setArticles(prev => prev.filter(a => a.id !== articleId));
        await db.removeFavorite(articleId, currentUser.id);
    } else {
        setFavoriteArticleIds(prev => new Set(prev).add(articleId!));
        await db.addFavorite(articleId, currentUser.id);
    }
  };

  return {
    categories, activeCategoryId, articles, activeCategoryLabel: categories.find(c => c.id === activeCategoryId)?.label,
    loading, selectedArticle, showLoginModal, showFavoritesOnly, currentUser, favoriteArticleIds, notification,
    setActiveCategoryId: handleCategoryChange, setSelectedArticle, setShowLoginModal, setShowFavoritesOnly,
    handleLogin: async () => {}, 
    handleLogout: async () => { setCurrentUser(null); setFavoriteArticleIds(new Set()); setShowFavoritesOnly(false); await db.signOut(); },
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
