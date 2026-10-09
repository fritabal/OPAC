export interface Project {
  id: string; // Document Firestore
  projectNumber: number; // Identifiant (nombre) de création, unique, jamais réutilisé, non modifiable

  // Encart a) "Description"
  name: string; // Nom court, 30 caractères maximum, modifiable
  stateId: string; // État du cycle de vie, modifiable
  stateName?: string; // Nom dénormalisé de l'état pour affichage
  description: string; // Description détaillée sur 3000 caractères max, modifiable

  // Encart b) "Pilotage"
  createdByEmail: string; // Email de l'utilisateur qui l'a créé (non modifiable)
  projectManagerEmail: string; // Email du chef de projet (obligatoire, modifiable)
  deputyEmail?: string | null; // Email de l'adjoint au chef de projet (facultatif, modifiable)
  isConfidential?: boolean; // Projet confidentiel (masqué aux utilisateurs non autorisés)

  // Encart c) "Priorisation"
  budgetLineId: string; // Ligne budgétaire associée (modifiable)
  estimatedBudget: number; // Budget global estimatif en K€ (modifiable)
  criteriaValues: Record<string, number>; // Liste valorisée des critères (clé = criterionId, valeur = coefficient 0, 1, 2, 3, 5, 8)
  bonus?: number | null; // Bonus facultatif (nombre entier de points, modifiable)
  roi?: number | null; // Champ calculé (non modifiable) : somme pondérée Valeur / somme pondérée Coût

  // Encart d) "Autres"
  customParamValues: Record<string, string | number | null>; // Valeurs des paramètres personnalisés (clé = paramId)

  createdAt?: string;
  updatedAt?: string;
}

export type ProjectFormData = Omit<Project, 'id' | 'projectNumber' | 'createdAt' | 'updatedAt'>;
