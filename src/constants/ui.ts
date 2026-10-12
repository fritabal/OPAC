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
