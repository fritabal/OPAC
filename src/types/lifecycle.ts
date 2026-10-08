export interface ProjectState {
  id: string;
  name: string; // Clé unique, obligatoire
  description?: string; // Facultatif
  needsStaffing: boolean; // Attribut "à staffer" (boîte à cocher)
  needsPrioritization: boolean; // Attribut "à prioriser" (boîte à cocher)
  order: number; // Ordre séquentiel dans le cycle de vie
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectStateFormData = {
  name: string;
  description?: string;
  needsStaffing: boolean;
  needsPrioritization: boolean;
  order: number;
};
