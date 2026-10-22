/**
 * Paramètres graphiques et classes de style globales pour l'interface utilisateur
 */

// Couleur standard bleue pour tous les boutons d'action principale : création et validation de modification
export const PRIMARY_ACTION_BUTTON_CLASS =
  'bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

// Style compact pour les boutons d'ajout dans les en-têtes d'onglets (Nouveau projet, Nouvelle ressource, etc.)
export const PRIMARY_ACTION_HEADER_BUTTON_CLASS =
  `inline-flex items-center gap-2 px-3.5 py-2 ${PRIMARY_ACTION_BUTTON_CLASS} text-xs`;

// Style pour les boutons de validation dans les fenêtres modales (Enregistrer, Créer, Valider)
export const PRIMARY_ACTION_MODAL_BUTTON_CLASS =
  `px-4 py-2 ${PRIMARY_ACTION_BUTTON_CLASS} text-xs flex items-center gap-2`;

// Style pour le bouton filtre "Mes ..." (Mes projets, Mes ressources)
export const MY_FILTER_BUTTON_ACTIVE_CLASS =
  'bg-blue-600 text-white border-blue-600 shadow-2xs';
export const MY_FILTER_BUTTON_INACTIVE_CLASS =
  'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200';

// =========================================================================
// PARAMÈTRES GLOBAUX CONFIGURABLES DES BULLES D'INFORMATION (TOOLTIPS)
// =========================================================================

// 1. Couleur de fond (gris très soutenu, moins foncé que le noir pur)
export const TOOLTIP_BG_CLASS = 'bg-slate-800';

// 2. Couleur de texte (bien blanche pour un contraste maximal)
export const TOOLTIP_TEXT_COLOR_CLASS = 'text-white';

// 3. Taille et graisse de police (légèrement plus grande pour une excellente lisibilité)
export const TOOLTIP_TEXT_SIZE_CLASS = 'text-[13px] sm:text-sm';
export const TOOLTIP_TEXT_WEIGHT_CLASS = 'font-medium';

// Combinaison complète de style de texte
export const TOOLTIP_TEXT_CLASS = `${TOOLTIP_TEXT_COLOR_CLASS} ${TOOLTIP_TEXT_SIZE_CLASS} ${TOOLTIP_TEXT_WEIGHT_CLASS}`;

// 4. Largeur maximale de la bulle (largeur limitée avec retour automatique à la ligne)
export const TOOLTIP_MAX_WIDTH_CLASS = 'max-w-xs sm:max-w-sm';

// 5. Bordure et ombre des bulles standards
export const TOOLTIP_BORDER_CLASS = 'border-slate-700 shadow-xl';

// Couleurs globales pour toutes les bulles d'information en cas d'erreur / problème (texte blanc et gras sur fond rouge)
export const TOOLTIP_ERROR_BG_CLASS = 'bg-red-600';
export const TOOLTIP_ERROR_TEXT_CLASS = 'text-white font-bold text-xs';
export const TOOLTIP_ERROR_BORDER_CLASS = 'border-red-700/80 shadow-red-950/20';

// Style global homogène pour les titres de colonnes de tous les tableaux (taille de police text-xs, majuscules, graisse)
export const TABLE_HEADER_TEXT_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-slate-700';

// Style global pour l'en-tête thead de tous les tableaux
export const TABLE_HEADER_THEAD_CLASS =
  'bg-slate-100/90 text-slate-700 uppercase font-semibold tracking-wider border-b border-slate-200 select-none';

// Double filet vertical marquant la séparation à droite de la dernière colonne figée dans les tableaux à défilement horizontal
export const TABLE_FROZEN_DIVIDER_CLASS = 'table-frozen-divider';

// Double filet horizontal sous la ligne de titre des tableaux (toujours visible, même lors du défilement)
export const TABLE_HEADER_DOUBLE_BOTTOM_CLASS = 'table-header-double-bottom';

