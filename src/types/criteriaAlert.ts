import { CRITERION_POINTS } from './criteria';

/**
 * Nombre de valeurs/niveaux possibles par critère (de 0 à 8, soit 6 niveaux actuellement).
 * Positionné dans une constante pour permettre à terme d'adapter facilement le nombre d'échelons.
 */
export const TOTAL_CRITERION_LEVELS_COUNT: number = CRITERION_POINTS.length; // 6

/**
 * Configuration des seuils d'alerte de mauvais étagement des critères
 */
export interface CriteriaAlertConfig {
  /** % d'alerte pour 1 valeur (seuil individuel, ex: 40%) */
  singleLevelThreshold: number;
  /** % d'alerte pour l'ensemble des valeurs (seuil de concentration cumulée, ex: 70%) */
  cumulatedThreshold: number;
  /** % d'alerte nb valeurs (pourcentage du nombre de niveaux définissant la concentration, ex: 33%) */
  levelCountPercentThreshold: number;
  /** Horodatage de dernière modification */
  updatedAt?: string;
  /** Email de l'utilisateur ayant mis à jour les paramètres */
  updatedBy?: string;
}

/**
 * Valeurs par défaut des paramètres d'alerte de mauvais étagement
 */
export const DEFAULT_CRITERIA_ALERT_CONFIG: CriteriaAlertConfig = {
  singleLevelThreshold: 40,
  cumulatedThreshold: 70,
  levelCountPercentThreshold: 33,
};

export interface LevelAlertInfo {
  isAlert: boolean;
  reason?: 'single' | 'cumulated' | 'both';
  detailMessage?: string;
  isSingleAlert?: boolean;
  singlePct?: number;
  singleThreshold?: number;
  isCumulatedAlert?: boolean;
  cumulatedSum?: number;
  cumulatedThreshold?: number;
  cumulatedCount?: number;
  maxAllowedLevels?: number;
}

/**
 * Détermine pour chaque niveau d'un critère (0, 1, 2, 3, 5, 8) s'il déclenche une alerte de mauvais étagement.
 *
 * Règle de gestion :
 * Un niveau est en alerte (bargraph en rouge foncé) si :
 *   1) Sa valeur (pct) >= singleLevelThreshold (pct-1-val)
 *   OU
 *   2) cumulatedThreshold (pct-toutes-val) est concentré sur au plus
 *      (levelCountPercentThreshold * TOTAL_CRITERION_LEVELS_COUNT / 100) valeurs.
 *      Dans ce cas, tous les niveaux participant à cette concentration sont mis en alerte.
 */
export function computeCriteriaLevelAlerts(
  percentagesByLevel: Record<number, number>,
  config: CriteriaAlertConfig = DEFAULT_CRITERIA_ALERT_CONFIG,
  totalLevelsCount: number = TOTAL_CRITERION_LEVELS_COUNT,
  totalProjects: number = 1
): Record<number, LevelAlertInfo> {
  const result: Record<number, LevelAlertInfo> = {};

  CRITERION_POINTS.forEach((pt) => {
    result[pt] = { isAlert: false };
  });

  if (totalProjects <= 0) {
    return result;
  }

  const { singleLevelThreshold, cumulatedThreshold, levelCountPercentThreshold } = config;

  // 1. Alerte individuelle : pct >= pct-1-val
  CRITERION_POINTS.forEach((pt) => {
    const pct = percentagesByLevel[pt] ?? 0;
    if (pct >= singleLevelThreshold && pct > 0) {
      result[pt] = {
        isAlert: true,
        reason: 'single',
        isSingleAlert: true,
        singlePct: pct,
        singleThreshold: singleLevelThreshold,
        detailMessage: `Seuil individuel dépassé (${pct} % ≥ ${singleLevelThreshold} %)`,
      };
    }
  });

  // 2. Alerte de concentration cumulée :
  // Nombre maximum de valeurs permises pour concentrer le seuil cumulé
  // ex: 33% * 6 = 1.98 -> 2 niveaux
  const maxAllowedLevels = Math.max(1, Math.round((levelCountPercentThreshold / 100) * totalLevelsCount));

  // Récupérer les niveaux triés par pourcentage décroissant (uniquement ceux avec des projets)
  const sortedLevels = CRITERION_POINTS
    .map((pt) => ({ pt, pct: percentagesByLevel[pt] ?? 0 }))
    .filter((item) => item.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  // Vérifier si un ensemble de m niveaux (avec 1 <= m <= maxAllowedLevels) atteint le seuil cumulé
  let cumulatedAlertLevels: { pt: number; pct: number }[] = [];
  let currentSum = 0;

  for (let i = 0; i < sortedLevels.length && i < maxAllowedLevels; i++) {
    currentSum += sortedLevels[i].pct;
    if (currentSum >= cumulatedThreshold) {
      cumulatedAlertLevels = sortedLevels.slice(0, i + 1);
      break;
    }
  }

  // Marquer les niveaux en alerte de concentration
  if (cumulatedAlertLevels.length > 0) {
    cumulatedAlertLevels.forEach((item) => {
      const prev = result[item.pt];
      const cumulatedMsg = `Concentration anormale (${currentSum} % des projets concentrés sur ${cumulatedAlertLevels.length} niveau(x) ≤ ${maxAllowedLevels} max)`;
      const isBoth = Boolean(prev.isAlert && prev.isSingleAlert);

      result[item.pt] = {
        isAlert: true,
        reason: isBoth ? 'both' : 'cumulated',
        isSingleAlert: prev.isSingleAlert,
        singlePct: prev.singlePct,
        singleThreshold: prev.singleThreshold,
        isCumulatedAlert: true,
        cumulatedSum: currentSum,
        cumulatedThreshold,
        cumulatedCount: cumulatedAlertLevels.length,
        maxAllowedLevels,
        detailMessage: prev.isAlert && prev.detailMessage
          ? `${prev.detailMessage} • ${cumulatedMsg}`
          : cumulatedMsg,
      };
    });
  }

  return result;
}
