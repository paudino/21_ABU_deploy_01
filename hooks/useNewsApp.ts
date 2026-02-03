
import { useState, useEffect, useCallback, useRef } from 'react';
import { db, supabase } from '../services/dbService';
import { fetchPositiveNews } from '../services/geminiService';
import { Category, Article, User, DEFAULT_CATEGORIES } from '../types';
import { resetQuotaBlock, isQuotaExhausted } from '../services/gemini/client';

const CACHE_TTL_MINUTES = 60; 

const EMERGENCY_NEWS: Article[] = [
    {
        title: "L'energia solare corre più veloce del previsto",
        summary: "Nuovi dati mostrano che la transizione verso le rinnovabili sta accelerando globalmente, riducendo le emissioni più rapidamente delle stime iniziali.",
        source: "Green Report",
        url: "https://www.google.com/search?q=energia+solare+crescita",
        date: new Date().toISOString().split('T')[0],
        category: "Tecnologia",
        sentimentScore: 0.95
    },
    {
        title: "Scoperta una nuova barriera corallina in salute",
        summary: "Esploratori marini hanno individuato un vasto ecosistema corallino incontaminato che mostra una resilienza inaspettata ai cambiamenti climatici.",
        source: "Nature World",
        url: "https://www.google.com/search?q=barriera+corallina+salute",
        date: new Date().toISOString().split('T')[0],
        category: "Ambiente",
        sentimentScore: 0.92
    }
];

