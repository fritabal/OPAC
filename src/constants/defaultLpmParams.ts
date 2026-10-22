import { CriterionFormData } from '../types/criteria';
import { BudgetLineFormData } from '../types/budget';
import { ProjectStateFormData } from '../types/lifecycle';
import { CustomProjectParamFormData } from '../types/customParam';
import { BonusConfig } from '../types/bonus';

/**
 * Référentiel standard LPM par défaut : Critères de priorisation (6 critères)
 */
export const DEFAULT_CRITERIA_SEED: CriterionFormData[] = [
  {
    name: 'CA additionnel',
    type: 'VALEUR',
    weight: 2,
    isActive: true,
    levels: [
      '0 K€/an',
      'de 0 à 10 K€/an',
      'de 10 à 50 K€/an',
      'de 50 à 200 K€/an',
      'de 200 à 500 K€/an',
      'plus de 500 K€/an',
    ],
    order: 0,
  },
  {
    name: 'Nb entités concernées',
    type: 'VALEUR',
    weight: 1,
    isActive: true,
    levels: [
      'Aucune',
      'Corporate',
      'France',
      'Europe',
      'EMEA',
      'Monde',
    ],
    order: 1,
  },
  {
    name: 'Réduction des coûts de fonctionnement',
    type: 'VALEUR',
    weight: 2,
    isActive: true,
    levels: [
      '0 K€/an',
      'de 0 à 10 K€/an',
      'de 10 à 50 K€/an',
      'de 50 à 100 K€/an',
      'de 100 à 200 K€/an',
      'plus de 200 K€/an',
    ],
    order: 2,
  },
  {
    name: 'Réduction des risques (réglementaire, technique...)',
    type: 'VALEUR',
    weight: 1,
    isActive: true,
    levels: [
      '0 K€/an',
      'de 0 à 10 K€/an',
      'de 10 à 50 K€/an',
      'de 50 à 100 K€/an',
      'de 100 à 200 K€/an',
      'plus de 200 K€/an',
    ],
    order: 3,
  },
  {
    name: 'Charge interne',
    type: 'COÛT',
    weight: 1,
    isActive: true,
    levels: [
      '0 jh',
      'de 1 à 10 jh',
      'de 11 à 50 jh',
      'de 51 à 100 jh',
      'de 100 à 500 jh',
      'plus de 500 jh',
    ],
    order: 4,
  },
  {
    name: 'Débours',
    type: 'COÛT',
    weight: 1,
    isActive: true,
    levels: [
      '0 K€',
      'de 0 à 5 K€',
      'de 5 à 20 K€',
      'de 20 à 50 K€',
      'de 50 à 100 K€',
      'plus de 100 K€',
    ],
    order: 5,
  },
];

/**
 * Référentiel standard LPM par défaut : Lignes budgétaires (3 lignes)
 */
export const DEFAULT_BUDGET_LINES_SEED: BudgetLineFormData[] = [
  {
    name: 'Développement',
    budgetKe: 500,
    manager: 'M. A',
    color: '#06b6d4',
    isActive: true,
    order: 0,
  },
  {
    name: 'Innovation',
    budgetKe: 200,
    manager: 'Mme. B',
    color: '#f97316',
    isActive: true,
    order: 1,
  },
  {
    name: 'Décommissionnement',
    budgetKe: 50,
    manager: 'Mme. C',
    color: '#9333ea',
    isActive: true,
    order: 2,
  },
];

/**
 * Référentiel standard LPM par défaut : Compétences clés (8 compétences)
 */
export interface DefaultKeySkillSeedItem {
  name: string;
  description: string;
  alertOnDemandOverrun: boolean;
  isCapped: boolean;
  order: number;
  allocations: { budgetLineName: string; percentage: number }[];
}

export const DEFAULT_KEY_SKILLS_SEED: DefaultKeySkillSeedItem[] = [
  {
    name: 'Expert métier',
    description: 'Expert du métier pouvant jouer le rôle de Product Owner ou de référent',
    alertOnDemandOverrun: true,
    isCapped: false,
    order: 0,
    allocations: [
      { budgetLineName: 'Développement', percentage: 0 },
      { budgetLineName: 'Innovation', percentage: 0 },
      { budgetLineName: 'Décommissionnement', percentage: 0 },
    ],
  },
  {
    name: 'IT Project Manager',
    description: '',
    alertOnDemandOverrun: true,
    isCapped: false,
    order: 1,
    allocations: [
      { budgetLineName: 'Développement', percentage: 0 },
      { budgetLineName: 'Innovation', percentage: 0 },
      { budgetLineName: 'Décommissionnement', percentage: 0 },
    ],
  },
  {
    name: 'Cybersécurité',
    description: '',
    alertOnDemandOverrun: true,
    isCapped: false,
    order: 2,
    allocations: [
      { budgetLineName: 'Développement', percentage: 0 },
      { budgetLineName: 'Innovation', percentage: 0 },
      { budgetLineName: 'Décommissionnement', percentage: 0 },
    ],
  },
  {
    name: 'IT architect',
    description: '',
    alertOnDemandOverrun: true,
    isCapped: true,
    order: 3,
    allocations: [
      { budgetLineName: 'Développement', percentage: 40 },
      { budgetLineName: 'Innovation', percentage: 30 },
      { budgetLineName: 'Décommissionnement', percentage: 30 },
    ],
  },
  {
    name: 'IT data & AI expert',
    description: '',
    alertOnDemandOverrun: true,
    isCapped: false,
    order: 4,
    allocations: [
      { budgetLineName: 'Développement', percentage: 0 },
      { budgetLineName: 'Innovation', percentage: 0 },
      { budgetLineName: 'Décommissionnement', percentage: 0 },
    ],
  },
  {
    name: 'IT SAP expert',
    description: '',
    alertOnDemandOverrun: true,
    isCapped: false,
    order: 5,
    allocations: [
      { budgetLineName: 'Développement', percentage: 0 },
      { budgetLineName: 'Innovation', percentage: 0 },
      { budgetLineName: 'Décommissionnement', percentage: 0 },
    ],
  },
  {
    name: 'SEO / GEO expert',
    description: '',
    alertOnDemandOverrun: true,
    isCapped: false,
    order: 6,
    allocations: [
      { budgetLineName: 'Développement', percentage: 0 },
      { budgetLineName: 'Innovation', percentage: 0 },
      { budgetLineName: 'Décommissionnement', percentage: 0 },
    ],
  },
  {
    name: 'Légal / réglementaire',
    description: '',
    alertOnDemandOverrun: false,
    isCapped: false,
    order: 7,
    allocations: [
      { budgetLineName: 'Développement', percentage: 0 },
      { budgetLineName: 'Innovation', percentage: 0 },
      { budgetLineName: 'Décommissionnement', percentage: 0 },
    ],
  },
];

