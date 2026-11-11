/**
 * Paramètres graphiques et classes de style globales pour l'interface utilisateur
 */

// =========================================================================
// BOUTONS GLOBAUX DE CRÉATION D'UN NOUVEL ITEM ("Créer un nouveau...", "Créer une nouvelle...")
// =========================================================================

// Variables globales de couleur et de police pour tous les boutons d'action et filtres actifs (Bleu standardisé)
export const PRIMARY_ACTION_BLUE_BG = 'bg-blue-600 hover:bg-blue-700';
export const PRIMARY_ACTION_BLUE_TEXT = 'text-white text-xs font-semibold';

// Variables globales de couleur et de police pour tous les boutons de création de l'application
export const CREATE_ITEM_BUTTON_BG = PRIMARY_ACTION_BLUE_BG;
export const CREATE_ITEM_BUTTON_TEXT = PRIMARY_ACTION_BLUE_TEXT;

// Style global unifié pour TOUS les boutons de création d'un nouvel item dans tous les onglets
export const CREATE_ITEM_BUTTON_CLASS =
  `inline-flex items-center gap-2 px-3.5 py-2 ${CREATE_ITEM_BUTTON_BG} ${CREATE_ITEM_BUTTON_TEXT} rounded-lg shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`;

// Couleur standard bleue pour tous les boutons d'action principale : création et validation de modification
export const PRIMARY_ACTION_BUTTON_CLASS =
  `${PRIMARY_ACTION_BLUE_BG} text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`;

// Style compact pour les boutons d'ajout dans les en-têtes d'onglets (Nouveau projet, Nouvelle ressource, etc.)
export const PRIMARY_ACTION_HEADER_BUTTON_CLASS = CREATE_ITEM_BUTTON_CLASS;

// Style pour les boutons de validation dans les fenêtres modales (Enregistrer, Créer, Valider)
export const PRIMARY_ACTION_MODAL_BUTTON_CLASS =
  `px-4 py-2 ${PRIMARY_ACTION_BUTTON_CLASS} text-xs flex items-center gap-2`;

// =========================================================================
// BOUTONS GLOBAUX SECONDAIRES DANS LES FENÊTRES MODALES ("Annuler", "Fermer")
// =========================================================================

// Variables globales de couleur et de police pour les boutons Annuler et Fermer des fenêtres modales
// (Gris légèrement plus soutenu que l'arrière-plan : fond bg-slate-200, survol bg-slate-300, texte text-slate-800)
export const MODAL_SECONDARY_BUTTON_BG = 'bg-slate-200 hover:bg-slate-300 active:bg-slate-300/80';
export const MODAL_SECONDARY_BUTTON_TEXT = 'text-slate-800 text-xs font-semibold';
export const MODAL_SECONDARY_BUTTON_BORDER = 'border border-slate-300';

// Style global unifié pour les boutons "Annuler" et "Fermer" dans TOUTES les fenêtres modales
export const MODAL_CANCEL_BUTTON_CLASS =
  `px-4 py-2 ${MODAL_SECONDARY_BUTTON_BG} ${MODAL_SECONDARY_BUTTON_TEXT} ${MODAL_SECONDARY_BUTTON_BORDER} rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`;

export const MODAL_CLOSE_BUTTON_CLASS = MODAL_CANCEL_BUTTON_CLASS;
export const MODAL_SECONDARY_BUTTON_CLASS = MODAL_CANCEL_BUTTON_CLASS;

// =========================================================================
// BOUTON "ENREGISTRER" CONDITIONNEL (ACTIF QUAND MODIFIÉ / GRISÉ QUAND INACTIF)
// ET MESSAGE D'AVERTISSEMENT DES MODIFICATIONS EN ATTENTE
// =========================================================================

// Style global pour le texte d'avertissement en orange "Modifications non enregistrées"
export const UNSAVED_CHANGES_TEXT_CLASS =
  'text-xs text-amber-600 font-medium animate-in fade-in select-none';

// Style global pour le bouton Enregistrer lorsqu'il est actif (modifications en attente d'enregistrement)
export const SAVE_BUTTON_ACTIVE_CLASS =
  `${PRIMARY_ACTION_BLUE_BG} ${PRIMARY_ACTION_BLUE_TEXT} rounded-lg shadow-xs cursor-pointer transition-all`;