export const useNewsApp = () => {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('tech'); 
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [favoriteArticleIds, setFavoriteArticleIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const activeFetchIdRef = useRef<number>(0);

  // Inizializzazione: Auth + Seeding Categorie
  useEffect(() => {
    const initApp = async () => {
      console.log("[APP-INIT] 🚀 Avvio applicazione...");
      
      // 1. Gestione Auth
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
          // Al logout torniamo alle categorie di default
          setCategories(DEFAULT_CATEGORIES);
        }
      });

      // 2. Caricamento profilo iniziale
      db.getCurrentUserProfile().then(setCurrentUser);

      // 3. Seeding Categorie se DB vuoto
      try {
        await db.seedCategories();
        const dbCats = await db.getCategories();
        if (dbCats && dbCats.length > 0) {
          setCategories(dbCats);
        }
      } catch (e) {
        console.error("[APP-INIT] ❌ Errore durante il seeding delle categorie:", e);
      }

      return subscription;
    };

    const subPromise = initApp();
    return () => {
      subPromise.then(sub => sub.unsubscribe());
    };
  }, []);

  // Effetto per ricaricare le categorie quando cambia l'utente (Login/Logout)
  useEffect(() => {
    const refreshCategories = async () => {
        const dbCats = await db.getCategories(currentUser?.id);
        if (dbCats && dbCats.length > 0) {
            setCategories(dbCats);
        } else {
            setCategories(DEFAULT_CATEGORIES);
        }
    };
    refreshCategories();
  }, [currentUser?.id]);

  const fetchNews = useCallback(async (query: string, label: string, forceAi: boolean) => {
    const currentFetchId = ++activeFetchIdRef.current;
    setLoading(true);
    setNotification(null);

    try {
      if (!forceAi) {
        console.log(`[FETCH] 🔍 Controllo cache per: ${label}`);
        const freshCached = await db.getCachedArticles(label, CACHE_TTL_MINUTES);
        if (currentFetchId !== activeFetchIdRef.current) return;

        if (freshCached && freshCached.length > 0) {
          setArticles(freshCached);
          setLoading(false);
          return;
        }
      }

      if (isQuotaExhausted() && !forceAi) {
          throw new Error("QUOTA_LIMIT");
      }

      console.log(`[FETCH] 🤖 Richiesta AI per: ${label}`);
      const aiArticles = await fetchPositiveNews(query, label);
      if (currentFetchId !== activeFetchIdRef.current) return;

      if (aiArticles && aiArticles.length > 0) {
        setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
        db.saveArticles(label, aiArticles);
      } else {
        throw new Error("AI_FAILED");
      }

    } catch (error: any) {
      console.warn("[FETCH] Fallimento:", error.message);
      if (currentFetchId !== activeFetchIdRef.current) return;

      const oldCached = await db.getCachedArticles(label, 0);
      if (oldCached.length > 0) {
          setArticles(oldCached);
          setNotification("Visualizzo notizie archiviate (AI temporaneamente offline).");
      } else {
          setArticles(EMERGENCY_NEWS);
          setNotification("Servizio AI in pausa. Ecco alcune notizie sempreverdi.");
      }
    } finally {
      if (currentFetchId === activeFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (showFavoritesOnly) {
      if (currentUser) {
        const currentFetchId = ++activeFetchIdRef.current;
        setLoading(true);
        db.getUserFavoriteArticles(currentUser.id).then(favs => {
          if (currentFetchId === activeFetchIdRef.current) {
            setArticles(favs);
            setLoading(false);
          }
        });
      }
    } else if (searchTerm) {
      fetchNews(searchTerm, searchTerm, false);
    } else if (activeCategoryId) {
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) fetchNews(cat.value, cat.label, false);
    }
  }, [showFavoritesOnly, currentUser, activeCategoryId, categories, searchTerm, fetchNews]);

  return {
    categories,
    activeCategoryId,
    articles,
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
      setShowFavoritesOnly(false);
      setActiveCategoryId(id);
    },
    handleSearch: (term: string) => {
      const clean = term?.trim();
      if (!clean) return;
      setActiveCategoryId(''); 
      setShowFavoritesOnly(false);
      setSearchTerm(clean);
    },
    setSelectedArticle,
    setShowLoginModal,
    setShowFavoritesOnly: (val: boolean) => {
        if (val) {
          setSearchTerm('');
          setActiveCategoryId('');
        }
        setShowFavoritesOnly(val);
    },
    handleLogout: () => {
      setCurrentUser(null);
      setFavoriteArticleIds(new Set());
      db.signOut();
    },
    handleAddCategory: async (label: string) => {
      if (!currentUser) return setShowLoginModal(true);
      
      // Controllo duplicati case-insensitive
      const exists = categories.some(c => c.label.toLowerCase() === label.toLowerCase().trim());
      if (exists) {
        setNotification(`La categoria "${label}" esiste già!`);
        setTimeout(() => setNotification(null), 3000);
        return;
      }

      const cat = await db.addCategory(label, `${label} notizie positive`, currentUser.id);
      if (cat) {
        setCategories(prev => [...prev, cat]);
        setActiveCategoryId(cat.id);
        setNotification(`Categoria "${label}" aggiunta con successo!`);
        setTimeout(() => setNotification(null), 3000);
      }
    },
    loadNews: () => {
      resetQuotaBlock();
      if (searchTerm) fetchNews(searchTerm, searchTerm, true);
      else {
        const cat = categories.find(c => c.id === activeCategoryId);
        if (cat) fetchNews(cat.value, cat.label, true);
      }
    },
    onImageGenerated: (url: string, img: string) => {
      setArticles(prev => prev.map(a => a.url === url ? { ...a, imageUrl: img } : a));
    },
    handleToggleFavorite: async (article: Article) => {
      if (!currentUser) return setShowLoginModal(true);
      let id = article.id;
      if (!id) {
        const saved = await db.saveArticles(article.category, [article]);
        id = saved[0]?.id;
      }
      if (!id) return;
      const isFav = favoriteArticleIds.has(id);
      if (isFav) {
        setFavoriteArticleIds(prev => { const n = new Set(prev); n.delete(id!); return n; });
        await db.removeFavorite(id, currentUser.id);
      } else {
        setFavoriteArticleIds(prev => new Set(prev).add(id!));
        await db.addFavorite(id, currentUser.id);
      }
    },
    handleArticleUpdate: (updated: Article) => {
      setArticles(prev => prev.map(a => (a.id === updated.id || a.url === updated.url) ? updated : a));
      setSelectedArticle(prev => (prev && (prev.id === updated.id || prev.url === updated.url)) ? updated : prev);
    }
  };
};
