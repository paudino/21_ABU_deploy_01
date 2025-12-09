
import { useState, useEffect, useRef } from 'react';
import { db, supabase } from '../services/dbService';
import { fetchPositiveNews } from '../services/geminiService';
import { Category, Article, User, DEFAULT_CATEGORIES } from '../types';

export const useNewsApp = () => {
  // Stati principali
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(''); 
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stati UI e Utente
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [favoriteArticleIds, setFavoriteArticleIds] = useState<Set<string>>(new Set());
  
  const [notification, setNotification] = useState<string | null>(null);

  // Refs per gestione stato asincrono
  const activeCategoryIdRef = useRef<string>('');
  const initialLoadDone = useRef(false);

  // 1. GESTIONE UTENTE E AUTH
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
                if (showFavoritesOnly) loadFavorites(user.id);
            }
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setFavoriteArticleIds(new Set());
            setShowFavoritesOnly(false); 
        }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // 2. GESTIONE CARICAMENTO CATEGORIE IN BASE ALL'UTENTE
  useEffect(() => {
      const refreshCategories = async () => {
          try {
              // Carica categorie pubbliche + private (se user loggato)
              let dbCategories = await db.getCategories(currentUser?.id);

              // Se vuote (prima installazione), seed
              if (!dbCategories || dbCategories.length === 0) {
                  await db.seedCategories();
                  dbCategories = await db.getCategories(currentUser?.id);
              }
              
              // Fallback estremo
              if (!dbCategories || dbCategories.length === 0) dbCategories = DEFAULT_CATEGORIES;
              
              setCategories(dbCategories);

              // CHECK CONSISTENZA: Se l'utente si slogga e la categoria attiva era una sua privata,
              // quella categoria non esiste più nella lista 'dbCategories'. Dobbiamo resettare.
              const currentActiveStillExists = dbCategories.find(c => c.id === activeCategoryIdRef.current);
              
              if (!currentActiveStillExists && dbCategories.length > 0) {
                  // Resetta sulla prima categoria disponibile (es. "Tecnologia")
                  const firstCat = dbCategories[0];
                  setActiveCategoryId(firstCat.id);
                  activeCategoryIdRef.current = firstCat.id;
                  
                  // Se non siamo nei preferiti, ricarichiamo le news
                  if (!showFavoritesOnly && initialLoadDone.current) {
                      setArticles([]); // clear
                      fetchNewsForCategory(firstCat.id, firstCat.label, firstCat.value, false);
                  }
              }

          } catch (e) {
              console.error("Errore refresh categorie:", e);
          }
      };

      refreshCategories();
  }, [currentUser]); // Triggera quando l'utente cambia (Login/Logout)

  // Helper separato per caricare i preferiti
  const loadFavorites = async (userId: string) => {
      setLoading(true);
      setArticles([]); // Pulisci vista
      try {
          const favArticles = await db.getUserFavoriteArticles(userId);
          setArticles(favArticles);
          const ids = new Set(favArticles.map(a => a.id).filter(Boolean) as string[]);
          setFavoriteArticleIds(ids);
      } catch (e) {
          console.error(e);
          setNotification("Impossibile caricare i preferiti.");
      } finally {
          setLoading(false);
      }
  };

  // 3. GESTIONE CAMBIO VISTA (Preferiti <-> Categorie)
  useEffect(() => {
      if (!initialLoadDone.current && !currentUser) return;

      const switchView = async () => {
          if (showFavoritesOnly) {
              if (currentUser) {
                  await loadFavorites(currentUser.id);
              } else {
                  setShowLoginModal(true);
                  setShowFavoritesOnly(false);
              }
          } else {
              if (activeCategoryIdRef.current && categories.length > 0) {
                  const cat = categories.find(c => c.id === activeCategoryIdRef.current);
                  if (cat) {
                      setArticles([]); 
                      await fetchNewsForCategory(cat.id, cat.label, cat.value, false);
                  }
              }
          }
      };

      switchView();
  }, [showFavoritesOnly]); 

  // 4. LOGICA DI STARTUP INIZIALE (Solo prima news)
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const startUp = async () => {
      setLoading(true);
      try {
        // NOTA: Le categorie vengono caricate dall'altro useEffect. 
        // Qui ci occupiamo solo di caricare le notizie della prima categoria (Default)
        // Assumiamo che DEFAULT_CATEGORIES esistano sempre o vengano fetchate velocemente.
        
        // Aspettiamo un attimo che il db risponda o usiamo i default statici per la prima chiamata
        let startCat = DEFAULT_CATEGORIES[0];
        
        // Se abbiamo già categorie caricate dallo stato (raro al primo render), usiamo quelle
        if (categories.length > 0) startCat = categories[0];

        setActiveCategoryId(startCat.id);
        activeCategoryIdRef.current = startCat.id;

        if (!showFavoritesOnly) {
           const cached = await db.getCachedArticles(startCat.label);
           if (cached && cached.length > 0) {
                setArticles(cached); 
                setLoading(false);
           } else {
                await fetchNewsForCategory(startCat.id, startCat.label, startCat.value, true);
           }
        }
        
        setTimeout(() => { db.cleanupOldArticles().catch(console.error); }, 10000);

      } catch (e) {
        console.error("[StartUp] Errore critico:", e);
        setLoading(false);
      }
    };

    startUp();
  }, []);

  const handleCategoryChange = (catId: string) => {
    activeCategoryIdRef.current = catId;
    setActiveCategoryId(catId);
    
    if (showFavoritesOnly) { 
        setShowFavoritesOnly(false); 
        return; 
    }
    
    setArticles([]); 
    setNotification(null);
    setLoading(true);

    const cat = categories.find(c => c.id === catId);
    if (cat) {
        fetchNewsForCategory(catId, cat.label, cat.value, false); 
    } else {
        console.warn(`[NewsApp] Categoria ${catId} non trovata durante lo switch. Reset loading.`);
        setLoading(false);
    }
  };

  const fetchNewsForCategory = async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    if (showFavoritesOnly && !forceAi) return; 

    setLoading(true);
    setNotification(null);
    
    try {
        if (!forceAi) {
            const cached = await db.getCachedArticles(catLabel);
            if (cached && cached.length > 0) {
                setArticles(cached); 
                setLoading(false); 
                return; 
            }
        }

        const aiArticles = await fetchPositiveNews(catValue, catLabel);
        
        if (aiArticles.length > 0) {
            const newArticles = aiArticles.map(a => ({ ...a, isNew: true }));
            setArticles(newArticles);
            
            db.saveArticles(catLabel, aiArticles).then(saved => {
                 setArticles(current => {
                    const idMap = new Map<string, string>();
                    saved.forEach(s => { if (s.url && s.id) idMap.set(s.url, s.id); });
                    return current.map(a => ({ ...a, id: idMap.get(a.url) || a.id }));
                 });
            }).catch(console.error);
        } else {
            if (forceAi) setNotification("Nessuna nuova notizia trovata dall'AI.");
            else setNotification("Nessuna notizia in archivio.");
        }
    } catch (error) {
        setNotification("Errore durante il recupero delle notizie.");
    } finally {
        setLoading(false);
    }
  };

  const handleRefresh = () => {
      if (showFavoritesOnly) {
          if (currentUser) loadFavorites(currentUser.id);
          return;
      }
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) fetchNewsForCategory(activeCategoryId, cat.label, cat.value, true);
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
    let isNewId = false;

    if (!articleId) {
        const saved = await db.saveArticles(article.category || 'Generale', [article]);
        if (saved && saved.length > 0) {
            articleId = saved[0].id;
            isNewId = true;
        }
    }

    if (!articleId) {
        alert("Impossibile salvare: Errore generazione ID.");
        return;
    }

    if (isNewId) {
        setArticles(prev => prev.map(a => a.url === article.url ? { ...a, id: articleId } : a));
    }

    const isCurrentlyFav = favoriteArticleIds.has(articleId);

    if (isCurrentlyFav) {
        setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(articleId!); return n; });
        
        if (showFavoritesOnly) {
             setArticles(prev => prev.filter(a => a.id !== articleId));
             if (selectedArticle?.id === articleId) setSelectedArticle(null);
        }
        
        const success = await db.removeFavorite(articleId, currentUser.id);
        if (!success) {
            console.error("Rollback Rimozione");
            setFavoriteArticleIds(prev => new Set(prev).add(articleId!));
            if (showFavoritesOnly) setNotification("Errore rimozione preferito.");
        }

    } else {
        setFavoriteArticleIds(prev => new Set(prev).add(articleId!));
        const success = await db.addFavorite(articleId, currentUser.id);
        if (!success) {
            console.error("Rollback Aggiunta");
            setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(articleId!); return n; });
        }
    }
  };

  const activeCategoryLabel = categories.find(c => c.id === activeCategoryId)?.label;

  return {
    categories,
    activeCategoryId,
    articles,
    activeCategoryLabel,
    loading,
    selectedArticle,
    showLoginModal,
    showFavoritesOnly,
    currentUser,
    favoriteArticleIds,
    notification,
    setActiveCategoryId: handleCategoryChange,
    setSelectedArticle,
    setShowLoginModal,
    setShowFavoritesOnly,
    handleLogin: async () => {}, 
    handleLogout: async () => {
        setCurrentUser(null);
        setFavoriteArticleIds(new Set());
        setShowFavoritesOnly(false); 
        await db.signOut();
    },
    handleAddCategory: async (l: string) => {
        if (!currentUser) {
            setShowLoginModal(true);
            return;
        }

        const v = `${l} notizie positive`;
        // Passiamo l'ID utente per salvarla come categoria privata
        const n = await db.addCategory(l, v, currentUser.id);
        
        if (n) { 
            setCategories(p => [...p, n]);
            setActiveCategoryId(n.id);
            activeCategoryIdRef.current = n.id;
            setArticles([]);
            setNotification(null);
            fetchNewsForCategory(n.id, n.label, n.value, false);
        }
    },
    loadNews: handleRefresh,
    onImageGenerated: (u: string, i: string) => {
        setArticles(p => p.map(a => a.url === u ? { ...a, imageUrl: i } : a));
    },
    handleToggleFavorite,
    handleArticleUpdate 
  };
};
