
import React, { useState, useEffect } from 'react';
import { db } from '../services/dbService';
import { generateGoodDeed } from '../services/geminiService';
import { Deed } from '../types';
import { Tooltip } from './Tooltip';

export const DailyDeed: React.FC = () => {
  const [deed, setDeed] = useState<Deed | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    loadDeed();
  }, []);

  const loadDeed = async () => {
    console.log("[DAILY-DEED] 🚀 Inizio caricamento sfida del giorno...");
    setLoading(true);
    try {
        const existingDeed = await db.getRandomDeed();
        if (existingDeed) {
            console.log("[DAILY-DEED] 📦 Sfida recuperata dal database:", existingDeed.text);
            setDeed(existingDeed);
        } else {
            console.log("[DAILY-DEED] 🤖 Database vuoto, richiesta sfida a Gemini...");
            const text = await generateGoodDeed();
            if (text) {
                console.log("[DAILY-DEED] ✨ Gemini ha suggerito:", text);
                db.saveDeed(text).catch(e => console.warn("[DAILY-DEED] ⚠️ Salvataggio deed fallito (non critico):", e));
                setDeed({ id: 'temp-ai', text });
            } else {
                console.warn("[DAILY-DEED] ⚠️ Gemini non ha risposto, uso fallback locale.");
                setDeed({ id: 'fallback', text: 'Fai un sorriso a chi incontri oggi.' });
            }
        }
    } catch (e) {
        console.error("[DAILY-DEED] ❌ Errore durante il caricamento della sfida:", e);
        setDeed({ id: 'fallback-err', text: 'Regala un complimento sincero a qualcuno.' });
    } finally {
        setLoading(false);
    }
  };

  const handleAccept = () => {
      setAccepted(true);
  };

  // Se non c'è ancora un deed ma stiamo caricando, mostriamo uno skeleton semplice
  if (!deed && loading) {
      return (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-2">
              <div className="bg-white/50 animate-pulse h-16 rounded-xl border border-slate-100"></div>
          </div>
      );
  }
  
  if (!deed) return null; 

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-2">
       <div className={`
            relative rounded-xl transition-all duration-500 ease-out transform border
            ${accepted 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-sm border-transparent' 
                : 'bg-white shadow-sm border-indigo-50 hover:shadow-md'
            }
       `}>
           
           <div className="flex flex-col md:flex-row items-center justify-between py-3 px-5 gap-4">
               
               {/* Icona e Label */}
               <div className="flex items-center gap-3 md:border-r md:border-slate-100 md:pr-4 min-w-max">
                   <div className={`
                       w-9 h-9 rounded-full flex items-center justify-center text-sm shadow-sm transition-transform duration-500
                       ${accepted ? 'bg-white text-emerald-600 rotate-12 scale-110' : 'bg-indigo-50 text-indigo-500'}
                   `}>
                       {accepted ? '🏆' : '🌱'}
                   </div>
                   <div className="flex flex-col">
                       <h3 className={`font-sans text-[10px] font-bold uppercase tracking-widest ${accepted ? 'text-emerald-100' : 'text-slate-400'}`}>
                           Sfida del Giorno
                       </h3>
                   </div>
               </div>

               {/* Testo Centrale */}
               <div className="flex-1 text-center md:text-left">
                   <p className={`
                       font-display text-base font-medium leading-snug
                       ${accepted ? 'text-white' : 'text-slate-800'}
                   `}>
                       {deed?.text}
                   </p>
               </div>

               {/* Bottone Azione */}
               <div className="min-w-max pt-1 md:pt-0">
                   {accepted ? (
                       <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full text-white animate-in zoom-in border border-white/20">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                               <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                           </svg>
                           <span className="font-bold text-xs tracking-wide">Accettata!</span>
                       </div>
                   ) : (
                       <Tooltip content="Impegnati a compiere questo piccolo gesto gentile oggi" position="top">
                            <button 
                                onClick={handleAccept}
                                className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-full transition shadow-sm hover:shadow hover:-translate-y-0.5"
                            >
                                Accetto
                            </button>
                       </Tooltip>
                   )}
               </div>
           </div>
       </div>
    </div>
  );
};
