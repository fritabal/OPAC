/**
 * Paramètres graphiques et classes de style globales pour l'interface utilisateur
 */

// =========================================================================
// BOUTONS GLOBAUX DE CRÉATION D'UN NOUVEL ITEM ("Créer un nouveau...", "Créer une nouvelle...")
// =========================================================================

// Variables globales de couleur et de police pour tous les boutons de création de l'application
export const CREATE_ITEM_BUTTON_BG = 'bg-blue-600 hover:bg-blue-700';
export const CREATE_ITEM_BUTTON_TEXT = 'text-white text-xs font-semibold';

// Style global unifié pour TOUS les boutons de création d'un nouvel item dans tous les onglets
export const CREATE_ITEM_BUTTON_CLASS =
  `inline-flex items-center gap-2 px-3.5 py-2 ${CREATE_ITEM_BUTTON_BG} ${CREATE_ITEM_BUTTON_TEXT} rounded-lg shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`;

// Couleur standard bleue pour tous les boutons d'action principale : création et validation de modification
export const PRIMARY_ACTION_BUTTON_CLASS =
  'bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

// Style compact pour les boutons d'ajout dans les en-têtes d'onglets (Nouveau projet, Nouvelle ressource, etc.)
export const PRIMARY_ACTION_HEADER_BUTTON_CLASS = CREATE_ITEM_BUTTON_CLASS;

// Style pour les boutons de validation dans les fenêtres modales (Enregistrer, Créer, Valider)
export const PRIMARY_ACTION_MODAL_BUTTON_CLASS =
  `px-4 py-2 ${PRIMARY_ACTION_BUTTON_CLASS} text-xs flex items-center gap-2`;

// =========================================================================
// BOUTON "ENREGISTRER" CONDITIONNEL (ACTIF QUAND MODIFIÉ / GRISÉ QUAND INACTIF)
// ET MESSAGE D'AVERTISSEMENT DES MODIFICATIONS EN ATTENTE
// =========================================================================

// Style global pour le texte d'avertissement en orange "Modifications non enregistrées"
export const UNSAVED_CHANGES_TEXT_CLASS =
  'text-xs text-amber-600 font-medium animate-in fade-in select-none';

// Style global pour le bouton Enregistrer lorsqu'il est actif (modifications en attente d'enregistrement)
export const SAVE_BUTTON_ACTIVE_CLASS =
  'bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer transition-all';

// Style global pour le bouton Enregistrer lorsqu'il est inactif / grisé (aucune modification)
export const SAVE_BUTTON_INACTIVE_CLASS =
  'bg-slate-100 text-slate-400 border border-slate-200 font-semibold rounded-lg cursor-not-allowed opacity-80 transition-all';

// Helper global retournant la classe CSS active ou inactive pour le bouton Enregistrer
export const getSaveButtonStateClass = (isEligibleToSave: boolean, isSaving: boolean = false): string =>
  isEligibleToSave && !isSaving ? SAVE_BUTTON_ACTIVE_CLASS : SAVE_BUTTON_INACTIVE_CLASS;

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

// 3. Taille et graisse de police des bulles d'information
export const TOOLTIP_TEXT_SIZE_CLASS = 'text-xs'; // Ex: 'text-xs' (12px), 'text-[11px]', 'text-[10px]'...
export const TOOLTIP_TEXT_WEIGHT_CLASS = 'font-medium';

// Combinaison complète de style de texte
export const TOOLTIP_TEXT_CLASS = `${TOOLTIP_TEXT_COLOR_CLASS} ${TOOLTIP_TEXT_SIZE_CLASS} ${TOOLTIP_TEXT_WEIGHT_CLASS}`;

// 4. Titre standardisé et filet séparateur dans les bulles d'information
export const TOOLTIP_TITLE_CLASS = `${TOOLTIP_TEXT_COLOR_CLASS} ${TOOLTIP_TEXT_SIZE_CLASS} font-bold leading-snug`;
export const TOOLTIP_DIVIDER_CLASS = 'border-b border-white/20 pb-1.5 mb-1.5';

// 5. Largeur maximale de la bulle (largeur limitée avec retour automatique à la ligne)
export const TOOLTIP_MAX_WIDTH_CLASS = 'max-w-xs sm:max-w-sm';

// 6. Bordure et ombre des bulles standards
export const TOOLTIP_BORDER_CLASS = 'border-slate-700 shadow-xl';

// Couleurs globales pour toutes les bulles d'information en cas d'erreur / problème (texte blanc et gras sur fond rouge)
export const TOOLTIP_ERROR_BG_CLASS = 'bg-red-600';
export const TOOLTIP_ERROR_TEXT_CLASS = 'text-white font-bold text-xs';
export const TOOLTIP_ERROR_BORDER_CLASS = 'border-red-700/80 shadow-red-950/20';

// =========================================================================
// EN-TÊTES DE TABLEAUX (THEAD, TH, TITRES DE COLONNES, TRI ET SURVOL)
// =========================================================================

