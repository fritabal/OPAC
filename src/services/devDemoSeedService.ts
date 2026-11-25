import {
  collection,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, getEnvCollectionName, IS_DEV_DB_ENV } from '../lib/firebase';
import { Criterion, CRITERION_POINTS } from '../types/criteria';
import { KeySkill } from '../types/skill';
import { ProjectState } from '../types/lifecycle';
import { Project } from '../types/project';
import { calculateProjectRoi } from '../utils/roiCalculator';
import { roundToHalfDay } from '../utils/workingDays';
import { getNextPeriodInfo } from '../utils/dateUtils';

export type RupLifecycleCategory =
  | 'ideation'
  | 'ready_elaboration'
  | 'elaboration'
  | 'ready_construction'
  | 'construction'
  | 'transition'
  | 'completed'
  | 'cancelled';

type RupPhase = 'inception' | 'elaboration' | 'construction' | 'transition';

type SkillBucket =
  | 'dev'
  | 'tester'
  | 'architect'
  | 'pm'
  | 'business'
  | 'cyber'
  | 'data'
  | 'seo'
  | 'sap'
  | 'legal'
  | 'other';

export interface ParsedCostRange {
  coefficient: number;
  label: string;
  minDays: number;
  maxDays: number;
}

export interface DevDemoSeedPreview {
  projectCount: number;
  primaryCostCriterionName: string | null;
  parsedCostRanges: ParsedCostRange[];
  skillsDetected: { id: string; name: string; bucket: SkillBucket; marketTjmEur: number }[];
  statesBreakdown: { stateName: string; category: RupLifecycleCategory; count: number }[];
  sapCandidateProjects: string[];
}

export interface DevDemoSeedProjectResult {
  id: string;
  projectNumber: number;
  name: string;
  stateName: string;
  category: RupLifecycleCategory;
  totalWorkloadDays: number;
  estimatedBudgetKe: number;
  roi: number | null;
  hasSap: boolean;
  sumPast12mDays: number;
  sumNext12mDays: number;
  ratDays: number;
  completedMonthsAgo?: number;
}

export interface DevDemoSeedResult {
  updatedCount: number;
  primaryCostCriterionName: string;
  sapProjects: string[];
  projects: DevDemoSeedProjectResult[];
}

/**
 * TJM marché moyens constatés (€ / jour) par profil de compétence clé
 */
export const MARKET_TJM_EUR_BY_BUCKET: Record<SkillBucket, number> = {
  sap: 950,
  architect: 850,
  cyber: 850,
  data: 800,
  legal: 800,
  pm: 750,
  business: 650,
  seo: 650,
  dev: 600,
  tester: 500,
  other: 650,
};

/**
 * Répartition RUP standard de la charge globale d'un projet par phase (somme = 1.0)
 */
const RUP_PHASE_WEIGHTS: Record<RupPhase, number> = {
  inception: 0.05,
  elaboration: 0.20,
  construction: 0.65,
  transition: 0.10,
};

/**
 * Répartition RUP des activités (compétences) au sein de chaque phase (hors SAP qui est injecté sur 1 à 2 projets)
 */
const RUP_DISCIPLINE_WEIGHTS: Record<RupPhase, Record<Exclude<SkillBucket, 'sap' | 'other'>, number>> = {
  inception: {
    business: 0.36,
    pm: 0.20,
    architect: 0.16,
    legal: 0.10,
    data: 0.07,
    seo: 0.05,
    cyber: 0.03,
    dev: 0.03,
    tester: 0.00,
  },
  elaboration: {
    architect: 0.24,
    business: 0.18,
    pm: 0.15,
    dev: 0.16,
    data: 0.08,
    cyber: 0.07,
    tester: 0.06,
    seo: 0.04,
    legal: 0.02,
  },
  construction: {
    dev: 0.48,
    tester: 0.21,
    architect: 0.08,
    pm: 0.08,
    business: 0.05,
    data: 0.04,
    cyber: 0.03,
    seo: 0.02,
    legal: 0.01,
  },
  transition: {
    tester: 0.34,
    dev: 0.24,
    business: 0.14,
    pm: 0.10,
    seo: 0.06,
    cyber: 0.05,
    data: 0.04,
    legal: 0.03,
    architect: 0.00,
  },
};

