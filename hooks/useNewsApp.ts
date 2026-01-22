
import { useState, useEffect, useRef, useCallback } from 'react';
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

  // 1. GESTIONE AUTENTICAZIONE
  useEffect(() => {
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string, session: any) => {
      console.log(`[AUTH-EVENT] 🔑 Stato Auth: ${event}`);
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

  // 2. CARICAMENTO CATEGORIE
  useEffect(() => {
    const loadCategories = async () => {
      console.log("[HOOK-FLOW] 🛠️ Inizio caricamento categorie...");
      try {
        let dbCats = await db.getCategories(currentUser?.id);
        if (!dbCats || dbCats.length === 0) {
          setCategories(DEFAULT_CATEGORIES);
          db.seedCategories();
        } else {
          setCategories(dbCats);
        }
      } catch (err) {
        console.error("[HOOK-FLOW] ❌ Errore critico categorie:", err);
        setCategories(DEFAULT_CATEGORIES);
      }
    };
    loadCategories();
  }, [currentUser?.id]);

  // 3. IMPOSTAZIONE CATEGORIA INIZIALE E RE-INIZIALIZZAZIONE
  useEffect(() => {
    // Se non abbiamo una categoria attiva e abbiamo le categorie, o se la categoria attiva non è più valida
    if (categories.length > 0) {
      const isValid = categories.some(c => c.id === activeCategoryId);
      if (!activeCategoryId || (!isValid && !showFavoritesOnly)) {
        console.log(`[HOOK-FLOW] 🏁 Imposto/Ripristino categoria: ${categories[0].label}`);
        setActiveCategoryId(categories[0].id);
      }
    }
  }, [categories, activeCategoryId, showFavoritesOnly]);

  // 4. FUNZIONE CORE CARICAMENTO NOTIZIE
  const fetchNewsForCategory = useCallback(async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    console.log(`[HOOK-FLOW] 📡 FETCH NEWS -> Categoria: "${catLabel}"`);
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
      if (aiArticles && aiArticles.length > 0) {
        setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
        db.saveArticles(catLabel, aiArticles).then(saved => {
          if (saved && saved.length > 0) {
              setArticles(current => {
                const idMap = new Map(saved.map(s => [s.url, s.id]));
                return current.map(a => ({ ...a, id: idMap.get(a.url) || a.id }));
              });
          }
        });
      } else {
        setNotification(forceAi ? "Nessuna nuova notizia trovata." : "Archivio vuoto.");
      }
    } catch (error) {
      console.error("[HOOK-FLOW] ❌ Errore recupero notizie:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 5. EFFETTO REATTIVO CARICAMENTO NOTIZIE (Logica di transizione migliorata)
  useEffect(() => {
    if (showFavoritesOnly) {
      if (currentUser) {
        console.log("[HOOK-FLOW] ❤️ Caricamento preferiti...");
        setLoading(true);
        db.getUserFavoriteArticles(currentUser.id).then(favs => {
          setArticles(favs);
          setFavoriteArticleIds(new Set(favs.map(a => a.id).filter(Boolean) as string[]));
          setLoading(false);
        }).catch(() => setLoading(false));
      } else {
        setArticles([]);
        setLoading(false);
      }
    } else {
      // Vista normale: carichiamo solo se abbiamo una categoria attiva
      if (activeCategoryId && categories.length > 0) {
        const cat = categories.find(c => c.id === activeCategoryId);
        if (cat) {
          fetchNewsForCategory(cat.id, cat.label, cat.value, false);
        } else {
          // Stato transitorio: stiamo ancora allineando activeCategoryId tramite l'effetto 3
          setLoading(true);
        }
      } else if (categories.length === 0) {
        setLoading(true);
      } else {
        // Abbiamo le categorie ma non ancora l'ID attivo (attesa effetto 3)
        setLoading(true);
      }
    }
  }, [showFavoritesOnly, currentUser, activeCategoryId, categories, fetchNewsForCategory]);

  return {
    categories,
    activeCategoryId,
    articles,
    activeCategoryLabel: categories.find(c => c.id === activeCategoryId)?.label,
    loading,
    selectedArticle,
    showLoginModal,
    showFavoritesOnly,
    currentUser,
    favoriteArticleIds,
    notification,
    setActiveCategoryId,
    setSelectedArticle,
    setShowLoginModal,
    setShowFavoritesOnly,
    handleLogout: () => {
      setCurrentUser(null);
      setFavoriteArticleIds(new Set());
      db.signOut();
    },
    handleAddCategory: async (label: string) => {
      if (!currentUser) return setShowLoginModal(true);
      const cat = await db.addCategory(label, `${label} notizie positive`, currentUser.id);
      if (cat) {
        setCategories(prev => [...prev, cat]);
        setActiveCategoryId(cat.id);
      }
    },
    loadNews: () => {
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) fetchNewsForCategory(cat.id, cat.label, cat.value, true);
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
        if (showFavoritesOnly) {
          setArticles(prev => prev.filter(a => a.id !== id));
        }
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
