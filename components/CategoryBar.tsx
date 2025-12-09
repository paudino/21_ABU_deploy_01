
import React, { useState } from 'react';
import { Category, User } from '../types';
import { IconPlus } from './Icons';
import { Tooltip } from './Tooltip';

interface CategoryBarProps {
  categories: Category[];
  activeCategory: string;
  currentUser: User | null;
  onSelectCategory: (id: string) => void;
  onAddCategory: (label: string) => void;
}

/**
 * Barra scorrevole orizzontale per le categorie.
 * Stile Glassmorphism fluttuante.
 */
export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  activeCategory,
  currentUser,
  onSelectCategory,
  onAddCategory
}) => {
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');

  const handleAddSubmit = () => {
    if (newCatLabel.trim()) {
      onAddCategory(newCatLabel.trim());
      setNewCatLabel('');
      setShowAddCat(false);
    }
  };

  return (
    <div className="sticky top-20 z-20 backdrop-blur-md bg-white/70 border-b border-white/50 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
         {/* Etichetta fissa con margine aumentato per evitare collisioni */}
         <span className="text-xs font-bold text-joy-800 uppercase tracking-widest mr-10 hidden md:block opacity-70 flex-shrink-0">
            Argomenti:
         </span>

         {/* Lista Categorie (Scorrevole) con padding iniziale per compensare lo zoom del pulsante attivo */}
         <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-3 pb-1 pl-2">
             {categories.map(cat => (
               <button
                 key={cat.id}
                 onClick={() => onSelectCategory(cat.id)}
                 className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 transform ${
                   activeCategory === cat.id
                     ? 'bg-gradient-to-r from-joy-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-105 ring-2 ring-orange-200 border-transparent'
                     : 'bg-orange-50 text-orange-800 border border-orange-100 hover:bg-orange-100 hover:scale-105 hover:shadow-sm'
                 }`}
               >
                 {cat.label}
               </button>
             ))}
         </div>

         {/* Bottone Aggiungi (+) Fisso sulla destra */}
         {currentUser && (
           <div className="relative ml-2 border-l border-slate-300 pl-4 flex-shrink-0">
              <Tooltip content="Aggiungi una nuova categoria">
                  <button 
                    onClick={() => setShowAddCat(!showAddCat)}
                    className="w-9 h-9 rounded-full bg-white/80 border border-slate-300 border-dashed flex items-center justify-center text-slate-400 hover:border-joy-500 hover:text-joy-500 hover:bg-joy-50 transition shadow-sm"
                  >
                    <IconPlus />
                  </button>
              </Tooltip>

              {/* Popup Aggiungi */}
              {showAddCat && (
                <div className="absolute top-12 right-0 bg-white shadow-xl rounded-xl p-4 z-20 border border-orange-100 w-72 animate-in fade-in slide-in-from-top-2 ring-1 ring-black/5">
                  <p className="text-xs font-bold text-joy-600 mb-2 uppercase tracking-wide">Cosa ti rende felice?</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-joy-400 focus:border-joy-400 outline-none bg-slate-50"
                      placeholder="Es. Viaggi, Animali..."
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubmit()}
                    />
                    <button 
                      onClick={handleAddSubmit} 
                      className="bg-joy-500 text-white text-sm px-4 rounded-lg font-bold hover:bg-joy-600 transition shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
           </div>
         )}
      </div>
    </div>
  );
};