// Style global pour le bouton Enregistrer lorsqu'il est inactif / grisé (aucune modification)
export const SAVE_BUTTON_INACTIVE_CLASS =
  'bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold rounded-lg cursor-not-allowed opacity-80 transition-all';

// Helper global retournant la classe CSS active ou inactive pour le bouton Enregistrer
export const getSaveButtonStateClass = (isEligibleToSave: boolean, isSaving: boolean = false): string =>
  isEligibleToSave && !isSaving ? SAVE_BUTTON_ACTIVE_CLASS : SAVE_BUTTON_INACTIVE_CLASS;

// =========================================================================
// BOUTONS FILTRES GLOBAUX ("Mes projets", "Mes ressources", "Sélection manuelle", etc.)
// =========================================================================

// Style global pour les boutons filtres actifs et inactifs (utilise la même couleur bleue standard que le bouton Créer)
// Note: h-9 box-border pour une hauteur standardisée de 36px parfaitement alignée avec les champs de recherche et listes déroulantes
export const FILTER_BUTTON_ACTIVE_CLASS =
  `${CREATE_ITEM_BUTTON_BG} text-white border-blue-600 shadow-2xs h-9 box-border`;
export const FILTER_BUTTON_INACTIVE_CLASS =
  'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 h-9 box-border';

// Alias pour compatibilité ascendante
export const MY_FILTER_BUTTON_ACTIVE_CLASS = FILTER_BUTTON_ACTIVE_CLASS;
export const MY_FILTER_BUTTON_INACTIVE_CLASS = FILTER_BUTTON_INACTIVE_CLASS;

// =========================================================================
// SÉLECTEURS SEGMENTÉS GLOBAUX (Périmètres "Tous / Staffés", Périodes "6 mois / 12 mois", etc.)
// =========================================================================
// Hauteur standardisée des sélecteurs segmentés appliquée à l'ensemble de l'application
export const SEGMENT_SELECTOR_HEIGHT_CLASS = 'h-8';

export const SEGMENT_SELECTOR_CONTAINER_CLASS =
  `flex items-center gap-1 p-0.5 bg-blue-50 rounded-xl border border-blue-200 shrink-0 box-border ${SEGMENT_SELECTOR_HEIGHT_CLASS}`;

export const SEGMENT_SELECTOR_BUTTON_ACTIVE_CLASS =
  'h-full flex items-center justify-center px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer bg-blue-600 text-white shadow-2xs whitespace-nowrap';

export const SEGMENT_SELECTOR_BUTTON_INACTIVE_CLASS =
  'h-full flex items-center justify-center px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-blue-700 hover:text-blue-900 whitespace-nowrap';

export const getSegmentSelectorButtonClass = (isActive: boolean): string =>
  isActive ? SEGMENT_SELECTOR_BUTTON_ACTIVE_CLASS : SEGMENT_SELECTOR_BUTTON_INACTIVE_CLASS;

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

// Double filet vertical marquant la séparation à droite de la colonne figée à gauche
export const TABLE_FROZEN_DIVIDER_CLASS = 'table-frozen-divider';

// Double filet vertical marquant la séparation à gauche de la colonne figée à droite (dernière colonne)
export const TABLE_FROZEN_DIVIDER_LEFT_CLASS = 'table-frozen-divider-left';

// Double filet horizontal sous la ligne de titre des tableaux (toujours visible, même lors du défilement)
export const TABLE_HEADER_DOUBLE_BOTTOM_CLASS = 'table-header-double-bottom';

// 9. Style global unifié pour TOUTES les cellules d'en-tête th de tous les tableaux
export const TABLE_TH_BASE_CLASS =
  `bg-slate-100 ${TABLE_HEADER_TEXT_CLASS} border-r border-slate-200 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS} select-none py-2.5`;

// 10. Style global pour les cellules d'en-tête th triables / interactives
export const TABLE_TH_SORTABLE_CLASS =
  `${TABLE_TH_BASE_CLASS} cursor-pointer group hover:bg-slate-200/60 transition-colors`;