/**
 * Référentiel standard LPM par défaut : États du cycle de vie (7 états)
 */
export const DEFAULT_LIFECYCLE_STATES_SEED: Omit<ProjectStateFormData, 'order'>[] = [
  {
    name: 'Idéation',
    description: 'Nouvelle proposition de projet ou besoin émergent en attente de qualification initiale.',
    needsStaffing: false,
    needsPrioritization: true,
  },
  {
    name: 'Prêt pour cadrage',
    description:
      "La formalisation et l'estimation initiale de la valeur et du coût du projet sont prêtes. Le projet peut être soumis à la décision du comité d'arbitrage pour lancer un cadrage business et technique plus approfondi.",
    needsStaffing: false,
    needsPrioritization: true,
  },
  {
    name: 'Cadrage en cours',
    description:
      "Etude d'opportunité (business), étude de faisabilité (technico-fonctionnelle), étude d'impact (organisationnel...), ré-estimation affinée de la valeur et des coûts.",
    needsStaffing: true,
    needsPrioritization: true,
  },
  {
    name: 'Prêt pour réalisation',
    description: 'Projet validé lors du comité de priorisation, en attente d’allocation des compétences clés.',
    needsStaffing: false,
    needsPrioritization: true,
  },
  {
    name: 'En cours de réalisation',
    description: 'Équipe constituée et ressources allouées, développement et livraison active.',
    needsStaffing: true,
    needsPrioritization: true,
  },
  {
    name: 'Terminé',
    description: 'Livrables validés en production, bilan post-projet et clôture.',
    needsStaffing: false,
    needsPrioritization: false,
  },
  {
    name: 'Abandonné / Reporté',
    description: 'Projet non retenu lors des arbitrages ou gelé pour des raisons stratégiques.',
    needsStaffing: false,
    needsPrioritization: false,
  },
];

/**
 * Référentiel standard LPM par défaut : Paramètres personnalisés de projet (6 paramètres)
 */
export const DEFAULT_CUSTOM_PARAMS_SEED: CustomProjectParamFormData[] = [
  {
    name: "Maîtrise d'ouvrage",
    description: 'Entité demandeuse',
    type: 'texte court',
    order: 0,
    isRequired: true,
    allowMultiple: false,
    options: [],
  },
  {
    name: 'Notes & Contexte stratégique',
    description: 'Contexte métier détaillé et hypothèses de faisabilité',
    type: 'texte long',
    order: 1,
    isRequired: false,
    allowMultiple: false,
    options: [],
  },
  {
    name: 'Mise en service au plus tard',
    description: 'Date de mise en service au plus tard pour bénéficier de la valeur du projet.',
    type: 'date',
    order: 2,
    isRequired: false,
    allowMultiple: false,
    options: [],
  },
  {
    name: 'Durée de vie estimée (en années)',
    description: "Durée de vie estimée d'exploitation de la solution développée par le projet",
    type: 'nombre avec 2 décimales',
    order: 3,
    isRequired: false,
    allowMultiple: false,
    options: [],
  },
  {
    name: 'Validé par le VMO',
    description: 'Go accordé par le VMO',
    type: 'case à cocher',
    order: 4,
    isRequired: false,
    allowMultiple: false,
    options: [],
  },
  {
    name: 'Produits / solutions impactés',
    description: 'Liste des produits ou solutions impactés par les travaux du projet',
    type: 'liste de valeurs',
    order: 5,
    options: ['Produit 1', 'Produit 2', 'Produit 3'],
    allowMultiple: false,
    isRequired: false,
  },
];

/**
 * Référentiel standard LPM par défaut : Configuration des bonus
 */
export const DEFAULT_BONUS_CONFIG_SEED: BonusConfig = {
  isBonusActive: true,
  checkQuotas: true,
  maxBonusedProjects: 2,
  maxBonusPointsPerProject: 10,
  maxTotalBonusPoints: 15,
};
