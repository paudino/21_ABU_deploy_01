
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

  const initialLoadDone = useRef(false);

  const loadFavorites = useCallback(async (userId: string) => {
    console.log("[HOOK-FLOW] ❤️ Caricamento preferiti per utente:", userId);
    setLoading(true);
    try {
      const favArticles = await db.getUserFavoriteArticles(userId);
      setArticles(favArticles);
      setFavoriteArticleIds(new Set(favArticles.map(a => a.id).filter(Boolean) as string[]));
    } catch (e) {
      console.error("[HOOK-FLOW] ❌ Errore preferiti:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNewsForCategory = useCallback(async (catId: string, catLabel: string, catValue: string, forceAi: boolean) => {
    console.log(`[HOOK-FLOW] 📡 FETCH NEWS -> Categoria: "${catLabel}", Forza AI: ${forceAi}`);
    setLoading(true);
    setNotification(null);
    try {
      if (!forceAi) {
        console.log(`[HOOK-FLOW] 🔎 Cerco notizie in cache per "${catLabel}"...`);
        const cached = await db.getCachedArticles(catLabel);
        if (cached && cached.length > 0) {
          console.log(`[HOOK-FLOW] ✅ Cache trovata: ${cached.length} articoli.`);
          setArticles(cached); 
          setLoading(false); 
          return; 
        }
        console.log(`[HOOK-FLOW] 💨 Cache vuota per "${catLabel}". Richiedo a Gemini.`);
      }

      const aiArticles = await fetchPositiveNews(catValue, catLabel);
      if (aiArticles.length > 0) {
        setArticles(aiArticles.map(a => ({ ...a, isNew: true })));
        db.saveArticles(catLabel, aiArticles).then(saved => {
          setArticles(current => {
            const idMap = new Map(saved.map(s => [s.url, s.id]));
            return current.map(a => ({ ...a, id: idMap.get(a.url) || a.id }));
          });
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

  // Sync Auth State
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

  // Startup & View Logic
  useEffect(() => {
    const init = async () => {
      if (initialLoadDone.current) return;
      initialLoadDone.current = true;
      
      console.log("[HOOK-FLOW] 🛠️ STEP 1: Avvio inizializzazione app...");
      
      try {
        console.log("[HOOK-FLOW] 🛠️ STEP 2: Richiesta categorie al database...");
        let dbCats = await db.getCategories(currentUser?.id);
        
        if (!dbCats || dbCats.length === 0) {
          console.log("[HOOK-FLOW] 🛠️ STEP 2b: Categorie non trovate, provo seeding...");
          await db.seedCategories();
          dbCats = await db.getCategories(currentUser?.id);
        }

        const finalCats = (dbCats && dbCats.length > 0) ? dbCats : DEFAULT_CATEGORIES;
        console.log(`[HOOK-FLOW] 🛠️ STEP 3: Categorie finali caricate (${finalCats.length}).`);
        setCategories(finalCats);
        
        const startCat = finalCats[0];
        if (startCat) {
          console.log(`[HOOK-FLOW] 🏁 STEP 4: Imposto categoria iniziale: "${startCat.label}"`);
          setActiveCategoryId(startCat.id);
          // Avviamo il caricamento notizie
          fetchNewsForCategory(startCat.id, startCat.label, startCat.value, false);
        } else {
          console.error("[HOOK-FLOW] ❌ ERRORE: Nessuna categoria disponibile dopo init!");
          setLoading(false);
        }
      } catch (err) {
        console.error("[HOOK-FLOW] ❌ Eccezione durante l'inizializzazione:", err);
        setLoading(false);
      }
    };
    init();
  }, [currentUser, fetchNewsForCategory]);

  useEffect(() => {
    if (showFavoritesOnly && currentUser) {
      loadFavorites(currentUser.id);
    } else if (!showFavoritesOnly && activeCategoryId) {
      const cat = categories.find(c => c.id === activeCategoryId);
      if (cat) fetchNewsForCategory(cat.id, cat.label, cat.value, false);
    }
  }, [showFavoritesOnly, currentUser, activeCategoryId, categories, loadFavorites, fetchNewsForCategory]);

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
        await db.removeFavorite(id, currentUser.id);
      } else {
        setFavoriteArticleIds(prev => new Set(prev).add(id!));
        await db.addFavorite(id, currentUser.id);
      }
    },
    handleArticleUpdate: (updated: Article) => {
      setArticles(prev => prev.map(a => (a.id === updated.id || a.url === updated.url) ? updated : a));
    }
  };
};
