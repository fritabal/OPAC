export interface BonusConfig {
  isBonusActive: boolean; // "Bonus actifs"
  checkQuotas: boolean; // "Vérification des quotas de bonus"
  maxBonusedProjects: number | null; // "Nombre maximum de projets bonussés"
  maxBonusPointsPerProject: number | null; // "Nombre de points de bonus maximum par projet"
  maxTotalBonusPoints: number | null; // "Nombre total de points de bonus à distribuer sur l'ensemble des projets"
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_BONUS_CONFIG: BonusConfig = {
  isBonusActive: true,
  checkQuotas: false,
  maxBonusedProjects: 10,
  maxBonusPointsPerProject: 5,
  maxTotalBonusPoints: 30,
};
