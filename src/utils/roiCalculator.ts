import { Criterion } from '../types/criteria';

/**
 * Calcule le ROI d'un projet :
 * Somme pondérée des critères de valeur / Somme pondérée des critères de coût.
 *
 * Règle métier :
 * Le calcul du ROI ne doit être effectué que pour les projets dont l'état
 * a pour attribut « à prioriser » (needsPrioritization) à VRAI.
 * Si l'état n'est pas à prioriser (isStatePrioritized === false), le ROI est vide (null).
 */
export function calculateProjectRoi(
  criteriaValues: Record<string, number> | undefined,
  criteria: Criterion[],
  isStatePrioritized: boolean = true,
  bonus?: number | null,
  isBonusActive: boolean = true
): number | null {
  if (!isStatePrioritized) return null;
  if (!criteriaValues || criteria.length === 0) return null;

  let valueSum = 0;
  let costSum = 0;
  let hasEvaluatedValue = false;
  let hasEvaluatedCost = false;

  for (const crit of criteria) {
    const score = criteriaValues[crit.id];
    if (typeof score === 'number') {
      const weight = Number(crit.weight) || 1;
      const weightedScore = score * weight;

      if (crit.type === 'VALEUR') {
        valueSum += weightedScore;
        hasEvaluatedValue = true;
      } else if (crit.type === 'COÛT') {
        costSum += weightedScore;
        hasEvaluatedCost = true;
      }
    }
  }

  // Prise en compte des bonus projet dans le calcul du ROI de la priorisation si activé
  if (isBonusActive && typeof bonus === 'number' && !isNaN(bonus) && bonus !== 0) {
    valueSum += bonus;
    hasEvaluatedValue = true;
  }

  // Si aucun critère de valeur ni de coût n'est valorisé
  if (!hasEvaluatedValue && !hasEvaluatedCost) {
    return null;
  }

  // Cas où le coût total est 0
  if (costSum === 0) {
    return valueSum > 0 ? 999 : 0;
  }

  const rawRoi = valueSum / costSum;
  return Math.round(rawRoi * 100) / 100;
}

/**
 * Formate le ROI en chaîne lisible avec 2 décimales (virgule française ex : "0,23")
 */
export function formatRoi(roi: number | null | undefined): string {
  if (typeof roi !== 'number' || isNaN(roi)) return '-';
  return roi.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