function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function randomInt(min: number, max: number): number {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function pickWeighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((acc, i) => acc + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function addMonthsKey(baseDate: Date, offsetMonths: number): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonths, 1);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Classifie une compétence clé dans le bucket RUP le plus pertinent
 */
export function classifySkillBucket(skillName: string): SkillBucket {
  const n = normalizeText(skillName);
  if (n.includes('sap') || n.includes('erp')) return 'sap';
  if (n.includes('develop') || n.includes('dev') || n.includes('full stack') || n.includes('fullstack') || n.includes('software') || n.includes('ingenieur')) return 'dev';
  if (n.includes('test') || n.includes('qa') || n.includes('qualit') || n.includes('recette')) return 'tester';
  if (n.includes('architect')) return 'architect';
  if (n.includes('project manager') || n.includes('chef de projet') || n === 'pm' || n.includes('pmo')) return 'pm';
  if (n.includes('metier') || n.includes('business') || n.includes('product owner') || n.includes('moa')) return 'business';
  if (n.includes('cyber') || n.includes('secur')) return 'cyber';
  if (n.includes('data') || n.includes('ia') || n.includes('ai') || n.includes('bi') || n.includes('analytics')) return 'data';
  if (n.includes('seo') || n.includes('geo') || n.includes('search')) return 'seo';
  if (n.includes('legal') || n.includes('reglement') || n.includes('jurid') || n.includes('rgpd') || n.includes('compliance')) return 'legal';
  return 'other';
}

/**
 * Classifie un état du cycle de vie dans sa catégorie RUP
 */
export function classifyLifecycleState(stateName: string): RupLifecycleCategory {
  const n = normalizeText(stateName);
  if (n.includes('termine') || n.includes('cloture') || n.includes('closed') || n.includes('done') || n.includes('fini')) {
    return 'completed';
  }
  if (n.includes('abandon') || n.includes('report') || n.includes('annul') || n.includes('gel')) {
    return 'cancelled';
  }
  if (n.includes('deploiement') || n.includes('transition') || n.includes('mise en prod') || n.includes('mep')) {
    return 'transition';
  }
  if (n.includes('pret pour realisation') || n.includes('ready for dev') || n.includes('pret realisation')) {
    return 'ready_construction';
  }
  if (n.includes('realisation') || n.includes('construction') || n.includes('developpement') || n.includes('execution')) {
    return 'construction';
  }
  if (n.includes('cadrage en cours') || n.includes('elaboration')) {
    return 'elaboration';
  }
  if (n.includes('pret pour cadrage') || n.includes('ready for framing')) {
    return 'ready_elaboration';
  }
  if (n.includes('ideation') || n.includes('idee') || n.includes('inception')) {
    return 'ideation';
  }
  return 'construction';
}

/**
 * Extrait dynamiquement les bornes [minDays, maxDays] d'un libellé de plage du critère de coût
 * (ex: "0 jh", "de 1 à 50 jh", "de 500 à 2 000 jh", "plus de 2000 jh", "> 1500 jh").
 */
export function parseCostLevelRange(label: string, levelIndex: number): ParsedCostRange {
  const coefficient = CRITERION_POINTS[levelIndex] ?? 0;
  const fallbackRanges: [number, number][] = [
    [0, 0],
    [1, 10],
    [11, 50],
    [51, 100],
    [101, 500],
    [501, 1000],
  ];

  const clean = (label || '')
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .replace(',', '.');

  const rawMatches: number[] = [];
  const regex = /(\d+(?:\.\d+)?)\s*(k)?/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(clean)) !== null) {
    let val = parseFloat(match[1]);
    if (isNaN(val)) continue;
    if (match[2]) {
      val *= 1000;
    }
    rawMatches.push(Math.round(val));
  }

  let minDays = fallbackRanges[levelIndex]?.[0] ?? 0;
  let maxDays = fallbackRanges[levelIndex]?.[1] ?? 100;

  if (rawMatches.length >= 2) {
    minDays = Math.min(rawMatches[0], rawMatches[1]);
    maxDays = Math.max(rawMatches[0], rawMatches[1]);
    if (minDays === 0 && levelIndex > 0) {
      minDays = 1;
    }
  } else if (rawMatches.length === 1) {
    const num = rawMatches[0];
    if (num === 0) {
      minDays = 0;
      maxDays = 0;
    } else if (/plus de|>|sup[ée]rieur|au[- ]del[àa]|\+/i.test(clean)) {
      minDays = num;
      maxDays = Math.round(num * 1.75);
    } else if (/moins de|<|inf[ée]rieur|jusqu/i.test(clean)) {
      minDays = Math.max(1, Math.round(num * 0.25));
      maxDays = num;
    } else {
      minDays = Math.max(1, Math.round(num * 0.75));
      maxDays = Math.round(num * 1.25);
    }
  }

  return {
    coefficient,
    label,
    minDays,
    maxDays: Math.max(minDays, maxDays),
  };
}

/**
 * Distribue un total de jours sur N mois selon une courbe normalisée (plus arrondi à 0.5 j)
 */
function distributeDaysOverCurve(totalDays: number, weights: number[]): number[] {
  if (weights.length === 0 || totalDays <= 0) {
    return weights.map(() => 0);
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    return weights.map(() => 0);
  }

  const raw = weights.map((w) => (totalDays * w) / sumW);
  const rounded = raw.map((v) => roundToHalfDay(v));

  // Ajuster le plus gros mois pour que la somme reste fidèle à totalDays (arrondi à 0.5)
  const target = roundToHalfDay(totalDays);
  const currentSum = roundToHalfDay(rounded.reduce((a, b) => a + b, 0));
  const diff = roundToHalfDay(target - currentSum);
  if (Math.abs(diff) >= 0.5) {
    let maxIdx = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i] > rounded[maxIdx]) maxIdx = i;
    }
    rounded[maxIdx] = Math.max(0, roundToHalfDay(rounded[maxIdx] + diff));
  }

  return rounded;
}

/**
 * Répartit un budget de jours d'une phase RUP entre les compétences réellement présentes dans la base
 */
