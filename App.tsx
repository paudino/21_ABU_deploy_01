
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CategoryBar } from './components/CategoryBar';
import { ArticleList } from './components/ArticleList';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { DailyDeed } from './components/DailyDeed';
import { ArticleDetail } from './components/ArticleDetail';
import { ShareModal } from './components/ShareModal';
import { useNewsApp } from './hooks/useNewsApp';
import { Article, Theme } from './types';

function App() {
  const {
    categories,
    activeCategoryId,
    articles,
    nextArticle, // Acquisizione articolo successivo
    activeCategoryLabel,
    loading,
    selectedArticle,
    showLoginModal,
    showFavoritesOnly,
    currentUser,
    favoriteArticleIds,
    notification,
    setActiveCategoryId,
    handleSearch,
    setSelectedArticle,
    setShowLoginModal,
    setShowFavoritesOnly,
    handleLogout,
    handleAddCategory,
    loadNews,
    onImageGenerated,
    handleToggleFavorite,
    handleArticleUpdate
  } = useNewsApp();

  // Stati per Temi Dinamici e Leggibilità
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('app-theme') as Theme) || 'sunshine');
  const [isReadableFont, setIsReadableFont] = useState<boolean>(() => localStorage.getItem('app-readable-font') === 'true');
  const [sharingArticle, setSharingArticle] = useState<Article | null>(null);

  // Aggiorna persistenza e classi al cambio preferenze
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    localStorage.setItem('app-readable-font', String(isReadableFont));
    
    // Applica classe al body per il font
    if (isReadableFont) {
      document.body.classList.add('font-accessible');
    } else {
      document.body.classList.remove('font-accessible');
    }
  }, [theme, isReadableFont]);

  const handleOpenShare = (article: Article) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    setSharingArticle(article);
  };

  const getBackgroundImage = () => {
    switch (theme) {
      case 'evening': return "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2070&auto=format&fit=crop";
      case 'accessible': return ""; // Nessuna immagine per alto contrasto
      default: return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop";
    }
  };

  return (
    <div className={`min-h-screen relative flex flex-col transition-colors duration-500 ${theme === 'accessible' ? 'bg-black text-white' : 'text-slate-900'}`}>
      
      {/* Sfondo Immagine Fisso */}
      <div className="fixed inset-0 z-[-1]">
        {theme !== 'accessible' && (
          <img 
            src={getBackgroundImage()} 
            alt="Theme Background" 
            className="w-full h-full object-cover transition-opacity duration-1000"
          />
        )}
        <div className={`absolute inset-0 backdrop-blur-[0px] transition-colors duration-500 ${
            theme === 'evening' ? 'bg-indigo-950/40' : 
            theme === 'accessible' ? 'bg-black' : 'bg-gradient-to-b from-orange-100/40 via-white/20 to-orange-50/60'
        }`}></div>
      </div>

      {/* Header */}
      <Header 
        currentUser={currentUser}
        showFavoritesOnly={showFavoritesOnly}
        theme={theme}
        isReadableFont={isReadableFont}
        onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
        onLoginClick={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        onSetTheme={setTheme}
        onToggleReadableFont={() => setIsReadableFont(!isReadableFont)}
      />

      {/* Barra Categorie con Ricerca */}
      <CategoryBar 
        categories={categories}
        activeCategory={showFavoritesOnly ? '' : activeCategoryId}
        currentUser={currentUser}
        onSelectCategory={setActiveCategoryId}
        onAddCategory={handleAddCategory}
        onSearch={handleSearch}
      />

      {/* Sfida del Giorno */}
      {!showFavoritesOnly && currentUser && (
         <DailyDeed userId={currentUser.id} />
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
          theme={theme}
          onArticleClick={setSelectedArticle}
          onRefresh={loadNews}
          onImageGenerated={onImageGenerated}
          onToggleFavorite={handleToggleFavorite}
          notification={notification}
          onCloseFavorites={() => setShowFavoritesOnly(false)}
          onLoginRequest={() => setShowLoginModal(true)}
          onShareClick={handleOpenShare}
        />
      </div>

      <Footer />

      {/* Modali */}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      
      {selectedArticle && (
        <ArticleDetail 
          article={selectedArticle} 
          nextArticle={nextArticle} // Passaggio dell'articolo successivo
          currentUser={currentUser} 
          isFavorite={selectedArticle.id ? favoriteArticleIds.has(selectedArticle.id) : false}
          onClose={() => setSelectedArticle(null)}
          onLoginRequest={() => setShowLoginModal(true)}
          onToggleFavorite={handleToggleFavorite}
          onUpdate={handleArticleUpdate}
          onShareClick={() => handleOpenShare(selectedArticle)}
        />
      )}

      {sharingArticle && (
        <ShareModal 
          article={sharingArticle} 
          onClose={() => setSharingArticle(null)} 
        />
      )}

    </div>
  );
}

export default App;