// 1. Attributs typographiques élémentaires des titres de colonnes
export const TABLE_HEADER_FONT_SIZE_CLASS = 'text-xs';
export const TABLE_HEADER_FONT_WEIGHT_CLASS = 'font-semibold';
export const TABLE_HEADER_TEXT_TRANSFORM_CLASS = 'uppercase tracking-wider';
export const TABLE_HEADER_TEXT_COLOR_CLASS = 'text-slate-700';

// 2. Couleur au survol des titres de colonnes (tons neutres, sans virer au bleu)
export const TABLE_HEADER_HOVER_TEXT_COLOR_CLASS = 'group-hover:text-slate-900 hover:text-slate-900';

// 3. Fond et bordure de l'en-tête de tableau thead
export const TABLE_HEADER_THEAD_BG_CLASS = 'bg-slate-100/90';
export const TABLE_HEADER_THEAD_BORDER_CLASS = 'border-b border-slate-200';

// 4. Style global homogène pour les titres de colonnes de tous les tableaux
export const TABLE_HEADER_TEXT_CLASS =
  `${TABLE_HEADER_FONT_SIZE_CLASS} ${TABLE_HEADER_FONT_WEIGHT_CLASS} ${TABLE_HEADER_TEXT_TRANSFORM_CLASS} ${TABLE_HEADER_TEXT_COLOR_CLASS}`;

// 5. Style global pour l'en-tête thead de tous les tableaux
export const TABLE_HEADER_THEAD_CLASS =
  `${TABLE_HEADER_THEAD_BG_CLASS} ${TABLE_HEADER_TEXT_CLASS} ${TABLE_HEADER_THEAD_BORDER_CLASS} select-none`;

// 6. Style au survol d'une cellule d'en-tête th
export const TABLE_HEADER_TH_HOVER_CLASS = 'hover:bg-slate-200/60 transition-colors';

// 7. Bouton ou conteneur interactif de tri dans un en-tête de colonne (pas de couleur bleue, transition douce)
export const TABLE_HEADER_SORTABLE_BUTTON_CLASS =
  `group inline-flex items-center gap-1.5 ${TABLE_HEADER_TEXT_CLASS} ${TABLE_HEADER_HOVER_TEXT_COLOR_CLASS} transition-colors cursor-pointer select-none`;

// 8. Style des pictogrammes de tri (inactif vs actif)
export const TABLE_HEADER_SORT_ICON_INACTIVE_CLASS =
  'w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100 group-hover:text-slate-600 transition-all shrink-0';
export const TABLE_HEADER_SORT_ICON_ACTIVE_CLASS =
  'w-3.5 h-3.5 text-indigo-600 font-bold shrink-0';

// Double filet vertical marquant la séparation à droite de la dernière colonne figée dans les tableaux à défilement horizontal
export const TABLE_FROZEN_DIVIDER_CLASS = 'table-frozen-divider';

// Double filet horizontal sous la ligne de titre des tableaux (toujours visible, même lors du défilement)
export const TABLE_HEADER_DOUBLE_BOTTOM_CLASS = 'table-header-double-bottom';

// 9. Style global unifié pour TOUTES les cellules d'en-tête th de tous les tableaux
export const TABLE_TH_BASE_CLASS =
  `bg-slate-100 ${TABLE_HEADER_TEXT_CLASS} border-r border-slate-200 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS} select-none py-2.5`;

// 10. Style global pour les cellules d'en-tête th triables / interactives
export const TABLE_TH_SORTABLE_CLASS =
  `${TABLE_TH_BASE_CLASS} cursor-pointer group hover:bg-slate-200/60 transition-colors`;

// =========================================================================
// CASES À COCHER GLOBALES (CHECKBOXES, LEURS TITRES ET TEXTES EXPLICATIFS)
// =========================================================================

// Style global pour l'élément case à cocher (bordure slate-300 qui fonce en slate-400 au survol sans changer de teinte)
export const CHECKBOX_INPUT_CLASS =
  'h-4 w-4 rounded-[4px] border-slate-300 hover:border-slate-400 group-hover:border-slate-400 text-blue-600 focus:ring-blue-500 transition-colors cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-50';

// Style global pour le titre / libellé associé à une case à cocher
// (text-xs, font-normal non gras, text-slate-800, fonce en text-slate-950 au survol avec transition douce)
export const CHECKBOX_TITLE_CLASS =
  'text-xs font-normal text-slate-800 group-hover:text-slate-950 hover:text-slate-950 transition-colors cursor-pointer select-none leading-snug';

// Style global pour le texte explicatif / description sous ou à côté d'une case à cocher
// (taille text-[11px], graisse font-normal, couleur text-slate-500, fonce en text-slate-700 au survol avec transition douce)
export const CHECKBOX_DESCRIPTION_CLASS =
  'text-[11px] font-normal text-slate-500 group-hover:text-slate-700 hover:text-slate-700 transition-colors select-none leading-relaxed';

// Conteneur complet d'une case à cocher simple en ligne
export const CHECKBOX_CONTAINER_CLASS =
  'flex items-center gap-2 select-none group cursor-pointer';

// Conteneur complet sous forme de carte pour une case à cocher avec titre et texte explicatif
export const CHECKBOX_CARD_CONTAINER_CLASS =
  'p-3 sm:p-3.5 bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200 rounded-xl transition-all select-none cursor-pointer group';