function allocatePhaseDaysToSkills(
  phaseDays: number,
  phase: RupPhase,
  skills: { skill: KeySkill; bucket: SkillBucket }[],
  includeSap: boolean
): Record<string, number> {
  const result: Record<string, number> = {};
  if (phaseDays <= 0 || skills.length === 0) {
    skills.forEach(({ skill }) => {
      result[skill.id] = 0;
    });
    return result;
  }

  const baseWeights = RUP_DISCIPLINE_WEIGHTS[phase];
  const skillRawWeights: { id: string; weight: number; bucket: SkillBucket }[] = [];

  // Compter combien de compétences tombent dans chaque bucket pour partager équitablement
  const bucketCounts: Record<string, number> = {};
  skills.forEach(({ bucket }) => {
    bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
  });

  // Vérifier s'il existe une compétence SAP dans le référentiel
  const hasSapSkill = skills.some((s) => s.bucket === 'sap');

  skills.forEach(({ skill, bucket }) => {
    let w = 0;
    if (bucket === 'sap') {
      if (includeSap) {
        w = phase === 'inception' ? 0.08 : phase === 'elaboration' ? 0.16 : phase === 'construction' ? 0.22 : 0.14;
      } else {
        w = 0;
      }
    } else if (bucket === 'other') {
      w = 0.04;
    } else {
      w = baseWeights[bucket] ?? 0.03;
      // Règle 2.4 : tous les projets ont besoin d'un peu d'expertise SEO & Data
      if ((bucket === 'seo' || bucket === 'data') && w === 0) {
        w = 0.03;
      }
      // Légère réduction de la part Dev si SAP mobilisé sur ce projet
      if (includeSap && hasSapSkill && bucket === 'dev') {
        w *= 0.65;
      }
    }

    // Variabilité contrôlée (+/- 15 %) autour des ratios RUP pour éviter des chiffres trop uniformes
    const jitter = w > 0 ? 0.85 + Math.random() * 0.30 : 1;
    const countInBucket = bucketCounts[bucket] || 1;
    skillRawWeights.push({
      id: skill.id,
      bucket,
      weight: (w * jitter) / countInBucket,
    });
  });

  const totalW = skillRawWeights.reduce((acc, s) => acc + s.weight, 0);
  if (totalW <= 0) {
    skills.forEach(({ skill }) => {
      result[skill.id] = 0;
    });
    return result;
  }

  skillRawWeights.forEach(({ id, weight, bucket }) => {
    let days = (phaseDays * weight) / totalW;
    // Garantir une trace minimale (0.5 j) pour SEO et Data sur les projets actifs de taille suffisante
    if ((bucket === 'seo' || bucket === 'data') && phaseDays >= 15 && days > 0 && days < 0.5) {
      days = 0.5;
    }
    result[id] = roundToHalfDay(days);
  });

  return result;
}

/**
 * Sélectionne 1 à 2 projets pour recevoir de l'expertise SAP
 */
function selectSapProjectIds(projects: Project[]): Set<string> {
  if (projects.length === 0) return new Set();
  const targetCount = projects.length >= 4 ? 2 : 1;

  // Prioriser les projets dont le nom ou la description mentionne SAP / ERP / Finance / Core
  const scored = projects.map((p) => {
    const text = normalizeText(`${p.name} ${p.description || ''}`);
    let score = Math.random();
    if (text.includes('sap') || text.includes('erp')) score += 100;
    else if (text.includes('factur') || text.includes('financ') || text.includes('compta') || text.includes('supply')) score += 10;
    return { id: p.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return new Set(scored.slice(0, targetCount).map((s) => s.id));
}

async function loadDevReferenceData() {
  if (!IS_DEV_DB_ENV) {
    throw new Error("Sécurité : le générateur de données de test RUP ne peut s'exécuter que sur l'environnement de développement (dev__).");
  }

  const [projectsSnap, criteriaSnap, skillsSnap, statesSnap] = await Promise.all([
    getDocs(collection(db, getEnvCollectionName('projects'))),
    getDocs(collection(db, getEnvCollectionName('criteria'))),
    getDocs(collection(db, getEnvCollectionName('keySkills'))),
    getDocs(collection(db, getEnvCollectionName('projectStates'))),
  ]);

  const projects: Project[] = projectsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as Project))
    .sort((a, b) => (a.projectNumber || 0) - (b.projectNumber || 0));

  const criteria: Criterion[] = criteriaSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as Criterion))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const skills: KeySkill[] = skillsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as KeySkill))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const projectStates: ProjectState[] = statesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as ProjectState))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return { projects, criteria, skills, projectStates };
}

/**
 * Prévisualise ce que le générateur RUP va détecter et mettre à jour dans la base de dev (`dev__*`)
 */