// 11. Largeur optimisée pour les colonnes de compétences clés dans le tableau capacitaire
export const CAPACITY_SKILL_COL_WIDTH_CLASS = 'w-[104px] min-w-[104px] max-w-[104px]';

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

// =========================================================================
// TYPOGRAPHIE STANDARDISÉE DES TITRES (ONGLETS ET FENÊTRES MODALES)
// =========================================================================

// Taille et graisse standardisées pour tous les titres principaux (titres d'onglets et de fenêtres modales)
export const MAIN_TITLE_FONT_SIZE_CLASS = 'text-xl';
export const MAIN_TITLE_FONT_WEIGHT_CLASS = 'font-bold';
export const MAIN_TITLE_CLASS = `${MAIN_TITLE_FONT_SIZE_CLASS} ${MAIN_TITLE_FONT_WEIGHT_CLASS}`;
export const TAB_TITLE_CLASS = MAIN_TITLE_CLASS;
export const MODAL_TITLE_CLASS = MAIN_TITLE_CLASS;

// Typographie standardisée pour le nom et l'identifiant du projet (notamment dans les fenêtres modales)
export const PROJECT_TITLE_FONT_SIZE_CLASS = 'text-xl';
export const PROJECT_TITLE_FONT_WEIGHT_CLASS = 'font-bold';
export const PROJECT_TITLE_CLASS = `${PROJECT_TITLE_FONT_SIZE_CLASS} ${PROJECT_TITLE_FONT_WEIGHT_CLASS} text-black`;

// =========================================================================
// STANDARD UNIFIÉ DES FILETS DE SAISIE ET DE FILTRAGE (COULEUR ET ÉPAISSEUR)
// Épaisseur standardisée : 1px sans focus (au repos), 2px au focus
// Couleur repos : border-slate-300 (gris léger)
// Couleur focus / actif : border-indigo-600 (bleu plus soutenu)
// Type de filet : filet simple unique sans double contour ni ring
// =========================================================================

// 1. Filet sans focus : 1px gris léger (standardisé au repos)
export const INPUT_BORDER_THICKNESS_REST = 'border';
export const INPUT_BORDER_THICKNESS_FOCUS = 'border-2';
export const SEARCH_INPUT_BORDER_CLASS = 'border border-slate-300';
export const INPUT_BORDER_REST_CLASS = SEARCH_INPUT_BORDER_CLASS;

// 2. Fond très clair : blanc immaculé (comme dans l'onglet priorités)
export const SEARCH_INPUT_BG_CLASS = 'bg-white text-slate-800 placeholder-slate-400';

// 3. Filet au focus : filet simple unique 2px (sans double contour ni ring), bleu plus soutenu (indigo-600)
export const SEARCH_INPUT_FOCUS_BORDER_COLOR = 'border-indigo-600';
export const SEARCH_INPUT_FOCUS_CLASS =
  'focus:outline-none focus:border-2 focus:border-indigo-600 focus:ring-0';
export const GLOBAL_INPUT_FOCUS_CLASS = SEARCH_INPUT_FOCUS_CLASS;
export const INPUT_FOCUS_CLASS = GLOBAL_INPUT_FOCUS_CLASS;

// Style de base unifié de la boîte de saisie (filet 1px gris léger au repos, fond clair, filet 2px simple bleu soutenu au focus)
// Note: h-9 box-border garantit une hauteur externe strictement fixe de 36px au repos comme au focus (aucun décalage de 2px)
export const SEARCH_INPUT_BASE_CLASS =
  `${SEARCH_INPUT_BORDER_CLASS} ${SEARCH_INPUT_BG_CLASS} ${SEARCH_INPUT_FOCUS_CLASS} rounded-lg text-xs h-9 box-border transition-all`;

export const GLOBAL_INPUT_BASE_CLASS = SEARCH_INPUT_BASE_CLASS;
export const INPUT_BASE_CLASS = GLOBAL_INPUT_BASE_CLASS;

// Style pour boîte de saisie avec pictogramme loupe à gauche
export const SEARCH_INPUT_WITH_ICON_CLASS =
  `w-full pl-9 pr-8 ${SEARCH_INPUT_BASE_CLASS}`;

