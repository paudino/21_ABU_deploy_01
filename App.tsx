
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CategoryBar } from './components/CategoryBar';
import { ArticleList } from './components/ArticleList';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { DailyDeed } from './components/DailyDeed';
import { ArticleDetail } from './components/ArticleDetail';
import { useNewsApp } from './hooks/useNewsApp';
import { ensureApiKey } from './services/gemini/client';

function App() {
  const {
    categories,
    activeCategoryId,
    articles,
    activeCategoryLabel,
    isAppLoading,
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
    handleLogin,
    handleLogout,
    handleAddCategory,
    loadNews,
    onImageGenerated,
    handleToggleFavorite,
    handleArticleUpdate
  } = useNewsApp();

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    // Controllo preventivo della chiave API per evitare errori a catena
    const checkKey = async () => {
        const ok = await ensureApiKey();
        setHasApiKey(ok);
    };
    checkKey();
  }, []);

  // Se l'app sta inizializzando l'auth, mostriamo un caricamento a schermo intero
  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-joy-50 flex flex-col items-center justify-center">
         <div className="w-16 h-16 border-4 border-joy-200 border-t-joy-500 rounded-full animate-spin mb-4"></div>
         <p className="text-joy-700 font-display font-bold">L'angolo del Buon Umore si sta preparando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative font-sans text-slate-900 flex flex-col">
      
      {/* Sfondo Immagine Fisso */}
      <div className="fixed inset-0 z-[-1]">
        <img 
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop" 
          alt="Sunset Background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-orange-100/40 via-white/20 to-orange-50/60 backdrop-blur-[0px]"></div>
      </div>

      {/* Header */}
      <Header 
        currentUser={currentUser}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
        onLoginClick={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      {/* Barra Categorie */}
      <CategoryBar 
        categories={categories}
        activeCategory={showFavoritesOnly ? '' : activeCategoryId}
        currentUser={currentUser}
        onSelectCategory={setActiveCategoryId}
        onAddCategory={handleAddCategory}
      />

      {/* Avviso Chiave API mancante (Solo se rilevata come assente) */}
      {hasApiKey === false && (
          <div className="max-w-4xl mx-auto px-4 mt-4">
              <div className="bg-amber-100 border border-amber-300 p-3 rounded-xl flex items-center justify-between text-amber-900 text-sm font-medium animate-pulse">
                  <div className="flex items-center gap-2">
                      <span className="text-xl">⚠️</span>
                      <span>Configurazione AI incompleta. Clicca sul Sole nell'header per attivare le citazioni e l'audio.</span>
                  </div>
                  <button 
                    onClick={() => (window as any).aistudio?.openSelectKey()} 
                    className="bg-amber-600 text-white px-4 py-1.5 rounded-lg hover:bg-amber-700 transition"
                  >
                    Configura
                  </button>
              </div>
          </div>
      )}

      {/* Sfida del Giorno */}
      {!showFavoritesOnly && currentUser && (
         <DailyDeed />
      )}

      {/* Contenuto Principale */}
      <div className="flex-1 relative z-10">
        <ArticleList 
          articles={articles}
          loading={loading}
          activeCategoryLabel={activeCategoryLabel}
          showFavoritesOnly={showFavoritesOnly}
          favoriteIds={favoriteArticleIds}
          currentUser={currentUser}
          onArticleClick={setSelectedArticle}
          onRefresh={loadNews}
          onImageGenerated={onImageGenerated}
          onToggleFavorite={handleToggleFavorite}
          notification={notification}
          onCloseFavorites={() => setShowFavoritesOnly(false)}
        />
      </div>

      <Footer />

      {/* Modale Login */}
      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
        />
      )}

      {/* Modale Dettaglio Articolo */}
      {selectedArticle && (
        <ArticleDetail 
          article={selectedArticle} 
          currentUser={currentUser} 
          isFavorite={selectedArticle.id ? favoriteArticleIds.has(selectedArticle.id) : false}
          onClose={() => setSelectedArticle(null)}
          onLoginRequest={() => setShowLoginModal(true)}
          onToggleFavorite={handleToggleFavorite}
          onUpdate={handleArticleUpdate}
        />
      )}

    </div>
  );
}

export default App;