export async function previewDevRupDemoSeed(): Promise<DevDemoSeedPreview> {
  const { projects, criteria, skills, projectStates } = await loadDevReferenceData();

  const activeCostCriteria = criteria.filter((c) => c.isActive && c.type === 'COÛT');
  const primaryCost = activeCostCriteria[0] || criteria.find((c) => c.type === 'COÛT') || null;
  const parsedCostRanges = primaryCost
    ? (primaryCost.levels || []).map((lbl, idx) => parseCostLevelRange(lbl, idx))
    : [];

  const skillsDetected = skills.map((sk) => {
    const bucket = classifySkillBucket(sk.name);
    return {
      id: sk.id,
      name: sk.name,
      bucket,
      marketTjmEur: MARKET_TJM_EUR_BY_BUCKET[bucket],
    };
  });

  const stateMap = new Map(projectStates.map((s) => [s.id, s]));
  const countsMap = new Map<string, { stateName: string; category: RupLifecycleCategory; count: number }>();

  projects.forEach((p) => {
    const st = stateMap.get(p.stateId);
    const stateName = st?.name || p.stateName || 'État inconnu';
    const category = classifyLifecycleState(stateName);
    const key = `${stateName}__${category}`;
    const existing = countsMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      countsMap.set(key, { stateName, category, count: 1 });
    }
  });

  const sapIds = selectSapProjectIds(projects);
  const sapCandidateProjects = projects
    .filter((p) => sapIds.has(p.id))
    .map((p) => `#${p.projectNumber} ${p.name}`);

  return {
    projectCount: projects.length,
    primaryCostCriterionName: primaryCost?.name || null,
    parsedCostRanges,
    skillsDetected,
    statesBreakdown: Array.from(countsMap.values()),
    sapCandidateProjects,
  };
}

/**
 * Enrichit tous les projets existants de la base de dev (`dev__*`) selon les règles RUP,
 * sans jamais créer ni supprimer de projets.
 */
