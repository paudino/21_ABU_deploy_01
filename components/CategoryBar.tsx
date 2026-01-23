
import React, { useState, useRef, useEffect } from 'react';
import { Category, User } from '../types';
import { IconPlus, IconSearch, IconX } from './Icons';
import { Tooltip } from './Tooltip';

interface CategoryBarProps {
  categories: Category[];
  activeCategory: string;
  currentUser: User | null;
  onSelectCategory: (id: string) => void;
  onAddCategory: (label: string) => void;
  onSearch?: (term: string) => void;
}

/**
 * Barra scorrevole orizzontale per le categorie con ricerca integrata.
 */
export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  activeCategory,
  currentUser,
  onSelectCategory,
  onAddCategory,
  onSearch
}) => {
  const [showAddCat, setShowAddCat] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleAddSubmit = () => {
    if (newCatLabel.trim()) {
      onAddCategory(newCatLabel.trim());
      setNewCatLabel('');
      setShowAddCat(false);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftShadow(scrollLeft > 10);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [categories]);

  return (
    <div className="sticky top-[108px] md:top-20 z-20 backdrop-blur-md bg-white/70 border-b border-white/50 py-3 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
         
         {/* Etichetta fissa (Desktop) */}
         <span className="text-xs font-bold text-joy-800 uppercase tracking-widest mr-2 hidden md:block opacity-70 flex-shrink-0">
            Filtra:
         </span>

         {/* Container Principale Scorrevole */}
         <div className="flex-1 relative overflow-hidden flex items-center">
             <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showLeftShadow ? 'opacity-100' : 'opacity-0'}`}></div>

             <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-x-auto custom-scrollbar flex items-center gap-2 pb-2 md:pb-0 scroll-smooth"
             >
                 {categories.map(cat => (
                   <button
                     key={cat.id}
                     onClick={() => {
                        onSelectCategory(cat.id);
                        setShowSearch(false);
                     }}
                     className={`whitespace-nowrap px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 transform flex-shrink-0 ${
                       activeCategory === cat.id
                         ? 'bg-gradient-to-r from-joy-500 to-orange-600 text-white shadow-md scale-105'
                         : 'bg-orange-50 text-orange-800 border border-orange-100 hover:bg-orange-100'
                     }`}
                   >
                     {cat.label}
                   </button>
                 ))}
                 <div className="w-6 flex-shrink-0 md:hidden"></div>
             </div>

             <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showRightShadow ? 'opacity-100' : 'opacity-0'}`}></div>
         </div>

         {/* Gruppo Pulsanti Azione */}
         <div className="flex items-center gap-2 border-l border-slate-300 pl-3 flex-shrink-0">
              
              {/* Bottone CERCA */}
              <div className="relative">
                <Tooltip content="Cerca notizie libere">
                    <button 
                        onClick={() => { setShowSearch(!showSearch); setShowAddCat(false); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showSearch ? 'bg-joy-500 text-white' : 'bg-white/80 border border-slate-300 text-slate-400 hover:text-joy-500'}`}
                    >
                        <IconSearch className="w-4 h-4" />
                    </button>
                </Tooltip>

                {showSearch && (
                    <div className="absolute top-10 right-0 bg-white shadow-xl rounded-xl p-3 z-30 border border-orange-100 w-64 animate-in fade-in slide-in-from-top-2">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-joy-400 outline-none"
                                placeholder="Cerca: 'clima', 'pace'..."
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                            />
                            <button onClick={handleSearchSubmit} className="bg-joy-500 text-white text-xs px-3 rounded-lg font-bold">
                                Vai
                            </button>
                        </div>
                    </div>
                )}
              </div>

              {/* Bottone AGGIUNGI (solo loggati) */}
              {currentUser && (
                <div className="relative">
                    <Tooltip content="Crea nuova categoria">
                        <button 
                            onClick={() => { setShowAddCat(!showAddCat); setShowSearch(false); }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showAddCat ? 'bg-rose-500 text-white' : 'bg-white/80 border border-slate-300 text-slate-400 hover:text-rose-500'}`}
                        >
                            <IconPlus className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    {showAddCat && (
                        <div className="absolute top-10 right-0 bg-white shadow-xl rounded-xl p-3 z-30 border border-rose-100 w-64 animate-in fade-in slide-in-from-top-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Nuova Categoria AI</p>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    autoFocus
                                    value={newCatLabel}
                                    onChange={(e) => setNewCatLabel(e.target.value)}
                                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-rose-400 outline-none"
                                    placeholder="Es: Cinema, Sport..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubmit()}
                                />
                                <button onClick={handleAddSubmit} className="bg-rose-500 text-white text-xs px-3 rounded-lg font-bold">
                                    +
                                </button>
                            </div>
                        </div>
                    )}
                </div>
              )}
         </div>
      </div>
    </div>
  );
};
