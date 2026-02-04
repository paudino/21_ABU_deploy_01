
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
    const currentScrollRef = scrollRef.current;
    if (currentScrollRef) {
        currentScrollRef.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('resize', handleScroll);
    return () => {
        if (currentScrollRef) currentScrollRef.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
    };
  }, [categories]);

  return (
    <div className="sticky top-[52px] md:top-[68px] z-[40] backdrop-blur-md bg-white/80 border-b border-slate-200 py-2 md:py-3 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 md:gap-3">
         
         <span className="text-[10px] font-bold text-joy-800 uppercase tracking-widest mr-1 hidden sm:block opacity-60 flex-shrink-0">
            Filtra
         </span>

         <div className="flex-1 relative flex items-center overflow-hidden">
             {/* Ombreggiature per indicare lo scroll */}
             <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showLeftShadow ? 'opacity-100' : 'opacity-0'}`}></div>

             <div 
                ref={scrollRef}
                className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-1.5 md:gap-2 py-1 scroll-smooth"
                style={{ WebkitOverflowScrolling: 'touch' }}
             >
                 {categories.map(cat => (
                   <button
                     key={cat.id}
                     onClick={() => {
                        onSelectCategory(cat.id);
                        setShowSearch(false);
                     }}
                     className={`whitespace-nowrap px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-bold transition-all flex-shrink-0 ${
                       activeCategory === cat.id
                         ? 'bg-joy-500 text-white shadow-md'
                         : 'bg-white text-slate-600 border border-slate-200 hover:border-joy-300'
                     }`}
                   >
                     {cat.label}
                   </button>
                 ))}
                 <div className="w-4 flex-shrink-0"></div> {/* Buffer spaziale finale */}
             </div>

             <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showRightShadow ? 'opacity-100' : 'opacity-0'}`}></div>
         </div>

         <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 flex-shrink-0">
              <div className="relative">
                    <button 
                        onClick={() => { setShowSearch(!showSearch); setShowAddCat(false); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showSearch ? 'bg-joy-500 text-white' : 'text-slate-400 hover:text-joy-500 bg-slate-50'}`}
                    >
                        <IconSearch className="w-4 h-4" />
                    </button>

                {showSearch && (
                    <div className="absolute top-10 right-0 bg-white shadow-xl rounded-xl p-3 z-[60] border border-slate-100 w-56 animate-in fade-in slide-in-from-top-1 origin-top-right">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-joy-400"
                                placeholder="Cerca notizia..."
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                            />
                            <button onClick={handleSearchSubmit} className="bg-joy-500 text-white text-[10px] px-2 rounded-lg font-bold">Vai</button>
                        </div>
                    </div>
                )}
              </div>

              {currentUser && (
                <div className="relative">
                    <button 
                        onClick={() => { setShowAddCat(!showAddCat); setShowSearch(false); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showAddCat ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-rose-500 bg-slate-50'}`}
                    >
                        <IconPlus className="w-4 h-4" />
                    </button>

                    {showAddCat && (
                        <div className="absolute top-10 right-0 bg-white shadow-xl rounded-xl p-3 z-[60] border border-slate-100 w-56 animate-in fade-in slide-in-from-top-1 origin-top-right">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    autoFocus
                                    value={newCatLabel}
                                    onChange={(e) => setNewCatLabel(e.target.value)}
                                    className="flex-1 text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-rose-400"
                                    placeholder="Nuova categoria AI..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubmit()}
                                />
                                <button onClick={handleAddSubmit} className="bg-rose-500 text-white text-[10px] px-2 rounded-lg font-bold">+</button>
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