export async function applyDevRupDemoSeed(): Promise<DevDemoSeedResult> {
  const { projects, criteria, skills, projectStates } = await loadDevReferenceData();

  if (projects.length === 0) {
    throw new Error('Aucun projet existant trouvé dans la base de développement.');
  }
  if (skills.length === 0) {
    throw new Error('Aucune compétence clé trouvée dans la base de développement.');
  }

  const activeCriteria = criteria.filter((c) => c.isActive);
  const valueCriteria = activeCriteria.filter((c) => c.type === 'VALEUR');
  const costCriteria = activeCriteria.filter((c) => c.type === 'COÛT');
  const primaryCostCriterion = costCriteria[0] || criteria.find((c) => c.type === 'COÛT');

  if (!primaryCostCriterion) {
    throw new Error('Aucun critère de COÛT trouvé pour dériver la charge globale des projets.');
  }

  const costRanges = (primaryCostCriterion.levels || []).map((lbl, idx) =>
    parseCostLevelRange(lbl, idx)
  );
  const nonZeroRangeIndices = costRanges
    .map((r, idx) => ({ r, idx }))
    .filter((item) => item.r.maxDays > 0);

  const classifiedSkills = skills.map((skill) => ({
    skill,
    bucket: classifySkillBucket(skill.name),
  }));

  const stateMap = new Map(projectStates.map((s) => [s.id, s]));
  const sapProjectIds = selectSapProjectIds(projects);

  const now = new Date();
  const currentMonthKey = addMonthsKey(now, 0);
  const nextMonthKey = getNextPeriodInfo(now).key;

  // Fenêtre passée affichée dans l'app : M-11 .. M0 (12 mois glissants jusqu'au mois courant)
  const past12Keys = Array.from({ length: 12 }, (_, idx) => addMonthsKey(now, idx - 11));
  // Fenêtre future affichée dans le plan de staffing : M0 .. M+11 (12 mois glissants depuis mois courant)
  const future12Keys = Array.from({ length: 12 }, (_, idx) => addMonthsKey(now, idx));

  const completedOffsetsCycle = [0, 3, 6, 9];
  let completedCounter = 0;

  const projectResults: DevDemoSeedProjectResult[] = [];
  const projectsColName = getEnvCollectionName('projects');

  for (const project of projects) {
    const stateObj = stateMap.get(project.stateId);
    const stateName = stateObj?.name || project.stateName || '';
    const category = classifyLifecycleState(stateName);
    const includeSap = sapProjectIds.has(project.id);

    // 1. Choix aléatoire du niveau sur le 1er critère de coût (Charge interne élargie)
    const weightedLevelPool = nonZeroRangeIndices.map(({ idx }) => {
      // Pondération réaliste : majorité de projets moyens/grands pour bien illustrer la courbe RUP,
      // tout en gardant quelques petits et très gros projets.
      const defaultW = idx === 1 ? 0.12 : idx === 2 ? 0.24 : idx === 3 ? 0.28 : idx === 4 ? 0.24 : 0.12;
      return { value: idx, weight: defaultW };
    });

    const chosenLevelIdx =
      category === 'cancelled'
        ? (nonZeroRangeIndices[0]?.idx ?? 1)
        : pickWeighted(weightedLevelPool);

    const chosenRange = costRanges[chosenLevelIdx] || costRanges[1] || {
      coefficient: 2,
      label: '',
      minDays: 50,
      maxDays: 200,
    };

    const totalWorkloadDays = Math.max(
      1,
      randomInt(Math.max(1, chosenRange.minDays), Math.max(1, chosenRange.maxDays))
    );

    // 2. Valorisation aléatoire des critères VALEUR et COÛT
    const criteriaValues: Record<string, number> = { ...(project.criteriaValues || {}) };
    criteriaValues[primaryCostCriterion.id] = chosenRange.coefficient;

    // Critères de coût secondaires (ex: Débours) corrélés à l'envergure + aléa
    costCriteria.slice(1).forEach((crit) => {
      const shiftedIdx = Math.max(
        0,
        Math.min(5, chosenLevelIdx + randomInt(-1, 1))
      );
      criteriaValues[crit.id] = CRITERION_POINTS[shiftedIdx];
    });

    // Critères de valeur aléatoires mais réalistes
    valueCriteria.forEach((crit, vIdx) => {
      const pool =
        vIdx === 0
          ? [1, 2, 3, 5, 8]
          : [0, 1, 2, 3, 5, 8];
      criteriaValues[crit.id] = pool[randomInt(0, pool.length - 1)];
    });

    const calculatedRoi = calculateProjectRoi(
      criteriaValues,
      criteria,
      true,
      project.bonus ?? null,
      true
    );

    // 3. Calcul des charges par phase RUP et par compétence
    const phaseSkillDays: Record<RupPhase, Record<string, number>> = {
      inception: allocatePhaseDaysToSkills(totalWorkloadDays * RUP_PHASE_WEIGHTS.inception, 'inception', classifiedSkills, includeSap),
      elaboration: allocatePhaseDaysToSkills(totalWorkloadDays * RUP_PHASE_WEIGHTS.elaboration, 'elaboration', classifiedSkills, includeSap),
      construction: allocatePhaseDaysToSkills(totalWorkloadDays * RUP_PHASE_WEIGHTS.construction, 'construction', classifiedSkills, includeSap),
      transition: allocatePhaseDaysToSkills(totalWorkloadDays * RUP_PHASE_WEIGHTS.transition, 'transition', classifiedSkills, includeSap),
    };

    // Budget estimé (K€) aligné sur la charge totale par profil * TJM marché moyen
    let totalCostEur = 0;
    const totalDaysBySkill: Record<string, number> = {};
    classifiedSkills.forEach(({ skill, bucket }) => {
      const skillTotal =
        (phaseSkillDays.inception[skill.id] || 0) +
        (phaseSkillDays.elaboration[skill.id] || 0) +
        (phaseSkillDays.construction[skill.id] || 0) +
        (phaseSkillDays.transition[skill.id] || 0);
      totalDaysBySkill[skill.id] = roundToHalfDay(skillTotal);
      totalCostEur += skillTotal * MARKET_TJM_EUR_BY_BUCKET[bucket];
    });
    const estimatedBudgetKe = Math.max(1, Math.round(totalCostEur / 1000));

    // 4. Placement temporel dans les 12 mois passés (M-11..M0), les 12 mois à venir (M0..M+11) et le RAT
    const capacityHistory: Record<string, Record<string, number>> = {};
    const staffingPlan: Record<string, Record<string, number | null>> = {};
    const remainingToComplete: Record<string, number | null> = {};
    const staffingPlanValidatedMonths: Record<string, boolean> = {};
    const ratHistory: Record<string, Record<string, number>> = {};

    const zeroSkillMap = (): Record<string, number> => {
      const m: Record<string, number> = {};
      skills.forEach((sk) => {
        m[sk.id] = 0;
      });
      return m;
    };

    past12Keys.forEach((k) => {
      capacityHistory[k] = zeroSkillMap();
    });
    future12Keys.forEach((k) => {
      staffingPlan[k] = zeroSkillMap();
    });
    skills.forEach((sk) => {
      remainingToComplete[sk.id] = 0;
    });

    // Helper : répartit un dict { skillId -> days } sur une liste d'offsets relatifs à now (ex: [-2, -1] ou [1, 2, ..., 15])
    // selon une courbe de poids donnée. Retourne les allocations par clé YYYY-MM.
    const schedulePhase = (
      skillDays: Record<string, number>,
      monthOffsets: number[],
      curveWeights: number[],
      targetPast: boolean,
      targetFuture: boolean,
      post12Accum: Record<string, number>
    ) => {
      skills.forEach((sk) => {
        const d = skillDays[sk.id] || 0;
        if (d <= 0) return;
        const perSlot = distributeDaysOverCurve(d, curveWeights);
        monthOffsets.forEach((offset, idx) => {
          const val = perSlot[idx] || 0;
          if (val <= 0) return;
          const mKey = addMonthsKey(now, offset);
          if (targetPast && offset >= -11 && offset <= 0) {
            capacityHistory[mKey][sk.id] = roundToHalfDay((capacityHistory[mKey][sk.id] || 0) + val);
          }
          if (targetFuture) {
            if (offset >= 0 && offset <= 11) {
              staffingPlan[mKey][sk.id] = roundToHalfDay(((staffingPlan[mKey][sk.id] as number) || 0) + val);
            } else if (offset > 11) {
              post12Accum[sk.id] = roundToHalfDay((post12Accum[sk.id] || 0) + val);
            }
          }
        });
      });
    };

    const post12Accum: Record<string, number> = {};
    skills.forEach((sk) => {
      post12Accum[sk.id] = 0;
    });

    let completedMonthsAgo: number | undefined;

    if (category === 'ideation' || category === 'ready_elaboration') {
      // Règle 2.3 : historique sur les 1 à 2 derniers mois seulement (M-1 ou M-2 & M-1)
      const histMonthsCount = randomInt(1, 2);
      const inceptionOffsets = histMonthsCount === 1 ? [-1] : [-2, -1];
      const inceptionCurve = histMonthsCount === 1 ? [1] : [0.45, 0.55];
      schedulePhase(phaseSkillDays.inception, inceptionOffsets, inceptionCurve, true, false, post12Accum);

      // Projection future (Elaboration + Construction + Transition) à partir de M+1 (Prêt pour cadrage) ou M+2 (Idéation)
      const startOffset = category === 'ready_elaboration' ? 1 : 2;
      const elabLen = totalWorkloadDays > 400 ? 3 : 2;
      const constLen = totalWorkloadDays > 800 ? 10 : totalWorkloadDays > 300 ? 8 : totalWorkloadDays > 100 ? 5 : 3;
      const transLen = totalWorkloadDays > 400 ? 2 : 1;

      const elabOffsets = Array.from({ length: elabLen }, (_, i) => startOffset + i);
      const constOffsets = Array.from({ length: constLen }, (_, i) => startOffset + elabLen + i);
      const transOffsets = Array.from({ length: transLen }, (_, i) => startOffset + elabLen + constLen + i);

      schedulePhase(
        phaseSkillDays.elaboration,
        elabOffsets,
        elabOffsets.map((_, i) => i + 1),
        false,
        true,
        post12Accum
      );
      schedulePhase(
        phaseSkillDays.construction,
        constOffsets,
        constOffsets.map((_, i) => Math.sin(((i + 0.5) / constOffsets.length) * Math.PI) + 0.4),
        false,
        true,
        post12Accum
      );
      schedulePhase(
        phaseSkillDays.transition,
        transOffsets,
        transOffsets.map((_, i) => transOffsets.length - i),
        false,
        true,
        post12Accum
      );
    } else if (category === 'elaboration' || category === 'ready_construction') {
      // Cadrage en cours : Inception dans les 2-4 derniers mois + moitié d'Élaboration jusqu'à M0
      const elabDoneRatio = category === 'ready_construction' ? 1.0 : 0.5;
      const pastElab: Record<string, number> = {};
      const futElab: Record<string, number> = {};
      skills.forEach((sk) => {
        const d = phaseSkillDays.elaboration[sk.id] || 0;
        pastElab[sk.id] = roundToHalfDay(d * elabDoneRatio);
        futElab[sk.id] = roundToHalfDay(Math.max(0, d - pastElab[sk.id]));
      });

      schedulePhase(phaseSkillDays.inception, [-4, -3], [0.45, 0.55], true, false, post12Accum);
      schedulePhase(pastElab, [-2, -1, 0], [0.3, 0.35, 0.35], true, false, post12Accum);

      const startOffset = category === 'ready_construction' ? 1 : 1;
      if (elabDoneRatio < 1) {
        schedulePhase(futElab, [0, 1], [0.45, 0.55], false, true, post12Accum);
      }
      const constStart = elabDoneRatio < 1 ? 2 : startOffset;
      const constLen = totalWorkloadDays > 700 ? 10 : totalWorkloadDays > 250 ? 8 : totalWorkloadDays > 80 ? 5 : 3;
      const transLen = totalWorkloadDays > 400 ? 2 : 1;

      const constOffsets = Array.from({ length: constLen }, (_, i) => constStart + i);
      const transOffsets = Array.from({ length: transLen }, (_, i) => constStart + constLen + i);

      schedulePhase(
        phaseSkillDays.construction,
        constOffsets,
        constOffsets.map((_, i) => Math.sin(((i + 0.5) / constOffsets.length) * Math.PI) + 0.4),
        false,
        true,
        post12Accum
      );
      schedulePhase(
        phaseSkillDays.transition,
        transOffsets,
        transOffsets.map((_, i) => transOffsets.length - i),
        false,
        true,
        post12Accum
      );
    } else if (category === 'construction') {
      // En cours de réalisation : Inception + Elaboration + avancement aléatoire (25%-60%) de Construction dans le passé (6-12 mois)
      const constDoneRatio = 0.25 + Math.random() * 0.35;
      const pastConst: Record<string, number> = {};
      const futConst: Record<string, number> = {};
      skills.forEach((sk) => {
        const d = phaseSkillDays.construction[sk.id] || 0;
        pastConst[sk.id] = roundToHalfDay(d * constDoneRatio);
        futConst[sk.id] = roundToHalfDay(Math.max(0, d - pastConst[sk.id]));
      });

      const pastSpan = totalWorkloadDays > 300 ? randomInt(8, 11) : randomInt(5, 8);
      const inceptionOffsets = [-pastSpan, -pastSpan + 1];
      const elabOffsets = [-pastSpan + 2, -pastSpan + 3];
      const pastConstStart = -pastSpan + 4;
      const pastConstOffsets = Array.from(
        { length: Math.max(1, 0 - pastConstStart + 1) },
        (_, i) => pastConstStart + i
      );

      schedulePhase(phaseSkillDays.inception, inceptionOffsets, [0.45, 0.55], true, false, post12Accum);
      schedulePhase(phaseSkillDays.elaboration, elabOffsets, [0.45, 0.55], true, false, post12Accum);
      schedulePhase(
        pastConst,
        pastConstOffsets,
        pastConstOffsets.map((_, i) => 0.6 + (i / Math.max(1, pastConstOffsets.length)) * 0.6),
        true,
        false,
        post12Accum
      );

      // Synchroniser M0 sur staffingPlan pour cohérence du mois courant
      const m0Key = currentMonthKey;
      skills.forEach((sk) => {
        staffingPlan[m0Key][sk.id] = capacityHistory[m0Key][sk.id] || 0;
      });

      // Reste de construction (M+1..) + Transition
      const remConstLen = totalWorkloadDays > 700 ? randomInt(8, 12) : totalWorkloadDays > 250 ? randomInt(5, 9) : randomInt(2, 5);
      const transLen = totalWorkloadDays > 400 ? 2 : 1;
      const futConstOffsets = Array.from({ length: remConstLen }, (_, i) => 1 + i);
      const transOffsets = Array.from({ length: transLen }, (_, i) => 1 + remConstLen + i);

      schedulePhase(
        futConst,
        futConstOffsets,
        futConstOffsets.map((_, i) => Math.max(0.4, 1.2 - (i / Math.max(1, futConstOffsets.length)) * 0.6)),
        false,
        true,
        post12Accum
      );
      schedulePhase(
        phaseSkillDays.transition,
        transOffsets,
        transOffsets.map((_, i) => transOffsets.length - i),
        false,
        true,
        post12Accum
      );
    } else if (category === 'transition') {
      // En cours de déploiement : Inception + Elaboration + Construction dans les 12 derniers mois ; Transition sur M0..M+2
      schedulePhase(phaseSkillDays.inception, [-11, -10], [0.45, 0.55], true, false, post12Accum);
      schedulePhase(phaseSkillDays.elaboration, [-9, -8, -7], [0.3, 0.4, 0.3], true, false, post12Accum);
      schedulePhase(phaseSkillDays.construction, [-6, -5, -4, -3, -2, -1], [0.8, 1.0, 1.2, 1.2, 1.0, 0.8], true, false, post12Accum);

      const pastTrans: Record<string, number> = {};
      const futTrans: Record<string, number> = {};
      skills.forEach((sk) => {
        const d = phaseSkillDays.transition[sk.id] || 0;
        pastTrans[sk.id] = roundToHalfDay(d * 0.35);
        futTrans[sk.id] = roundToHalfDay(Math.max(0, d - pastTrans[sk.id]));
      });
      schedulePhase(pastTrans, [0], [1], true, false, post12Accum);
      // M0 cohérent entre capacityHistory et staffingPlan
      skills.forEach((sk) => {
        staffingPlan[currentMonthKey][sk.id] = capacityHistory[currentMonthKey][sk.id] || 0;
      });
      schedulePhase(futTrans, [1, 2], [0.65, 0.35], false, true, post12Accum);
      // En cours de déploiement finit dans les 12 prochains mois -> post12Accum = 0, RAT = somme(12 mois) strictement
    } else if (category === 'completed') {
      // Règle 2.3 : Terminé il y a 9 mois, 6 mois, 3 mois ou ce mois-ci (0) -> uniquement sur les 12 mois passés, RAT = 0
      const endOffset = -completedOffsetsCycle[completedCounter % completedOffsetsCycle.length];
      completedMonthsAgo = Math.abs(endOffset);
      completedCounter += 1;

      const earliestOffset = -11;
      const availableSpan = endOffset - earliestOffset + 1; // 3 mois (si -9), 6 mois (si -6), 9 mois (si -3), 12 mois (si 0)

      // Construire les tranches de phases dans [earliestOffset .. endOffset]
      const slots = Array.from({ length: availableSpan }, (_, i) => earliestOffset + i);
      if (slots.length <= 3) {
        // Projet terminé il y a 9 mois (fenêtre visible M-11..M-9 = fin de construction + transition)
        schedulePhase(phaseSkillDays.inception, [slots[0]], [1], true, false, post12Accum);
        schedulePhase(phaseSkillDays.elaboration, [slots[0]], [1], true, false, post12Accum);
        schedulePhase(phaseSkillDays.construction, slots.slice(0, Math.max(1, slots.length - 1)), [0.5, 0.5], true, false, post12Accum);
        schedulePhase(phaseSkillDays.transition, [slots[slots.length - 1]], [1], true, false, post12Accum);
      } else {
        const incCount = 1;
        const elabCount = Math.max(1, Math.round(slots.length * 0.2));
        const transCount = Math.max(1, Math.round(slots.length * 0.15));
        const constCount = Math.max(1, slots.length - incCount - elabCount - transCount);

        let cursor = 0;
        const incSlots = slots.slice(cursor, cursor + incCount);
        cursor += incCount;
        const elabSlots = slots.slice(cursor, cursor + elabCount);
        cursor += elabCount;
        const constSlots = slots.slice(cursor, cursor + constCount);
        cursor += constCount;
        const transSlots = slots.slice(cursor);

        schedulePhase(phaseSkillDays.inception, incSlots, incSlots.map(() => 1), true, false, post12Accum);
        schedulePhase(phaseSkillDays.elaboration, elabSlots, elabSlots.map(() => 1), true, false, post12Accum);
        schedulePhase(
          phaseSkillDays.construction,
          constSlots,
          constSlots.map((_, i) => Math.sin(((i + 0.5) / Math.max(1, constSlots.length)) * Math.PI) + 0.4),
          true,
          false,
          post12Accum
        );
        if (transSlots.length > 0) {
          schedulePhase(phaseSkillDays.transition, transSlots, transSlots.map((_, i) => transSlots.length - i), true, false, post12Accum);
        }
      }
      // Terminé -> futur = 0 et RAT = 0
    } else {
      // Abandonné / Reporté : léger cadrage passé sur 2 mois, 0 futur, RAT = 0
      schedulePhase(phaseSkillDays.inception, [-4, -3], [0.5, 0.5], true, false, post12Accum);
    }

    // 5. Calcul du RAT conforme à la règle 2.5 :
    // - Terminé ou Abandonné => RAT = 0
    // - Finit dans les 12 prochains mois (post12Accum == 0) => RAT = sum(12 prochains mois) strictement
    // - Dépasse les 12 prochains mois (post12Accum > 0) => RAT = sum(12 prochains mois) + post12Accum (> sum12)
    let sumPast12mDays = 0;
    let sumNext12mDays = 0;
    let ratDaysTotal = 0;

    past12Keys.forEach((k) => {
      skills.forEach((sk) => {
        sumPast12mDays += capacityHistory[k]?.[sk.id] || 0;
      });
    });

    skills.forEach((sk) => {
      let sum12Skill = 0;
      future12Keys.forEach((k) => {
        sum12Skill += (staffingPlan[k]?.[sk.id] as number) || 0;
      });
      sum12Skill = roundToHalfDay(sum12Skill);
      sumNext12mDays += sum12Skill;

      if (category === 'completed' || category === 'cancelled') {
        remainingToComplete[sk.id] = 0;
      } else {
        const extra = roundToHalfDay(post12Accum[sk.id] || 0);
        const skillRat = roundToHalfDay(sum12Skill + extra);
        remainingToComplete[sk.id] = skillRat;
        ratDaysTotal += skillRat;
      }
    });

    // Synchronisation de capacityDaysPerSkill avec le mois prochain (M+1 = nextMonthKey)
    const capacityDaysPerSkill: Record<string, number> = {};
    skills.forEach((sk) => {
      capacityDaysPerSkill[sk.id] =
        category === 'completed' || category === 'cancelled'
          ? 0
          : roundToHalfDay((staffingPlan[nextMonthKey]?.[sk.id] as number) || 0);
    });

    // Cases à cocher de validation des mois renseignés
    if (category !== 'completed' && category !== 'cancelled') {
      future12Keys.forEach((k) => {
        staffingPlanValidatedMonths[k] = true;
      });
      staffingPlanValidatedMonths['rat'] = true;
    } else {
      staffingPlanValidatedMonths['rat'] = true;
    }

    // Historisation cohérente du RAT passé sur les 12 derniers mois (burn-down)
    past12Keys.forEach((k, idx) => {
      const mRat: Record<string, number> = {};
      skills.forEach((sk) => {
        if (category === 'cancelled') {
          mRat[sk.id] = 0;
          return;
        }
        // Somme des demandes restantes à partir du mois suivant idx + RAT final
        let remAfter = remainingToComplete[sk.id] || 0;
        for (let j = idx + 1; j < past12Keys.length; j++) {
          remAfter += capacityHistory[past12Keys[j]]?.[sk.id] || 0;
        }
        mRat[sk.id] = roundToHalfDay(remAfter);
      });
      ratHistory[k] = mRat;
    });

    const isStaffed =
      stateObj !== undefined
        ? Boolean(stateObj.needsStaffing)
        : category === 'elaboration' || category === 'construction' || category === 'transition';

    await updateDoc(doc(db, projectsColName, project.id), {
      criteriaValues,
      roi: calculatedRoi,
      estimatedBudget: estimatedBudgetKe,
      capacityHistory,
      staffingPlan,
      capacityDaysPerSkill,
      capacityUpdatedMonth:
        category === 'completed' || category === 'cancelled' ? currentMonthKey : nextMonthKey,
      remainingToComplete,
      staffingPlanValidatedMonths,
      isRatValidated: true,
      ratValidatedMonth: currentMonthKey,
      ratHistory,
      isStaffed,
      updatedAt: serverTimestamp(),
    });

    projectResults.push({
      id: project.id,
      projectNumber: project.projectNumber,
      name: project.name,
      stateName: stateName || 'Inconnu',
      category,
      totalWorkloadDays,
      estimatedBudgetKe,
      roi: calculatedRoi,
      hasSap: includeSap,
      sumPast12mDays: roundToHalfDay(sumPast12mDays),
      sumNext12mDays: roundToHalfDay(sumNext12mDays),
      ratDays: roundToHalfDay(ratDaysTotal),
      completedMonthsAgo,
    });
  }

  return {
    updatedCount: projectResults.length,
    primaryCostCriterionName: primaryCostCriterion.name,
    sapProjects: projectResults.filter((p) => p.hasSap).map((p) => `#${p.projectNumber} ${p.name}`),
    projects: projectResults,
  };
}
