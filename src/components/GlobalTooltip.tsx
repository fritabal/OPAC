import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  TOOLTIP_BG_CLASS,
  TOOLTIP_TEXT_CLASS,
  TOOLTIP_MAX_WIDTH_CLASS,
  TOOLTIP_BORDER_CLASS,
} from '../constants/ui';

interface TooltipState {
  text: string;
  rect: DOMRect;
}

/**
 * Gestionnaire universel de bulles d'information au survol pour TOUTE l'application :
 * - Intercepte automatiquement tout attribut HTML 'title' pour empêcher la bulle noire native du navigateur.
 * - Affiche une bulle personnalisée avec fond gris très soutenu, texte blanc plus gros, largeur limitée et retour à la ligne.
 * - Ne rentre pas en conflit avec les composants <Tooltip> explicites.
 */
export const GlobalTooltip: React.FC = () => {
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let currentTarget: HTMLElement | null = null;
    let timer: any = null;

    const handleMouseOver = (e: MouseEvent) => {
      let el = e.target as HTMLElement | null;

      while (el && el !== document.body) {
        // Ignorer si l'élément se trouve dans une bulle déjà rendue
        if (el.getAttribute('role') === 'tooltip') return;

        // Récupérer le titre natif ou déjà mémorisé
        const nativeTitle = el.getAttribute('title');
        const dataTooltip = el.getAttribute('data-applet-tooltip');

        if (nativeTitle) {
          // Supprimer le titre natif pour empêcher la bulle noire du navigateur
          el.setAttribute('data-applet-tooltip', nativeTitle);
          el.removeAttribute('title');
        }

        const textToDisplay = nativeTitle || dataTooltip;
        if (textToDisplay && textToDisplay.trim()) {
          currentTarget = el;
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (currentTarget) {
              setTooltipState({
                text: textToDisplay.trim(),
                rect: currentTarget.getBoundingClientRect(),
              });
            }
          }, 120);
          return;
        }

        el = el.parentElement;
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (currentTarget && (!related || !currentTarget.contains(related))) {
        clearTimeout(timer);
        currentTarget = null;
        setTooltipState(null);
      }
    };

    const handleDismiss = () => {
      clearTimeout(timer);
      currentTarget = null;
      setTooltipState(null);
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('scroll', handleDismiss, true);
    document.addEventListener('click', handleDismiss, true);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('scroll', handleDismiss, true);
      document.removeEventListener('click', handleDismiss, true);
    };
  }, []);

  if (!tooltipState) return null;

  const margin = 12;
  const gap = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const tooltipEl = tooltipRef.current;
  const width = tooltipEl ? tooltipEl.offsetWidth : 260;
  const height = tooltipEl ? tooltipEl.offsetHeight : 50;

  const centerX = tooltipState.rect.left + tooltipState.rect.width / 2;
  const isNearBottom = vh - tooltipState.rect.bottom < height + 35 || tooltipState.rect.bottom > vh - 120;

  let top = isNearBottom
    ? tooltipState.rect.top - height - gap
    : tooltipState.rect.bottom + gap;
  let left = centerX - width / 2;

  // Clamping strict dans la fenêtre
  left = Math.max(margin, Math.min(left, vw - width - margin));
  top = Math.max(margin, Math.min(top, vh - height - margin));

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
      className={`transition-opacity duration-150 ${TOOLTIP_MAX_WIDTH_CLASS}`}
    >
      <div
        className={`${TOOLTIP_BG_CLASS} ${TOOLTIP_TEXT_CLASS} p-3 rounded-xl shadow-2xl border ${TOOLTIP_BORDER_CLASS} leading-relaxed whitespace-normal break-words text-left relative animate-in fade-in zoom-in-95 duration-100`}
      >
        {tooltipState.text}
      </div>
    </div>,
    document.body
  );
};