// Style pour boîte de saisie sans pictogramme à gauche ou avec bouton de validation séparé
export const SEARCH_INPUT_STANDALONE_CLASS =
  `w-full pl-3 pr-8 ${SEARCH_INPUT_BASE_CLASS}`;

// Bouton de validation de recherche (bleu soutenu comme dans l'onglet utilisateurs)
export const SEARCH_BUTTON_CLASS =
  'h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0 inline-flex items-center justify-center box-border disabled:opacity-50 disabled:cursor-not-allowed';

// Bouton croix d'effacement de la recherche
export const SEARCH_CLEAR_BUTTON_CLASS =
  'text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded transition-colors';

// =========================================================================
// ZONES DE SÉLECTION DE FILTRES D'ONGLETS (États, Lignes budgétaires, Alertes, etc.)
// Filet 1px au repos, filet simple unique 2px au focus ou à l'ouverture
// (aucun double filet ni ring), même bleu soutenu que les zones de recherche
// =========================================================================

export const FILTER_DROPDOWN_BUTTON_BASE_CLASS =
  'w-full px-3 h-9 box-border rounded-lg text-xs bg-white text-left flex items-center justify-between gap-2 transition-all cursor-pointer focus:outline-none focus:border-2 focus:border-indigo-600 focus:ring-0';

export const getFilterDropdownButtonClass = (
  isOpen: boolean,
  isFilterActive: boolean,
  activeBorderColor = 'border-indigo-500',
  activeBgColor = 'bg-indigo-50/20',
  activeTextColor = 'text-slate-800'
): string => {
  if (isOpen) {
    // Ouvert / actif avec focus : simple filet 2px bleu soutenu, aucun double ring
    return `${FILTER_DROPDOWN_BUTTON_BASE_CLASS} border-2 border-indigo-600 text-slate-900 shadow-2xs`;
  }
  if (isFilterActive) {
    // Filtre actif au repos : filet 1px avec teinte douce
    return `${FILTER_DROPDOWN_BUTTON_BASE_CLASS} border ${activeBorderColor} ${activeBgColor} ${activeTextColor} font-medium`;
  }
  // Inactif au repos : filet 1px gris léger avec survol gris soutenu
  return `${FILTER_DROPDOWN_BUTTON_BASE_CLASS} border border-slate-300 hover:border-slate-400 text-slate-700`;
};

// =========================================================================
// COULEURS STANDARDISÉES DES CRITÈRES DE PRIORISATION (VALEUR & COÛT)
// Vert émeraude (bg-emerald-50, text-emerald-700, border-emerald-200) pour VALEUR
// Jaune ambré (bg-amber-50, text-amber-700, border-amber-200) pour COÛT
// =========================================================================

export const CRITERION_VALEUR_BG = 'bg-emerald-50';
export const CRITERION_VALEUR_TEXT = 'text-emerald-700';
export const CRITERION_VALEUR_BORDER = 'border-emerald-200';
export const CRITERION_VALEUR_BADGE_CLASS =
  `${CRITERION_VALEUR_BG} ${CRITERION_VALEUR_TEXT} border ${CRITERION_VALEUR_BORDER}`;

export const CRITERION_COST_BG = 'bg-amber-50';
export const CRITERION_COST_TEXT = 'text-amber-700';
export const CRITERION_COST_BORDER = 'border-amber-200';
export const CRITERION_COST_BADGE_CLASS =
  `${CRITERION_COST_BG} ${CRITERION_COST_TEXT} border ${CRITERION_COST_BORDER}`;

// En-têtes de colonnes détaillées de critères dans les tableaux
export const CRITERION_HEADER_VALEUR_CLASS =
  'bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-800';
export const CRITERION_HEADER_COST_CLASS =
  'bg-amber-50/70 hover:bg-amber-100/80 text-amber-800';

// Fond de colonne dans les lignes de tableau
export const CRITERION_CELL_VALEUR_BG = 'bg-emerald-50/20';
export const CRITERION_CELL_COST_BG = 'bg-amber-50/20';


