
import React, { useState } from 'react';
import { Header } from './components/Header';
import { CategoryBar } from './components/CategoryBar';
import { DailyDeed } from './components/DailyDeed';
import { ArticleList } from './components/ArticleList';
import { Footer } from './components/Footer';
import { ArticleDetail } from './components/ArticleDetail';
import { LoginModal } from './components/LoginModal';
import { ShareModal } from './components/ShareModal';
import { useNewsApp } from './hooks/useNewsApp';
import { Article } from './types';

const App: React.FC = () => {
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

  const [shareArticle, setShareArticle] = useState<Article | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Header 
        currentUser={currentUser}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
        onLogout={handleLogout}
        onLoginClick={() => setShowLoginModal(true)}
      />
      
      <CategoryBar 
        categories={categories}
        activeCategory={activeCategoryId}
        currentUser={currentUser}
        onSelectCategory={setActiveCategoryId}
        onAddCategory={handleAddCategory}
        onSearch={handleSearch}
      />

      {currentUser && !showFavoritesOnly && (
        <DailyDeed userId={currentUser.id} />
      )}

      <ArticleList 
        articles={articles}
        loading={loading}
        activeCategoryLabel={activeCategoryLabel}
        showFavoritesOnly={showFavoritesOnly}
        favoriteIds={favoriteArticleIds}
        currentUser={currentUser}
        notification={notification}
        onArticleClick={setSelectedArticle}
        onRefresh={loadNews}
        onImageGenerated={onImageGenerated}
        onToggleFavorite={handleToggleFavorite}
        onCloseFavorites={() => setShowFavoritesOnly(false)}
        onLoginRequest={() => setShowLoginModal(true)}
        onShareClick={(art) => setShareArticle(art)}
      />

      <Footer />

      {/* Modali */}
      {selectedArticle && (
        <ArticleDetail 
          article={selectedArticle}
          currentUser={currentUser}
          isFavorite={selectedArticle.id ? favoriteArticleIds.has(selectedArticle.id) : false}
          onClose={() => setSelectedArticle(null)}
          onLoginRequest={() => setShowLoginModal(true)}
          onToggleFavorite={handleToggleFavorite}
          onUpdate={handleArticleUpdate}
          onShareClick={() => setShareArticle(selectedArticle)}
        />
      )}

      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

      {shareArticle && (
        <ShareModal 
          article={shareArticle} 
          onClose={() => setShareArticle(null)} 
        />
      )}
    </div>
  );
};

export default App;
