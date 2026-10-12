/**
 * Interface pour les ressources et leur calendrier d'indisponibilité mensuelle
 */

export interface Resource {
  id: string;
  name: string; // Clé unique obligatoire (ex: "Nom Prénom" ou "Équipe Core Backend")
  description?: string; // Description de la ressource
  fte: number; // Équivalent Temps Plein (ETP, >= 0, typiquement 1.0, 0.8, etc.)
  skillId: string; // ID de la compétence clé de rattachement
  skillName?: string; // Nom de la compétence clé pour affichage rapide
  resourceManagerId?: string; // ID du RM responsable de la compétence
  unavailability: Record<string, number>; // Clé "YYYY-MM" -> nombre de jours d'indisponibilité (>= 0)
  createdAt?: string;
  updatedAt?: string;
}

export type ResourceFormData = Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Génère la liste ordonnée des 12 mois glissants au format YYYY-MM
 * à partir du mois courant inclus.
 * @param baseDate Date de référence (par défaut aujourd'hui)
 */
export function getRolling12Months(baseDate: Date = new Date()): { key: string; label: string; year: number; month: number }[] {
  const result: { key: string; label: string; year: number; month: number }[] = [];
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth(); // 0 à 11

  const monthNames = [
    'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin',
    'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'
  ];

  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1 à 12
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${year}`;
    result.push({ key, label, year, month });
  }

  return result;
}

/**
 * Nettoie un objet d'indisponibilité pour ne conserver que les mois valides ou récents
 * et supprimer les mois obsolètes passés.
 */
export function cleanObsoleteMonths(
  unavailability: Record<string, number> | undefined,
  rollingMonths: { key: string }[]
): Record<string, number> {
  if (!unavailability) return {};
  const validKeys = new Set(rollingMonths.map((m) => m.key));
  const cleaned: Record<string, number> = {};

  for (const [key, val] of Object.entries(unavailability)) {
    if (validKeys.has(key) && typeof val === 'number' && !isNaN(val)) {
      cleaned[key] = Math.max(0, val);
    }
  }

  return cleaned;
}
