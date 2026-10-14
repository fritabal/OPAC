import React, {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  TOOLTIP_BG_CLASS,
  TOOLTIP_TEXT_CLASS,
  TOOLTIP_ERROR_BG_CLASS,
  TOOLTIP_ERROR_TEXT_CLASS,
} from '../constants/ui';

export type TooltipPlacement = 'auto' | 'top' | 'bottom' | 'right' | 'left';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  placement?: TooltipPlacement;
  disabled?: boolean;
  maxWidthClass?: string;
  variant?: 'default' | 'error';
}

interface Coords {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
  arrowOffset: number;
}

/**
 * Composant Tooltip universel avec portail direct sur document.body :
 * - Apparaît TOUJOURS par dessus tout le reste (aucun problème de z-index ou overflow d'élément parent)
 * - Détecte si le pictogramme est en bas de la fenêtre et positionne la bulle AU-DESSUS du pictogramme
 * - Ne déborde jamais de la fenêtre (clamping automatique en largeur et hauteur)
 * - Supporte le variant standard (fond gris moyen) et le variant error (texte blanc et gras sur fond rouge)
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = 'inline-flex items-center',
  placement = 'auto',
  disabled = false,
  maxWidthClass = 'max-w-xs',
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Si le trigger est complètement hors de la fenêtre (ex: scrollé hors de l'écran), cacher la bulle
    if (
      triggerRect.bottom < -50 ||
      triggerRect.top > vh + 50 ||
      triggerRect.right < -50 ||
      triggerRect.left > vw + 50
    ) {
      setCoords(null);
      return;
    }

    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 280;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 80;

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;

    const gap = 8;
    const margin = 10;

    // Détection critique : le pictogramme est-il vers le bas de la fenêtre ?
    // Si l'espace disponible sous le pictogramme est insuffisant pour la bulle + marge,
    // ou si le pictogramme est dans la zone inférieure de l'écran :
    const isNearBottom =
      vh - triggerRect.bottom < tooltipHeight + 35 ||
      triggerRect.bottom > vh - 150;

    // Détection : le pictogramme est-il très près du haut de la fenêtre ?
    const isNearTop = triggerRect.top < tooltipHeight + 25 || triggerRect.top < 90;

    let arrowPos: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let top = 0;
    let left = 0;

    // Logique de placement adaptée
    if (isNearBottom) {
      // Forcer au dessus du pictogramme pour ne jamais être masqué par la fenêtre
      arrowPos = 'bottom';
      top = triggerRect.top - tooltipHeight - gap;
      left = triggerCenterX - tooltipWidth / 2;
    } else if (isNearTop) {
      // Si trop près du haut, forcer en dessous
      arrowPos = 'top';
      top = triggerRect.bottom + gap;
      left = triggerCenterX - tooltipWidth / 2;
    } else if (placement === 'right') {
      // Placement à droite si espace suffisant à droite
      if (vw - triggerRect.right >= tooltipWidth + margin + gap) {
        arrowPos = 'left';
        left = triggerRect.right + gap;
        top = triggerCenterY - tooltipHeight / 2;
      } else {
        // Pas assez de place à droite, basculer au-dessus
        arrowPos = 'bottom';
        top = triggerRect.top - tooltipHeight - gap;
        left = triggerCenterX - tooltipWidth / 2;
      }
    } else if (placement === 'left') {
      if (triggerRect.left >= tooltipWidth + margin + gap) {
        arrowPos = 'right';
        left = triggerRect.left - tooltipWidth - gap;
        top = triggerCenterY - tooltipHeight / 2;
      } else {
        arrowPos = 'bottom';
        top = triggerRect.top - tooltipHeight - gap;
        left = triggerCenterX - tooltipWidth / 2;
      }
    } else if (placement === 'bottom') {
      arrowPos = 'top';
      top = triggerRect.bottom + gap;
      left = triggerCenterX - tooltipWidth / 2;
    } else {
      // placement === 'top' ou 'auto'
      arrowPos = 'bottom';
      top = triggerRect.top - tooltipHeight - gap;
      left = triggerCenterX - tooltipWidth / 2;
    }

    // Clamping strict : ne jamais déborder de la fenêtre
    const clampedLeft = Math.max(margin, Math.min(left, vw - tooltipWidth - margin));
    const clampedTop = Math.max(margin, Math.min(top, vh - tooltipHeight - margin));

    // Calcul de l'offset de la flèche pour qu'elle pointe exactement vers le pictogramme
    let arrowOffset = 0;
    if (arrowPos === 'top' || arrowPos === 'bottom') {
      // Offset horizontal
      arrowOffset = Math.max(
        12,
        Math.min(triggerCenterX - clampedLeft, tooltipWidth - 12)
      );
    } else {
      // Offset vertical
      arrowOffset = Math.max(
        12,
        Math.min(triggerCenterY - clampedTop, tooltipHeight - 12)
      );
    }

    setCoords({
      top: clampedTop,
      left: clampedLeft,
      arrowPosition: arrowPos,
      arrowOffset,
    });
  }, [placement]);

  // Recalcul sur ouverture ou redimensionnement
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition, content]);

  // Écoute des scrolls et resizes pour suivre le pictogramme même pendant un défilement
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  if (disabled || !content) {
    return <div className={className}>{children}</div>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      >
        {children}
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              opacity: coords ? 1 : 0,
              zIndex: 99999,
              pointerEvents: 'none',
            }}
            className={`transition-opacity duration-150 ${maxWidthClass}`}
          >
            {/* Conteneur de la bulle avec style adapté (standard gris ou erreur blanc/gras sur fond rouge) */}
            {(() => {
              const isError = variant === 'error';
              const bgClass = isError ? TOOLTIP_ERROR_BG_CLASS : TOOLTIP_BG_CLASS;
              const textClass = isError ? TOOLTIP_ERROR_TEXT_CLASS : `${TOOLTIP_TEXT_CLASS} text-white`;
              const borderClass = isError ? 'border-red-700/80 shadow-red-950/20' : 'border-slate-500/60';

              return (
                <div
                  className={`${bgClass} ${textClass} p-2.5 rounded-lg shadow-xl border ${borderClass} leading-relaxed whitespace-normal break-words text-left relative`}
                >
                  {content}

                  {/* Flèche orientée vers le pictogramme avec la même couleur de fond */}
                  {coords && (
                    <div
                      style={
                        coords.arrowPosition === 'bottom'
                          ? {
                              left: `${coords.arrowOffset}px`,
                              bottom: '-4px',
                              transform: 'translateX(-50%) rotate(45deg)',
                            }
                          : coords.arrowPosition === 'top'
                          ? {
                              left: `${coords.arrowOffset}px`,
                              top: '-4px',
                              transform: 'translateX(-50%) rotate(45deg)',
                            }
                          : coords.arrowPosition === 'left'
                          ? {
                              top: `${coords.arrowOffset}px`,
                              left: '-4px',
                              transform: 'translateY(-50%) rotate(45deg)',
                            }
                          : {
                              top: `${coords.arrowOffset}px`,
                              right: '-4px',
                              transform: 'translateY(-50%) rotate(45deg)',
                            }
                      }
                      className={`w-2.5 h-2.5 ${bgClass} absolute`}
                    />
                  )}
                </div>
              );
            })()}
          </div>,
          document.body
        )}
    </>
  );
};
