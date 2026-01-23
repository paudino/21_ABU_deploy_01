
import React from 'react';
import { Header } from './components/Header';
import { CategoryBar } from './components/CategoryBar';
import { ArticleList } from './components/ArticleList';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { DailyDeed } from './components/DailyDeed';
import { ArticleDetail } from './components/ArticleDetail';
import { useNewsApp } from './hooks/useNewsApp';

function App() {
  const {
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
          onArticleClick={setSelectedArticle}
          onRefresh={loadNews}
          onImageGenerated={onImageGenerated}
          onToggleFavorite={handleToggleFavorite}
          notification={notification}
          onCloseFavorites={() => setShowFavoritesOnly(false)}
        />
      </div>

      <Footer />

      {/* Modali */}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      
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
