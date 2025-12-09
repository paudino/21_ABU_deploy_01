
import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

/**
 * Componente Tooltip Moderno.
 * Appare all'hover con un effetto di dissolvenza e zoom.
 * Stile: Scuro, arrotondato, con freccia indicatrice.
 */
export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div 
            className={`
                absolute z-[60] px-3 py-1.5 
                bg-slate-800/95 text-white text-[11px] font-bold tracking-wide
                rounded-lg shadow-xl backdrop-blur-sm whitespace-nowrap
                animate-in fade-in zoom-in-95 duration-200
                pointer-events-none
                ${position === 'top' ? 'bottom-full mb-2.5' : 'top-full mt-2.5'}
            `}
        >
            {content}
            
            {/* Freccia indicatrice */}
            <div 
                className={`
                    absolute left-1/2 -translate-x-1/2 border-4 border-transparent
                    ${position === 'top' 
                        ? 'top-full border-t-slate-800/95' 
                        : 'bottom-full border-b-slate-800/95'
                    }
                `}
            />
        </div>
      )}
    </div>
  );
};
