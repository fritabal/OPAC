import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  Mail,
  Copy,
  Check,
  X,
  ExternalLink,
  PieChart,
  Crosshair,
  Search,
  Eye,
  Layers,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { Project } from '../types/project';
import { KeySkill } from '../types/skill';
import { Resource } from '../types/resource';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { Criterion } from '../types/criteria';
import { CustomProjectParam } from '../types/customParam';
import { AppUser } from '../types/user';
import { BonusConfig } from '../types/bonus';
import { BUDGET_PALETTE_32 } from '../constants/colors';
import { getWorkingDaysInMonth } from '../utils/workingDays';
import { calculateProjectRoi, formatRoi } from '../utils/roiCalculator';
import { Tooltip } from './Tooltip';
import { ProjectModal } from './ProjectModal';
import {
  TABLE_HEADER_DOUBLE_BOTTOM_CLASS,
  TABLE_HEADER_THEAD_CLASS,
} from '../constants/ui';

// Détection de contraste de couleur pour garantir la lisibilité du texte sur les étiquettes
function getContrastColor(hex: string): 'dark' | 'light' {
  if (!hex || !hex.startsWith('#')) return 'light';
  const cleanHex = hex.replace('#', '');
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map((c) => c + c)
          .join('')
      : cleanHex;
  const r = parseInt(fullHex.slice(0, 2), 16) || 0;
  const g = parseInt(fullHex.slice(2, 4), 16) || 0;
  const b = parseInt(fullHex.slice(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 165 ? 'dark' : 'light';
}

// Assombrir la couleur d'au moins 50% tout en conservant scrupuleusement la teinte exacte (proportions RVB)
function darkenColor(hex: string, amount: number = 0.55): string {
  if (!hex || !hex.startsWith('#')) return '#1e293b';
  const cleanHex = hex.replace('#', '');
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map((c) => c + c)
          .join('')
      : cleanHex;
  const r = parseInt(fullHex.slice(0, 2), 16) || 0;
  const g = parseInt(fullHex.slice(2, 4), 16) || 0;
  const b = parseInt(fullHex.slice(4, 6), 16) || 0;

  // Réduction de luminosité de 55% en maintenant le ratio R:V:B
  const factor = Math.max(0, 1 - amount);
  const darkR = Math.round(r * factor);
  const darkG = Math.round(g * factor);
  const darkB = Math.round(b * factor);

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(darkR)}${toHex(darkG)}${toHex(darkB)}`;
}

// Helpers géométriques pour le tracé SVG du Camembert et du Donut
function getPieSlicePath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const diff = endAngle - startAngle;
  if (diff >= 359.99) {
    return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius} Z`;
  }
  const radStart = (startAngle - 90) * (Math.PI / 180);
  const radEnd = (endAngle - 90) * (Math.PI / 180);

  const x1 = cx + radius * Math.cos(radStart);
  const y1 = cy + radius * Math.sin(radStart);
  const x2 = cx + radius * Math.cos(radEnd);
  const y2 = cy + radius * Math.sin(radEnd);

  const largeArcFlag = diff > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
}

function getDonutSlicePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const diff = endAngle - startAngle;
  if (diff >= 359.99) {
    return `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR} M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`;
  }
  const radStart = (startAngle - 90) * (Math.PI / 180);
  const radEnd = (endAngle - 90) * (Math.PI / 180);

  const xOut1 = cx + outerR * Math.cos(radStart);
  const yOut1 = cy + outerR * Math.sin(radStart);
  const xOut2 = cx + outerR * Math.cos(radEnd);
  const yOut2 = cy + outerR * Math.sin(radEnd);

  const xIn2 = cx + innerR * Math.cos(radEnd);
  const yIn2 = cy + innerR * Math.sin(radEnd);
  const xIn1 = cx + innerR * Math.cos(radStart);
  const yIn1 = cy + innerR * Math.sin(radStart);

  const largeArcFlag = diff > 180 ? 1 : 0;

  return `M ${xOut1} ${yOut1} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${xOut2} ${yOut2} L ${xIn2} ${yIn2} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${xIn1} ${yIn1} Z`;
}

interface ProjectsReportsViewProps {
  projects: Project[];
  skills?: KeySkill[];
  resources?: Resource[];
  projectStates?: ProjectState[];
  budgetLines?: BudgetLine[];
  criteria?: Criterion[];
  customParams?: CustomProjectParam[];
  currentUserEmail?: string;
  showConfidentialProjects?: boolean;
  users?: AppUser[];
  bonusConfig?: BonusConfig;
  onNavigateToCapacityProject?: (projectName: string) => void;
}

export const ProjectsReportsView: React.FC<ProjectsReportsViewProps> = ({
  projects,
  skills = [],
  resources = [],
  projectStates = [],
  budgetLines = [],
  criteria = [],
  customParams = [],
  currentUserEmail = '',
  showConfidentialProjects = false,
  users = [],
  bonusConfig,
  onNavigateToCapacityProject,
}) => {
  // Mois cible de la prochaine période (mois M+1)
  const { nextMonthKey, nextMonthLabel, nextMonthShort, nextMonthYear, nextMonthMonth } = useMemo(() => {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const year = nextDate.getFullYear();
    const month = nextDate.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const monthNames = [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ];
    const monthNamesShort = [
      'Janv.',
      'Févr.',
      'Mars',
      'Avr.',
      'Mai',
      'Juin',
      'Juil.',
      'Août',
      'Sept.',
      'Oct.',
      'Nov.',
      'Déc.',
    ];
    const monthNameCapitalized =
      monthNames[nextDate.getMonth()].charAt(0).toUpperCase() +
      monthNames[nextDate.getMonth()].slice(1);
    return {
      nextMonthKey: key, // ex: "2026-11"
      nextMonthLabel: `${monthNameCapitalized} ${year}`, // ex: "Novembre 2026"
      nextMonthShort: `${monthNamesShort[nextDate.getMonth()]} ${year}`, // ex: "Nov. 2026"
      nextMonthYear: year,
      nextMonthMonth: month,
    };
  }, []);

  // Jours ouvrés du mois cible
  const workingDaysNextMonth = useMemo(() => {
    return getWorkingDaysInMonth(nextMonthYear, nextMonthMonth);
  }, [nextMonthYear, nextMonthMonth]);

  const formatDaysVal = (val: number): string => {
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  };

  const formatAmount = (val: number): string => {
    const rounded = Math.round(val * 10) / 10;
    return Number.isInteger(rounded)
      ? rounded.toLocaleString('fr-FR')
      : rounded.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  // Helper : vérifie si l'état d'un projet a l'attribut « à staffer » à VRAI
  const isProjectStateNeedsStaffing = (stateId?: string): boolean => {
    if (!stateId) return false;
    const s = projectStates.find((st) => st.id === stateId);
    return Boolean(s?.needsStaffing);
  };

  const isProjectStaffed = (p: Project): boolean => {
    if (typeof p.isStaffed === 'boolean') {
      return p.isStaffed;
    }
    return isProjectStateNeedsStaffing(p.stateId);
  };

  // Règle métier stricte pour l'indicateur 1 :
  // "Dans les deux cas, ne considérer que les projets dont l'indicateur à staffer est à vrai,
  // indépendamment de l'état desdits projets."
  const staffedProjects = useMemo(() => {
    return projects.filter((p) => p.isStaffed === true);
  }, [projects]);

  // Projets dont les demandes de compétence n'ont pas été mises à jour pour la prochaine période
  const notUpdatedStaffedProjects = useMemo(() => {
    return staffedProjects.filter((p) => {
      const m = p.capacityUpdatedMonth;
      return !m || m < nextMonthKey;
    });
  }, [staffedProjects, nextMonthKey]);

  const totalStaffedCount = staffedProjects.length;
  const notUpdatedCount = notUpdatedStaffedProjects.length;

  // Tri des projets selon leur ordre strict de priorité pour le calcul des goulets :
  // Les projets staffés sont ordonnés par priorité (du n°1 au dernier, ROI décroissant)
  const prioritizedStaffedProjects = useMemo(() => {
    const list = projects
      .filter((p) => isProjectStaffed(p))
      .map((p) => {
        const roi = calculateProjectRoi(
          p.criteriaValues,
          criteria,
          true,
          p.bonus,
          bonusConfig?.isBonusActive ?? true
        );
        return {
          project: p,
          roi,
          projectNumber: p.projectNumber || 0,
        };
      });

    list.sort((a, b) => {
      if (a.roi === null && b.roi === null) return a.projectNumber - b.projectNumber;
      if (a.roi === null) return 1;
      if (b.roi === null) return -1;
      const diff = b.roi - a.roi;
      if (diff !== 0) return diff;
      return a.projectNumber - b.projectNumber;
    });

    return list.map((item) => item.project);
  }, [projects, criteria, bonusConfig, projectStates]);

  interface BottleneckSkill {
    skillId: string;
    skillName: string;
    capacity: number;
    totalDemand: number;
    missingDays: number;
    blockedProjectsCount: number;
    blockedProjects: Project[];
  }

  // Calcul des goulets d'étranglement parmi les compétences clés :
  // Nombre de compétences clés en déficit de capacité par rapport aux demandes (Demande > Capacité)
  const bottleneckSkills = useMemo(() => {
    // 1. Capacité C par compétence sur le mois prochain
    const capacityMap: Record<string, number> = {};
    skills.forEach((skill) => {
      let c = 0;
      resources.forEach((res) => {
        if (res.skillId === skill.id) {
          const fte = typeof res.fte === 'number' && !isNaN(res.fte) ? res.fte : 1.0;
          const unavail =
            res.unavailability && typeof res.unavailability[nextMonthKey] === 'number'
              ? res.unavailability[nextMonthKey]
              : 0;
          const avail = workingDaysNextMonth * fte - unavail;
          c += Math.max(0, avail);
        }
      });
      capacityMap[skill.id] = Math.round(c * 10) / 10;
    });

    // 2. Pour chaque compétence clé, demande cumulée dans l'ordre strict de priorité et calcul du déficit
    const bottlenecks: BottleneckSkill[] = [];

    skills.forEach((skill) => {
      const C = capacityMap[skill.id] ?? 0;
      let cumulativeUsed = 0;
      let totalDemand = 0;
      const blockedProjs: Project[] = [];

      prioritizedStaffedProjects.forEach((proj) => {
        const daysVal = proj.capacityDaysPerSkill?.[skill.id];
        const days = typeof daysVal === 'number' ? daysVal : parseFloat(String(daysVal || '0'));
        if (isNaN(days) || days <= 0) return;

        const requested = Math.round(days * 10) / 10;
        totalDemand += requested;
        const totalWithCurrent = Math.round((cumulativeUsed + requested) * 10) / 10;

        if (totalWithCurrent > C) {
          blockedProjs.push(proj);
        }
        cumulativeUsed = totalWithCurrent;
      });

      totalDemand = Math.round(totalDemand * 10) / 10;
      const missingDays = Math.round((totalDemand - C) * 10) / 10;

      // Un goulet d'étranglement est une compétence en déficit de capacité par rapport aux demandes (D > C)
      if (missingDays > 0) {
        bottlenecks.push({
          skillId: skill.id,
          skillName: skill.name,
          capacity: C,
          totalDemand,
          missingDays,
          blockedProjectsCount: blockedProjs.length,
          blockedProjects: blockedProjs,
        });
      }
    });

    // Tri par nombre de jours manquants décroissant, puis par nombre de projets bloqués décroissant
    bottlenecks.sort((a, b) => {
      const diffMissing = b.missingDays - a.missingDays;
      if (diffMissing !== 0) return diffMissing;
      return b.blockedProjectsCount - a.blockedProjectsCount;
    });

    return bottlenecks;
  }, [skills, resources, nextMonthKey, workingDaysNextMonth, prioritizedStaffedProjects]);

  // État du filtre pour l'indicateur budgétaire : Tous les projets vs Projets staffés uniquement
  const [budgetScopeStaffedOnly, setBudgetScopeStaffedOnly] = useState(false);

  // Ligne budgétaire survolée pour interaction synchrone graphique & tableau
  const [hoveredBudgetLineId, setHoveredBudgetLineId] = useState<string | null>(null);

  interface BudgetDistributionItem {
    id: string;
    name: string;
    color: string;
    wishedKe: number;
    wishedPct: number;
    realKe: number;
    realPct: number;
    deltaKe: number;
    deltaPct: number;
    projectCount: number;
    projects: Project[];
    isUnassigned?: boolean;
    startAngle?: number;
    endAngle?: number;
  }

  // Calcul des répartitions budgétaires (imposée/souhaitée vs réelle sur les projets)
  const budgetDistributionData = useMemo(() => {
    // 1. Filtrage des projets selon le scope sélectionné
    const relevantProjects = projects.filter((p) => {
      if (budgetScopeStaffedOnly) {
        return isProjectStaffed(p);
      }
      return true;
    });

    // 2. Lignes budgétaires actives
    const lines = (budgetLines || [])
      .filter((l) => l.isActive !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Budget total souhaité (imposé sur les lignes budgétaires)
    const totalWished = lines.reduce((sum, l) => sum + (Number(l.budgetKe) || 0), 0);

    // Calcul du budget réel par ligne
    const realByLineId: Record<
      string,
      { totalKe: number; projectCount: number; projects: Project[] }
    > = {};
    lines.forEach((l) => {
      realByLineId[l.id] = { totalKe: 0, projectCount: 0, projects: [] };
    });

    let unassignedRealKe = 0;
    const unassignedProjects: Project[] = [];

    relevantProjects.forEach((p) => {
      const budget = Number(p.estimatedBudget) || 0;
      if (p.budgetLineId && realByLineId[p.budgetLineId]) {
        realByLineId[p.budgetLineId].totalKe += budget;
        realByLineId[p.budgetLineId].projectCount += 1;
        realByLineId[p.budgetLineId].projects.push(p);
      } else if (budget > 0) {
        unassignedRealKe += budget;
        unassignedProjects.push(p);
      }
    });

    const totalReal =
      lines.reduce((sum, l) => sum + (realByLineId[l.id]?.totalKe || 0), 0) + unassignedRealKe;

    const items: BudgetDistributionItem[] = lines.map((line, idx) => {
      const wishedKe = Number(line.budgetKe) || 0;
      const wishedPct = totalWished > 0 ? (wishedKe / totalWished) * 100 : 0;

      const realKe = realByLineId[line.id]?.totalKe || 0;
      const realPct = totalReal > 0 ? (realKe / totalReal) * 100 : 0;

      const deltaKe = realKe - wishedKe;
      const deltaPct = realPct - wishedPct;

      const color = line.color || BUDGET_PALETTE_32[idx % BUDGET_PALETTE_32.length].hex;

      return {
        id: line.id,
        name: line.name,
        color,
        wishedKe,
        wishedPct,
        realKe,
        realPct,
        deltaKe,
        deltaPct,
        projectCount: realByLineId[line.id]?.projectCount || 0,
        projects: realByLineId[line.id]?.projects || [],
      };
    });

    // Ligne virtuelle si projets avec budget sans ligne assignée
    if (unassignedRealKe > 0) {
      const realPct = totalReal > 0 ? (unassignedRealKe / totalReal) * 100 : 0;
      items.push({
        id: 'unassigned',
        name: 'Non assigné',
        color: '#94a3b8',
        wishedKe: 0,
        wishedPct: 0,
        realKe: unassignedRealKe,
        realPct,
        deltaKe: unassignedRealKe,
        deltaPct: realPct,
        projectCount: unassignedProjects.length,
        projects: unassignedProjects,
        isUnassigned: true,
      });
    }

    // Calcul des tranches angulaires pour le Donut Souhaité (répartition imposée)
    let currentWishedAngle = 0;
    const wishedSlices = items
      .filter((item) => item.wishedKe > 0)
      .map((item) => {
        const angleSize = totalWished > 0 ? (item.wishedKe / totalWished) * 360 : 0;
        const startAngle = currentWishedAngle;
        const endAngle = currentWishedAngle + angleSize;
        currentWishedAngle = endAngle;
        return {
          ...item,
          startAngle,
          endAngle,
        };
      });

    // Calcul des tranches angulaires pour le Camembert Réel (répartition réelle des projets)
    let currentRealAngle = 0;
    const realSlices = items
      .filter((item) => item.realKe > 0)
      .map((item) => {
        const angleSize = totalReal > 0 ? (item.realKe / totalReal) * 360 : 0;
        const startAngle = currentRealAngle;
        const endAngle = currentRealAngle + angleSize;
        currentRealAngle = endAngle;
        return {
          ...item,
          startAngle,
          endAngle,
        };
      });

    return {
      items,
      wishedSlices,
      realSlices,
      totalWished,
      totalReal,
      relevantProjectsCount: relevantProjects.length,
    };
  }, [projects, budgetLines, budgetScopeStaffedOnly, projectStates]);

  interface PlacedLabelItem extends BudgetDistributionItem {
    xAnchor: number;
    yAnchor: number;
    xElbow: number;
    yElbow: number;
    midAngle: number;
    isRight: boolean;
    targetY: number;
    soitText: string;
    hasReal: boolean;
  }

  // Calcul du positionnement des étiquettes d'information avec anti-collision et ligne de rappel ("pied")
  const labeledItems = useMemo<PlacedLabelItem[]>(() => {
    const visible = budgetDistributionData.items.filter(
      (it) => it.realKe > 0 || it.wishedKe > 0
    );

    const cx = 500;
    const cy = 300;
    const pieR = 128;
    const donutOuterR = 160;
    const donutInnerR = 128;
    const rAnchorPie = pieR * 0.58;
    const rAnchorDonut = (donutInnerR + donutOuterR) / 2;
    const rElbow = donutOuterR + 25;

    const mapped: PlacedLabelItem[] = visible.map((item) => {
      const realSlice = budgetDistributionData.realSlices.find((s) => s.id === item.id);
      const wishedSlice = budgetDistributionData.wishedSlices.find((s) => s.id === item.id);

      const hasReal = Boolean(realSlice && item.realKe > 0);
      const midAngle = hasReal
        ? (realSlice!.startAngle + realSlice!.endAngle) / 2
        : wishedSlice
        ? (wishedSlice.startAngle + wishedSlice.endAngle) / 2
        : 0;

      const rad = (midAngle - 90) * (Math.PI / 180);
      const rAnchor = hasReal ? rAnchorPie : rAnchorDonut;

      const xAnchor = cx + rAnchor * Math.cos(rad);
      const yAnchor = cy + rAnchor * Math.sin(rad);

      const xElbow = cx + rElbow * Math.cos(rad);
      const yElbow = cy + rElbow * Math.sin(rad);

      const isRight = Math.cos(rad) >= 0;

      const deltaPct = item.realPct - item.wishedPct;
      let soitText = '(soit 0.0 %)';
      if (deltaPct > 0) {
        soitText = `(soit + ${deltaPct.toFixed(1)} %)`;
      } else if (deltaPct < 0) {
        soitText = `(soit - ${Math.abs(deltaPct).toFixed(1)} %)`;
      }

      return {
        ...item,
        xAnchor,
        yAnchor,
        xElbow,
        yElbow,
        midAngle,
        isRight,
        targetY: yElbow - 44,
        soitText,
        hasReal,
      };
    });

    // Séparation gauche et droite pour l'anti-collision verticale
    const rightItems = mapped.filter((it) => it.isRight).sort((a, b) => a.yElbow - b.yElbow);
    const leftItems = mapped.filter((it) => !it.isRight).sort((a, b) => a.yElbow - b.yElbow);

    const cardH = 88;
    const gap = 12;

    const layoutSide = (list: PlacedLabelItem[]) => {
      if (list.length === 0) return;
      // 1. Placement vers le bas
      let curY = 30;
      for (const it of list) {
        const ideal = Math.max(30, Math.min(600 - 30 - cardH, it.yElbow - cardH / 2));
        it.targetY = Math.max(ideal, curY);
        curY = it.targetY + cardH + gap;
      }
      // 2. Correction si dépassement en bas
      const maxY = 600 - 30 - cardH;
      if (curY - gap > maxY) {
        let overflow = (curY - gap) - maxY;
        for (let i = list.length - 1; i >= 0; i--) {
          list[i].targetY -= overflow;
          if (i > 0) {
            const neededY = list[i - 1].targetY + cardH + gap;
            if (list[i].targetY < neededY) {
              overflow = neededY - list[i].targetY;
            } else {
              overflow = 0;
            }
          }
        }
      }
      // 3. Recentrage doux si les étiquettes occupent moins de hauteur
      const minTop = list[0].targetY;
      const maxBottom = list[list.length - 1].targetY + cardH;
      const totalSpan = maxBottom - minTop;
      if (totalSpan < 500) {
        const avgNatural = list.reduce((sum, it) => sum + it.yElbow, 0) / list.length;
        const currentCenter = (minTop + maxBottom) / 2;
        const shift = avgNatural - currentCenter;
        const clampedShift = Math.max(
          25 - minTop,
          Math.min(600 - 25 - maxBottom, shift)
        );
        list.forEach((it) => {
          it.targetY += clampedShift;
        });
      }
    };

    layoutSide(rightItems);
    layoutSide(leftItems);

    return [...rightItems, ...leftItems];
  }, [budgetDistributionData]);

  // Résolution du nom complet du chef de projet
  const getUserName = (email: string) => {
    if (!email) return 'Non assigné';
    const cleanEmail = email.trim().toLowerCase();
    const u = users.find((usr) => usr.email.toLowerCase() === cleanEmail);
    return u?.displayName || email;
  };

  // Regroupement par chef de projet incriminé
  interface IncriminatedPm {
    email: string;
    name: string;
    notUpdatedProjects: Project[];
    allPilotedStaffedProjects: Project[];
  }

  const incriminatedPms = useMemo(() => {
    const pmsMap = new Map<string, { notUpdated: Project[]; all: Project[] }>();

    staffedProjects.forEach((p) => {
      const pmEmail = (p.projectManagerEmail || '').trim().toLowerCase();
      if (!pmEmail) return;

      if (!pmsMap.has(pmEmail)) {
        pmsMap.set(pmEmail, { notUpdated: [], all: [] });
      }
      const entry = pmsMap.get(pmEmail)!;
      entry.all.push(p);

      const m = p.capacityUpdatedMonth;
      const isNotUpdated = !m || m < nextMonthKey;
      if (isNotUpdated) {
        entry.notUpdated.push(p);
      }
    });

    const result: IncriminatedPm[] = [];
    pmsMap.forEach((entry, email) => {
      if (entry.notUpdated.length > 0) {
        result.push({
          email,
          name: getUserName(email),
          notUpdatedProjects: entry.notUpdated.sort(
            (a, b) => (a.projectNumber || 0) - (b.projectNumber || 0)
          ),
          allPilotedStaffedProjects: entry.all.sort(
            (a, b) => (a.projectNumber || 0) - (b.projectNumber || 0)
          ),
        });
      }
    });

    // Tri par nombre de projets non mis à jour décroissant, puis par nom
    result.sort((a, b) => {
      const diff = b.notUpdatedProjects.length - a.notUpdatedProjects.length;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'fr');
    });

    return result;
  }, [staffedProjects, nextMonthKey, users]);

  // État de la fenêtre modale de confirmation / prévisualisation de l'email
  const [emailModal, setEmailModal] = useState<{
    isOpen: boolean;
    recipients: string[];
    recipientLabel: string;
    subject: string;
    body: string;
  } | null>(null);

  const [copiedText, setCopiedText] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);

  // Déclenchement de l'envoi d'email
  const triggerEmail = (
    recipients: string[],
    subject: string,
    body: string,
    recipientLabel: string
  ) => {
    const to = recipients.join(',');
    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // Ouverture automatique du client de messagerie
    try {
      const link = document.createElement('a');
      link.href = mailtoUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (e) {
      console.warn('Mailto link click failed:', e);
    }

    // Affichage simultané de la fenêtre modale avec prévisualisation et options de copie
    setEmailModal({
      isOpen: true,
      recipients,
      recipientLabel,
      subject,
      body,
    });
    setCopiedText(false);
    setCopiedEmails(false);
  };

  // Envoi individuel à un chef de projet
  const handleSendEmailToOnePm = (pm: IncriminatedPm) => {
    const projectListStr = pm.notUpdatedProjects
      .map((p) => `• Projet #${p.projectNumber} ${p.name}`)
      .join('\n');

    const subject = `Demande de mise à jour des compétences clé requises pour ${nextMonthLabel}`;
    const body = `Bonjour ${pm.name},

Sauf erreur de notre part, les demandes de compétences clés nécessaires pour la prochaine période (${nextMonthLabel}) n'ont pas encore été renseignées pour le(s) projet(s) staffé(s) suivant(s) dont vous avez la responsabilité :

${projectListStr}

Merci de bien vouloir vous connecter à l'application et actualiser vos prévisions de compétences clés dans l'onglet Capacitaire.

Lien d'accès à l'application : ${window.location.origin}

Cordialement,
Le PMO / Value Management Office`;

    triggerEmail([pm.email], subject, body, pm.name);
  };

  // Envoi groupé à tous les chefs de projet concernés (clic sur l'enveloppe de l'en-tête de colonne)
  const handleSendEmailToAllPms = () => {
    if (incriminatedPms.length === 0) return;

    const allEmails = Array.from(new Set(incriminatedPms.map((pm) => pm.email)));
    const subject = `Rappel : Demande de mise à jour des compétences clés nécessaires pour - ${nextMonthLabel}`;

    const recapStr = incriminatedPms
      .map((pm) => {
        const projs = pm.notUpdatedProjects
          .map((p) => `  - #${p.projectNumber} ${p.name}`)
          .join('\n');
        return `• ${pm.name} (${pm.notUpdatedProjects.length} projet(s) en attente) :\n${projs}`;
      })
      .join('\n\n');

    const body = `Bonjour,

Nous constatons que certains projets staffés n'ont pas encore exprimé leurs demandes de compétences clés nécessaires pour la prochaine période (${nextMonthLabel}).

Récapitulatif des projets en attente de mise à jour :
${recapStr}

Merci à chaque chef de projet concerné de bien vouloir actualiser ses besoins en compétences clés dans l'onglet Capacitaire de l'application.

Lien d'accès à l'application : ${window.location.origin}

Cordialement,
Le PMO / Value Management Office`;

    triggerEmail(
      allEmails,
      subject,
      body,
      `Tous les chefs de projet concernés (${allEmails.length})`
    );
  };

  const handleCopyText = async () => {
    if (!emailModal) return;
    try {
      await navigator.clipboard.writeText(emailModal.body);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      console.error('Erreur lors de la copie du texte:', err);
    }
  };

  const handleCopyEmails = async () => {
    if (!emailModal) return;
    try {
      await navigator.clipboard.writeText(emailModal.recipients.join(', '));
      setCopiedEmails(true);
      setTimeout(() => setCopiedEmails(false), 2500);
    } catch (err) {
      console.error('Erreur lors de la copie des emails:', err);
    }
  };

  // ========================================================
  // MATRICE COÛT x VALEUR : ÉTATS & CALCULS
  // ========================================================
  const [matrixScopeStaffedOnly, setMatrixScopeStaffedOnly] = useState<boolean>(false);
  const [matrixSelectedBudgetLineId, setMatrixSelectedBudgetLineId] = useState<string | null>(null);
  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>('');
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<Project | null>(null);
  const [confidentialAlertOpen, setConfidentialAlertOpen] = useState<boolean>(false);
  const [hoveredMatrixProject, setHoveredMatrixProject] = useState<{
    project: Project;
    costScore: number;
    valueScore: number;
    roi: number | null;
    priority: number | null;
    color: string;
    stateName: string;
    x: number;
    y: number;
  } | null>(null);

  // 1. Critères de coût et de valeur (actifs de préférence)
  const costCriteria = useMemo(() => {
    const active = criteria.filter((c) => c.type === 'COÛT' && c.isActive !== false);
    return active.length > 0 ? active : criteria.filter((c) => c.type === 'COÛT');
  }, [criteria]);

  const valueCriteria = useMemo(() => {
    const active = criteria.filter((c) => c.type === 'VALEUR' && c.isActive !== false);
    return active.length > 0 ? active : criteria.filter((c) => c.type === 'VALEUR');
  }, [criteria]);

  // 2. Abscisse max : somme sur tous les critères de coût de ( 8 x poids du critère )
  const maxCost = useMemo(() => {
    const sum = costCriteria.reduce((acc, c) => acc + 8 * (Number(c.weight) || 1), 0);
    return sum > 0 ? sum : 8;
  }, [costCriteria]);

  // 3. Ordonnée max : somme sur tous les critères de valeur de ( 8 x poids du critère )
  const maxValue = useMemo(() => {
    const sum = valueCriteria.reduce((acc, c) => acc + 8 * (Number(c.weight) || 1), 0);
    return sum > 0 ? sum : 8;
  }, [valueCriteria]);

  // Dimensions géométriques de la matrice SVG
  const matrixSvgWidth = 960;
  const matrixSvgHeight = 600;
  const matrixMarginLeft = 75;
  const matrixMarginRight = 45;
  const matrixMarginTop = 40;
  const matrixMarginBottom = 65;
  const matrixPlotW = matrixSvgWidth - matrixMarginLeft - matrixMarginRight; // 840
  const matrixPlotH = matrixSvgHeight - matrixMarginTop - matrixMarginBottom; // 495

  const matrixOriginX = matrixMarginLeft; // 75
  const matrixOriginY = matrixMarginTop + matrixPlotH; // 535
  const matrixMidX = matrixOriginX + matrixPlotW / 2; // 495
  const matrixMidY = matrixMarginTop + matrixPlotH / 2; // 287.5

  // 4. Calcul des projets positionnés
  const matrixPlotData = useMemo(() => {
    const list = matrixScopeStaffedOnly ? staffedProjects : projects;

    // Regrouper par coordonnées identiques (costScore_valueScore) pour disperser les pastilles superposées
    const groups: Record<string, Project[]> = {};
    const itemMap = new Map<string, { costScore: number; valueScore: number; roi: number | null }>();

    list.forEach((p) => {
      let costScore = 0;
      for (const c of costCriteria) {
        const val = p.criteriaValues?.[c.id] ?? 0;
        costScore += val * (Number(c.weight) || 1);
      }

      let valueScore = 0;
      for (const c of valueCriteria) {
        const val = p.criteriaValues?.[c.id] ?? 0;
        valueScore += val * (Number(c.weight) || 1);
      }

      const roi = calculateProjectRoi(
        p.criteriaValues,
        criteria,
        true,
        p.bonus,
        bonusConfig?.isBonusActive ?? true
      );

      itemMap.set(p.id, { costScore, valueScore, roi });

      const coordKey = `${costScore}_${valueScore}`;
      if (!groups[coordKey]) groups[coordKey] = [];
      groups[coordKey].push(p);
    });

    // Calcul de la priorité (1 = plus prioritaire, classé par ROI décroissant puis # croissant)
    const withRoi = list
      .map((p) => {
        const item = itemMap.get(p.id)!;
        return {
          id: p.id,
          roi: item.roi,
          projectNumber: p.projectNumber || 0,
        };
      })
      .filter((item): item is { id: string; roi: number; projectNumber: number } => item.roi !== null);

    withRoi.sort((a, b) => {
      const diff = b.roi - a.roi;
      if (diff !== 0) return diff;
      return a.projectNumber - b.projectNumber;
    });

    const priorityRankMap = new Map<string, number>();
    withRoi.forEach((item, index) => {
      priorityRankMap.set(item.id, index + 1);
    });

    const placedItems = list.map((p) => {
      const { costScore, valueScore, roi } = itemMap.get(p.id)!;
      const priority = priorityRankMap.get(p.id) ?? null;
      const coordKey = `${costScore}_${valueScore}`;
      const group = groups[coordKey] || [p];
      const indexInGroup = group.findIndex((item) => item.id === p.id);
      const groupSize = group.length;

      // Base X & Base Y (origine 0,0 en bas à gauche)
      const baseX = matrixOriginX + (costScore / maxCost) * matrixPlotW;
      const baseY = matrixOriginY - (valueScore / maxValue) * matrixPlotH;

      let x = baseX;
      let y = baseY;

      if (groupSize > 1) {
        const angle = (indexInGroup / groupSize) * 2 * Math.PI - Math.PI / 2;
        const radius = groupSize <= 3 ? 13 : groupSize <= 6 ? 18 : 24;
        x = baseX + Math.cos(angle) * radius;
        y = baseY + Math.sin(angle) * radius;
      }

      // Clamping pour rester à l'intérieur de la zone de tracé
      x = Math.max(matrixOriginX + 16, Math.min(matrixOriginX + matrixPlotW - 16, x));
      y = Math.max(matrixMarginTop + 16, Math.min(matrixOriginY - 16, y));

      const bl = budgetLines.find((b) => b.id === p.budgetLineId);
      const color = bl?.color || '#64748b';
      const budgetLineName = bl?.name || 'Sans ligne budgétaire';
      const stateObj = projectStates.find((s) => s.id === p.stateId);
      const stateName = stateObj?.name || p.stateName || 'Non défini';

      const matchesSearch =
        matrixSearchQuery.trim() === '' ||
        p.name.toLowerCase().includes(matrixSearchQuery.toLowerCase()) ||
        String(p.projectNumber).includes(matrixSearchQuery.trim()) ||
        (priority !== null && String(priority) === matrixSearchQuery.trim());

      const matchesBudgetLine =
        !matrixSelectedBudgetLineId || p.budgetLineId === matrixSelectedBudgetLineId;

      const isHighlighted = matchesSearch && matchesBudgetLine;

      return {
        project: p,
        costScore,
        valueScore,
        roi,
        priority,
        baseX,
        baseY,
        x,
        y,
        color,
        budgetLineName,
        stateName,
        isHighlighted,
        groupSize,
      };
    });

    // Tri pour l'ordre d'affichage SVG : du moins prioritaire au plus prioritaire
    // Ainsi, le plus prioritaire (priorité 1) est peint en dernier et se retrouve au premier plan
    placedItems.sort((a, b) => {
      // Projets sans priorité (null) en premier (fond)
      if (a.priority === null && b.priority === null) {
        return (b.project.projectNumber || 0) - (a.project.projectNumber || 0);
      }
      if (a.priority === null) return -1;
      if (b.priority === null) return 1;

      // Du plus grand numéro de priorité (le moins prioritaire, ex: 25)
      // au plus petit numéro (le plus prioritaire, ex: 1)
      return b.priority - a.priority;
    });

    return placedItems;
  }, [
    projects,
    matrixScopeStaffedOnly,
    projectStates,
    costCriteria,
    valueCriteria,
    maxCost,
    maxValue,
    matrixPlotW,
    matrixPlotH,
    matrixOriginX,
    matrixOriginY,
    matrixMarginTop,
    budgetLines,
    matrixSearchQuery,
    matrixSelectedBudgetLineId,
    criteria,
    bonusConfig,
  ]);

  // Graduations pour l'axe X (Coût)
  const costTicks = useMemo(() => {
    const raw = [
      0,
      Math.round(maxCost * 0.25 * 10) / 10,
      Math.round(maxCost * 0.5 * 10) / 10,
      Math.round(maxCost * 0.75 * 10) / 10,
      maxCost,
    ];
    return Array.from(new Set(raw));
  }, [maxCost]);

  // Graduations pour l'axe Y (Valeur)
  const valueTicks = useMemo(() => {
    const raw = [
      0,
      Math.round(maxValue * 0.25 * 10) / 10,
      Math.round(maxValue * 0.5 * 10) / 10,
      Math.round(maxValue * 0.75 * 10) / 10,
      maxValue,
    ];
    return Array.from(new Set(raw));
  }, [maxValue]);

  return (
    <div className="space-y-6">
      {/* En-tête de la section Rapports */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-slate-700 shrink-0" />
            <span>Rapports & Indicateurs de gouvernance</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Tableau de bord de suivi du portefeuille et relance des chefs de projet.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Prochaine période : <strong className="text-slate-900">{nextMonthLabel}</strong></span>
          </span>
        </div>
      </div>

      {/* Grille des indicateurs : encarts de même taille (largeur et hauteur) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* ======================================================== */}
        {/* ENCART INDICATEUR 1 : Projets non à jour (style selon croquis) */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 flex flex-col justify-between space-y-5 h-full">
          {/* En-tête de l'indicateur selon le croquis */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Grand chiffre (rouge comme sur le croquis) */}
              <span
                className={`text-5xl sm:text-6xl font-black font-mono leading-none tracking-tight ${
                  notUpdatedCount > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {notUpdatedCount}
              </span>

              {/* Libellés empilés sur 2 lignes */}
              <div className="flex flex-col justify-center leading-tight">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base sm:text-lg font-bold text-[#e7000b]">
                    projet{notUpdatedCount > 1 ? 's' : ''} non à jour
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">
                    de {notUpdatedCount > 1 ? 'leurs' : 'ses'} demandes pour
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs shrink-0">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{nextMonthShort}</span>
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
                  / {totalStaffedCount} projet{totalStaffedCount > 1 ? 's' : ''} au total
                </span>
              </div>
            </div>
          </div>

          {/* Tableau intégré dans l'encart (Colonnes : CdP | # | Projets | ✉) */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50 flex-1 flex flex-col min-h-[220px]">
            {incriminatedPms.length === 0 ? (
              <div className="p-8 text-center space-y-2 my-auto">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h5 className="text-xs font-bold text-slate-900">
                  Tous les projets staffés sont à jour pour {nextMonthShort} !
                </h5>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Aucun chef de projet incriminé pour cette période.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[280px] flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`${TABLE_HEADER_THEAD_CLASS} sticky top-0 z-10 bg-slate-100`}>
                    <tr>
                      {/* Colonne 1 : CdP */}
                      <th
                        scope="col"
                        className={`py-2.5 px-3 text-left align-middle font-bold text-slate-700 border-r border-slate-200 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS} w-[130px]`}
                        title="Chef de Projet"
                      >
                        CdP
                      </th>

                      {/* Colonne 2 : # */}
                      <th
                        scope="col"
                        className={`py-2.5 px-2 text-center align-middle font-bold text-slate-700 border-r border-slate-200 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS} w-[45px]`}
                        title="Nombre de projets non mis à jour"
                      >
                        #
                      </th>

                      {/* Colonne 3 : Projets */}
                      <th
                        scope="col"
                        className={`py-2.5 px-3 text-left align-middle font-bold text-slate-700 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS}`}
                        title="Projets non mis à jour"
                      >
                        Projets
                      </th>

                      {/* Colonne 4 : Enveloppe action avec bulle d'information (sans boîte, comme les autres pictogrammes d'action) */}
                      <th
                        scope="col"
                        className={`py-2 px-2 text-center align-middle w-[45px] border-l border-slate-200 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS}`}
                      >
                        <div className="flex items-center justify-center">
                          <Tooltip
                            placement="top"
                            content="Envoyer un email de demande de mise à jour à tous les chefs de projet concernés"
                          >
                            <button
                              type="button"
                              onClick={handleSendEmailToAllPms}
                              aria-label="Envoyer un email de demande de mise à jour à tous les chefs de projet concerné"
                              className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {incriminatedPms.map((pm) => (
                      <tr
                        key={pm.email}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Colonne 1 : CdP */}
                        <td className="py-2.5 px-3 align-middle border-r border-slate-200">
                          <div
                            className="font-bold text-xs text-slate-900 truncate"
                            title={`${pm.name} (${pm.email})`}
                          >
                            {pm.name}
                          </div>
                          <div
                            className="text-[10px] text-slate-400 font-mono truncate"
                            title={pm.email}
                          >
                            {pm.email}
                          </div>
                        </td>

                        {/* Colonne 2 : # */}
                        <td className="py-2.5 px-2 text-center align-middle font-mono font-bold text-xs text-red-600 border-r border-slate-200">
                          {pm.notUpdatedProjects.length}
                        </td>

                        {/* Colonne 3 : Projets (bulles roses cliquables pour naviguer vers l'onglet capacitaire avec filtre) */}
                        <td className="py-2.5 px-3 align-middle">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {pm.notUpdatedProjects.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => onNavigateToCapacityProject?.(p.name)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:text-rose-900 hover:border-rose-300 font-mono shadow-2xs transition-all cursor-pointer text-left"
                                title={`Cliquer pour filtrer et afficher le projet "${p.name}" dans l'onglet Capacitaire`}
                              >
                                <span className="font-bold">#{p.projectNumber}</span>
                                <span className="font-sans font-medium">{p.name}</span>
                              </button>
                            ))}
                          </div>
                        </td>

                        {/* Colonne 4 : Action individuelle (sans boîte, comme les autres pictogrammes d'action) */}
                        <td className="py-2 px-2 text-center align-middle border-l border-slate-200">
                          <div className="flex items-center justify-center">
                            <Tooltip
                              placement="top"
                              content={`Envoyer un email de demande de mise à jour à ${pm.name}`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSendEmailToOnePm(pm)}
                                aria-label={`Envoyer un email de demande de mise à jour à ${pm.name}`}
                                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* ENCART INDICATEUR 2 : Goulets d'étranglement parmi les compétences clés */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 flex flex-col justify-between space-y-5 h-full">
          {/* En-tête de l'indicateur selon le croquis */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Grand chiffre (rouge si > 0, vert si 0) */}
              <span
                className={`text-5xl sm:text-6xl font-black font-mono leading-none tracking-tight ${
                  bottleneckSkills.length > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {bottleneckSkills.length}
              </span>

              {/* Libellés empilés sur 2 lignes selon la consigne */}
              <div className="flex flex-col justify-center leading-tight">
                {/* Ligne 1 : compétences clés (gris et plus petit) */}
                <span className="text-xs sm:text-sm font-semibold text-slate-500">
                  compétence{bottleneckSkills.length > 1 ? 's' : ''} clé{bottleneckSkills.length > 1 ? 's' : ''}
                </span>

                {/* Ligne 2 : goulets d'étranglement (gros et rouge) + "pour " en gris clair + badge de période */}
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="text-base sm:text-lg font-bold text-[#e7000b]">
                    goulet{bottleneckSkills.length > 1 ? 's' : ''} d'étranglement
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">
                    pour
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs shrink-0">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{nextMonthShort}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau avec ascenseur vertical (Colonnes : Compétence clé | Manque | Projets bloqués | Capacité) */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50 flex-1 flex flex-col min-h-[220px]">
            {bottleneckSkills.length === 0 ? (
              <div className="p-8 text-center space-y-2 my-auto">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h5 className="text-xs font-bold text-slate-900">
                  Aucun goulet d'étranglement pour {nextMonthShort} !
                </h5>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Toutes les compétences clés disposent d'une capacité suffisante pour couvrir les demandes des projets staffés.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[280px] flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`${TABLE_HEADER_THEAD_CLASS} sticky top-0 z-10 bg-slate-100`}>
                    <tr>
                      {/* Colonne 1 : Compétence clé */}
                      <th
                        scope="col"
                        className={`py-2.5 px-3 text-left align-middle font-bold text-slate-700 border-r border-slate-200 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS}`}
                        title="Compétence clé en déficit de capacité par rapport aux demandes"
                      >
                        Compétence clé
                      </th>

                      {/* Colonne 2 : Manque */}
                      <th
                        scope="col"
                        className={`py-2.5 px-2 text-center align-middle font-bold text-slate-700 border-r border-slate-200 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS} w-[80px]`}
                        title="Nombre de jours manquants par rapport à la demande totale (Demande - Capacité)"
                      >
                        Manque
                      </th>

                      {/* Colonne 3 : Projets bloqués */}
                      <th
                        scope="col"
                        className={`py-2.5 px-2 text-center align-middle font-bold text-slate-700 border-r border-slate-200 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS} w-[105px]`}
                        title="Nombre de projets staffés dont la demande ne peut pas être totalement honorée"
                      >
                        Projets bloqués
                      </th>

                      {/* Colonne 4 : Capacité */}
                      <th
                        scope="col"
                        className={`py-2.5 px-2 text-center align-middle font-bold text-slate-700 ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS} w-[80px]`}
                        title="Capacité disponible totale en nombre de jours pour ce mois"
                      >
                        Capacité
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {bottleneckSkills.map((item) => (
                      <tr
                        key={item.skillId}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Colonne 1 : Compétence clé */}
                        <td className="py-2.5 px-3 align-middle border-r border-slate-200">
                          <div
                            className="font-bold text-xs text-slate-900 truncate"
                            title={item.skillName}
                          >
                            {item.skillName}
                          </div>
                        </td>

                        {/* Colonne 2 : Manque (en rouge comme sur le croquis) */}
                        <td className="py-2.5 px-2 text-center align-middle font-mono font-bold text-xs text-red-600 border-r border-slate-200 whitespace-nowrap">
                          {formatDaysVal(item.missingDays)} j
                        </td>

                        {/* Colonne 3 : Projets bloqués (en rouge avec bulle de détail des projets) */}
                        <td className="py-2.5 px-2 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          {item.blockedProjectsCount > 0 ? (
                            <Tooltip
                              placement="top"
                              content={
                                <div className="text-left text-xs space-y-1">
                                  <div className="font-bold border-b border-white/20 pb-0.5">
                                    {item.blockedProjectsCount} projet{item.blockedProjectsCount > 1 ? 's' : ''} bloqué{item.blockedProjectsCount > 1 ? 's' : ''} :
                                  </div>
                                  <div className="space-y-0.5 font-normal">
                                    {item.blockedProjects.map((bp) => (
                                      <div key={bp.id}>
                                        • #{bp.projectNumber} {bp.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              }
                            >
                              <span className="font-mono font-bold text-xs text-red-600 cursor-help underline decoration-dotted decoration-red-300">
                                {item.blockedProjectsCount} proj{item.blockedProjectsCount > 1 ? '.' : ''}
                              </span>
                            </Tooltip>
                          ) : (
                            <span className="font-mono text-xs text-slate-400">0 proj.</span>
                          )}
                        </td>

                        {/* Colonne 4 : Capacité disponible */}
                        <td className="py-2.5 px-2 text-center align-middle font-mono font-medium text-xs text-slate-700 whitespace-nowrap">
                          {formatDaysVal(item.capacity)} j
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* GRILLE DES INDICATEURS 3 & 4 (côte à côte, 50% de la fenêtre chacun) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* ======================================================== */}
        {/* ENCART INDICATEUR 3 : Répartition budgétaire (Engagé vs Budgété) */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4 flex flex-col justify-between h-full">
          {/* En-tête de l'indicateur */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Répartition budgétaire : Engagé vs Budgété
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Centre : engagé sur les projets • Périphérie : budgétée
                </p>
              </div>
            </div>

            {/* Sélecteur de périmètre : Tous les projets vs Projets staffés uniquement */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setBudgetScopeStaffedOnly(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  !budgetScopeStaffedOnly
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setBudgetScopeStaffedOnly(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  budgetScopeStaffedOnly
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Staffés ({staffedProjects.length})
              </button>
            </div>
          </div>

          {/* Corps de l'indicateur 3 */}
          {budgetDistributionData.items.length === 0 ? (
            <div className="p-10 text-center space-y-2 my-auto">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <PieChart className="w-5 h-5" />
              </div>
              <h5 className="text-xs font-bold text-slate-900">
                Aucune ligne budgétaire active
              </h5>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Configurez des lignes budgétaires dans les paramètres pour afficher la répartition souhaitée et réelle.
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              {/* Bandeau de synthèse des totaux */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-sans font-medium uppercase tracking-wider">Budgété</span>
                  <strong className="text-slate-900 font-bold text-xs">{formatAmount(budgetDistributionData.totalWished)} K€</strong>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-sans font-medium uppercase tracking-wider">Engagé</span>
                  <strong className="text-slate-900 font-bold text-xs">{formatAmount(budgetDistributionData.totalReal)} K€</strong>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-sans font-medium uppercase tracking-wider">Écart global</span>
                  {(() => {
                    const totalDelta = budgetDistributionData.totalReal - budgetDistributionData.totalWished;
                    return (
                      <strong
                        className={`text-xs ${
                          totalDelta > 0
                            ? 'text-red-600 font-bold'
                            : totalDelta < 0
                            ? 'text-emerald-600 font-bold'
                            : 'text-slate-700 font-bold'
                        }`}
                      >
                        {totalDelta > 0
                          ? `+${formatAmount(totalDelta)}`
                          : totalDelta < 0
                          ? `-${formatAmount(Math.abs(totalDelta))}`
                          : '0'}{' '}
                        K€
                      </strong>
                    );
                  })()}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-sans font-medium uppercase tracking-wider">Nb projets</span>
                  <strong className="text-slate-900 font-bold text-xs">
                    {budgetDistributionData.relevantProjectsCount} projet{budgetDistributionData.relevantProjectsCount > 1 ? 's' : ''}
                  </strong>
                </div>
              </div>

              {/* Schéma SVG Camembert & Donut avec étiquettes */}
              <div className="flex-1 w-full overflow-hidden flex justify-center items-center pt-1 pb-1">
                <svg
                  viewBox="0 0 1000 600"
                  className="w-full h-auto select-none block"
                >
              <defs>
                <filter id="label-shadow" x="-10%" y="-15%" width="125%" height="135%">
                  <feDropShadow dx="0" dy="2.5" stdDeviation="3.5" floodOpacity="0.18" floodColor="#0f172a" />
                </filter>
              </defs>

              {/* 1. SECTEURS DU DONUT EXTÉRIEUR (Répartition souhaitée / imposée - 20% du rayon : innerR = 128, outerR = 160) */}
              <g>
                {budgetDistributionData.wishedSlices.length === 0 ? (
                  <circle
                    cx={500}
                    cy={300}
                    r={144}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={32}
                    strokeDasharray="4 4"
                  />
                ) : budgetDistributionData.wishedSlices.length === 1 ? (
                  <circle
                    cx={500}
                    cy={300}
                    r={144}
                    fill="none"
                    stroke={budgetDistributionData.wishedSlices[0].color}
                    strokeWidth={32}
                    strokeOpacity={
                      hoveredBudgetLineId && hoveredBudgetLineId !== budgetDistributionData.wishedSlices[0].id
                        ? 0.08
                        : 0.42
                    }
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredBudgetLineId(budgetDistributionData.wishedSlices[0].id)
                    }
                    onMouseLeave={() => setHoveredBudgetLineId(null)}
                  />
                ) : (
                  budgetDistributionData.wishedSlices.map((slice) => {
                    const isHovered = hoveredBudgetLineId === slice.id;
                    const isOtherHovered =
                      hoveredBudgetLineId && hoveredBudgetLineId !== slice.id;
                    const d = getDonutSlicePath(
                      500,
                      300,
                      128,
                      160,
                      slice.startAngle,
                      slice.endAngle
                    );
                    return (
                      <path
                        key={`wished_${slice.id}`}
                        d={d}
                        fill={slice.color}
                        fillOpacity={isOtherHovered ? 0.08 : 0.42}
                        stroke="#ffffff"
                        strokeWidth={2}
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredBudgetLineId(slice.id)}
                        onMouseLeave={() => setHoveredBudgetLineId(null)}
                      />
                    );
                  })
                )}
              </g>

              {/* 2. SECTEURS DU CAMEMBERT CENTRAL (Répartition réelle des projets - 80% du rayon : radius = 128) */}
              <g>
                {budgetDistributionData.realSlices.length === 0 ? (
                  <circle
                    cx={500}
                    cy={300}
                    r={128}
                    fill="#f8fafc"
                    stroke="#cbd5e1"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                ) : budgetDistributionData.realSlices.length === 1 ? (
                  <circle
                    cx={500}
                    cy={300}
                    r={128}
                    fill={budgetDistributionData.realSlices[0].color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    opacity={
                      hoveredBudgetLineId &&
                      hoveredBudgetLineId !== budgetDistributionData.realSlices[0].id
                        ? 0.12
                        : 1
                    }
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredBudgetLineId(budgetDistributionData.realSlices[0].id)
                    }
                    onMouseLeave={() => setHoveredBudgetLineId(null)}
                  />
                ) : (
                  budgetDistributionData.realSlices.map((slice) => {
                    const isHovered = hoveredBudgetLineId === slice.id;
                    const isOtherHovered =
                      hoveredBudgetLineId && hoveredBudgetLineId !== slice.id;
                    const d = getPieSlicePath(
                      500,
                      300,
                      128,
                      slice.startAngle,
                      slice.endAngle
                    );
                    return (
                      <path
                        key={`real_${slice.id}`}
                        d={d}
                        fill={slice.color}
                        fillOpacity={isHovered ? 1 : isOtherHovered ? 0.12 : 1}
                        stroke="#ffffff"
                        strokeWidth={2}
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredBudgetLineId(slice.id)}
                        onMouseLeave={() => setHoveredBudgetLineId(null)}
                      />
                    );
                  })
                )}
              </g>

                {/* 3. ÉTIQUETTES AVEC PIED TERMINÉ PAR UN PETIT POINT ANCRÉ AU CENTRE DU SECTEUR */}
                <g>
                  {labeledItems.map((it) => {
                    const isHovered = hoveredBudgetLineId === it.id;
                    const isOtherHovered = hoveredBudgetLineId && hoveredBudgetLineId !== it.id;
                    const stemColor = darkenColor(it.color, 0.55);
                    const cardX = it.isRight ? 720 : 50;
                    const cardW = 236;
                    const cardH = 88;
                    const cardMidY = it.targetY + cardH / 2;
                    const cardAttachX = it.isRight ? cardX : cardX + cardW;

                    const isDarkText = getContrastColor(it.color) === 'dark';
                    const textColor = isDarkText ? '#0f172a' : '#ffffff';
                    const subTextColor = isDarkText ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.90)';
                    const textX = cardX + 14;

                    return (
                      <g
                        key={`label_${it.id}`}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredBudgetLineId(it.id)}
                        onMouseLeave={() => setHoveredBudgetLineId(null)}
                        style={{
                          opacity: isHovered ? 1 : isOtherHovered ? 0.15 : 1,
                        }}
                      >
                        {(() => {
                          const top10 = [...it.projects]
                            .sort(
                              (a, b) =>
                                (Number(b.estimatedBudget) || 0) - (Number(a.estimatedBudget) || 0)
                            )
                            .slice(0, 10);
                          const projectsList =
                            top10.length > 0
                              ? top10
                                  .map(
                                    (p) =>
                                      `• #${p.projectNumber} ${p.name} (${formatAmount(
                                        Number(p.estimatedBudget) || 0
                                      )} K€)`
                                  )
                                  .join('\n')
                              : 'Aucun projet associé';
                          return (
                            <title>{`Le TOP 10 des projets de ${it.name} :\n${projectsList}`}</title>
                          );
                        })()}

                        {/* Piquet / Pied (ligne de rappel assombrie de 55% tout en conservant la teinte) */}
                        <path
                          d={`M ${it.xAnchor} ${it.yAnchor} L ${it.xElbow} ${it.yElbow} L ${cardAttachX} ${cardMidY}`}
                          fill="none"
                          stroke={stemColor}
                          strokeWidth={isHovered ? 2.5 : 2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Petit disque d'extrémité du piquet dans la même couleur que le piquet lui-même */}
                        <circle
                          cx={it.xAnchor}
                          cy={it.yAnchor}
                          r={isHovered ? 4.5 : 3.5}
                          fill={stemColor}
                          stroke="#ffffff"
                          strokeWidth={0.75}
                        />

                        {/* Étiquette : cartouche coloré avec la couleur de la ligne budgétaire */}
                        <rect
                          x={cardX}
                          y={it.targetY}
                          width={cardW}
                          height={cardH}
                          rx={10}
                          ry={10}
                          fill={it.color}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          filter="url(#label-shadow)"
                          className="transition-all duration-150"
                        />

                        {/* Ligne 1 : Nom de la ligne budgétaire en gros et gras */}
                        <text
                          x={textX}
                          y={it.targetY + 21}
                          fontSize="13"
                          fontWeight="800"
                          fill={textColor}
                          className="select-none font-sans"
                        >
                          {it.name.length > 25 ? `${it.name.slice(0, 23)}…` : it.name}
                        </text>

                        {/* Ligne 2 : Montant réel total en K€ suivi du % (grossi à 16px) */}
                        <text
                          x={textX}
                          y={it.targetY + 41}
                          fontSize="16"
                          fontWeight="700"
                          fill={textColor}
                          className="select-none font-sans"
                          style={{ fontSize: '16px' }}
                        >
                          {formatAmount(it.realKe)} K€ ({it.realPct.toFixed(1)} %)
                        </text>

                        {/* Ligne 3 : vs ... (...%) budgété */}
                        <text
                          x={textX}
                          y={it.targetY + 58}
                          fontSize="11"
                          fontWeight="500"
                          fill={subTextColor}
                          className="select-none font-sans"
                        >
                          vs {formatAmount(it.wishedKe)} K€ ({it.wishedPct.toFixed(1)} %) budgété
                        </text>

                        {/* Ligne 4 : écart entre réalisé et budgété sous la forme (soit + %) ou (soit - %) */}
                        <text
                          x={textX}
                          y={it.targetY + 75}
                          fontSize="11"
                          fontWeight="700"
                          fill={textColor}
                          className="select-none font-sans"
                        >
                          {it.soitText}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ENCART INDICATEUR 4 : Matrice Coût x Valeur */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4 flex flex-col justify-between h-full">
        {/* En-tête de l'indicateur */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 shrink-0">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 leading-tight">
                <span>Matrice : Coût x Valeur</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {matrixPlotData.length} projet{matrixPlotData.length > 1 ? 's' : ''}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Coût (max {maxCost}) • Valeur (max {maxValue}) • Priorité au 1er plan
              </p>
            </div>
          </div>

          {/* Outils de filtrage et recherche */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Recherche rapide d'un projet */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrer (# ou nom)..."
                value={matrixSearchQuery}
                onChange={(e) => setMatrixSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 w-32 sm:w-36 transition-all"
              />
              {matrixSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMatrixSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Périmètre */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setMatrixScopeStaffedOnly(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  !matrixScopeStaffedOnly
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setMatrixScopeStaffedOnly(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  matrixScopeStaffedOnly
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Staffés ({staffedProjects.length})
              </button>
            </div>
          </div>
        </div>

        {/* Corps de la Matrice */}
        {costCriteria.length === 0 && valueCriteria.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Aucun critère configuré</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Veuillez définir au moins un critère de coût et un critère de valeur dans les paramètres pour afficher la matrice de priorisation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Zone graphique SVG avec conteneur relatif pour l'infobulle */}
            <div className="relative w-full overflow-hidden rounded-xl bg-white border border-slate-200 shadow-2xs">
              <svg
                viewBox={`0 0 ${matrixSvgWidth} ${matrixSvgHeight}`}
                className="w-full h-auto select-none block"
              >
                <defs>
                  {/* Ombre des pastilles */}
                  <filter id="matrix-pastille-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.18" />
                  </filter>
                  {/* Flèche d'axe X */}
                  <marker
                    id="matrix-arrow-x"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#475569" />
                  </marker>
                  {/* Flèche d'axe Y */}
                  <marker
                    id="matrix-arrow-y"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#475569" />
                  </marker>
                </defs>

                {/* 1. Fonds teintés très légers pour les 4 quadrants */}
                {/* Quadrant Haut-Gauche (Forte Valeur, Faible Coût) */}
                <rect
                  x={matrixOriginX}
                  y={matrixMarginTop}
                  width={matrixPlotW / 2}
                  height={matrixPlotH / 2}
                  fill="#10b981"
                  fillOpacity={0.035}
                />
                {/* Quadrant Haut-Droit (Forte Valeur, Fort Coût) */}
                <rect
                  x={matrixMidX}
                  y={matrixMarginTop}
                  width={matrixPlotW / 2}
                  height={matrixPlotH / 2}
                  fill="#3b82f6"
                  fillOpacity={0.035}
                />
                {/* Quadrant Bas-Gauche (Faible Valeur, Faible Coût) */}
                <rect
                  x={matrixOriginX}
                  y={matrixMidY}
                  width={matrixPlotW / 2}
                  height={matrixPlotH / 2}
                  fill="#64748b"
                  fillOpacity={0.03}
                />
                {/* Quadrant Bas-Droit (Faible Valeur, Fort Coût) */}
                <rect
                  x={matrixMidX}
                  y={matrixMidY}
                  width={matrixPlotW / 2}
                  height={matrixPlotH / 2}
                  fill="#f43f5e"
                  fillOpacity={0.035}
                />

                {/* 2. Quadrillage de fond subtil */}
                {costTicks.map((tickVal) => {
                  const tickX = matrixOriginX + (tickVal / maxCost) * matrixPlotW;
                  return (
                    <line
                      key={`grid-x-${tickVal}`}
                      x1={tickX}
                      y1={matrixMarginTop}
                      x2={tickX}
                      y2={matrixOriginY}
                      stroke="#f1f5f9"
                      strokeWidth={1}
                    />
                  );
                })}
                {valueTicks.map((tickVal) => {
                  const tickY = matrixOriginY - (tickVal / maxValue) * matrixPlotH;
                  return (
                    <line
                      key={`grid-y-${tickVal}`}
                      x1={matrixOriginX}
                      y1={tickY}
                      x2={matrixOriginX + matrixPlotW}
                      y2={tickY}
                      stroke="#f1f5f9"
                      strokeWidth={1}
                    />
                  );
                })}

                {/* 3. Filet léger qui partage le graphique en 4 quadrants */}
                {/* Filet vertical (à Coût = maxCost / 2) */}
                <line
                  x1={matrixMidX}
                  y1={matrixMarginTop}
                  x2={matrixMidX}
                  y2={matrixOriginY}
                  stroke="#94a3b8"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                />
                {/* Filet horizontal (à Valeur = maxValue / 2) */}
                <line
                  x1={matrixOriginX}
                  y1={matrixMidY}
                  x2={matrixOriginX + matrixPlotW}
                  y2={matrixMidY}
                  stroke="#94a3b8"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                />

                {/* 4. Libellés discrets des 4 quadrants */}
                {/* Haut-Gauche */}
                <g>
                  <text
                    x={matrixOriginX + 14}
                    y={matrixMarginTop + 20}
                    fontSize="11"
                    fontWeight="700"
                    fill="#059669"
                    letterSpacing="0.04em"
                  >
                    FORTE VALEUR • FAIBLE COÛT
                  </text>
                  <text
                    x={matrixOriginX + 14}
                    y={matrixMarginTop + 34}
                    fontSize="9.5"
                    fontWeight="500"
                    fill="#10b981"
                  >
                    (Gains rapides / Pépites prioritaires)
                  </text>
                </g>

                {/* Haut-Droit */}
                <g>
                  <text
                    x={matrixOriginX + matrixPlotW - 14}
                    y={matrixMarginTop + 20}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="700"
                    fill="#2563eb"
                    letterSpacing="0.04em"
                  >
                    FORTE VALEUR • FORT COÛT
                  </text>
                  <text
                    x={matrixOriginX + matrixPlotW - 14}
                    y={matrixMarginTop + 34}
                    textAnchor="end"
                    fontSize="9.5"
                    fontWeight="500"
                    fill="#3b82f6"
                  >
                    (Projets stratégiques / Grands chantiers)
                  </text>
                </g>

                {/* Bas-Gauche */}
                <g>
                  <text
                    x={matrixOriginX + 14}
                    y={matrixOriginY - 26}
                    fontSize="11"
                    fontWeight="700"
                    fill="#64748b"
                    letterSpacing="0.04em"
                  >
                    FAIBLE VALEUR • FAIBLE COÛT
                  </text>
                  <text
                    x={matrixOriginX + 14}
                    y={matrixOriginY - 12}
                    fontSize="9.5"
                    fontWeight="500"
                    fill="#94a3b8"
                  >
                    (Opportunités secondaires / Améliorations mineures)
                  </text>
                </g>

                {/* Bas-Droit */}
                <g>
                  <text
                    x={matrixOriginX + matrixPlotW - 14}
                    y={matrixOriginY - 26}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="700"
                    fill="#e11d48"
                    letterSpacing="0.04em"
                  >
                    FAIBLE VALEUR • FORT COÛT
                  </text>
                  <text
                    x={matrixOriginX + matrixPlotW - 14}
                    y={matrixOriginY - 12}
                    textAnchor="end"
                    fontSize="9.5"
                    fontWeight="500"
                    fill="#f43f5e"
                  >
                    (À réévaluer / Moins prioritaires)
                  </text>
                </g>

                {/* 5. Axes principaux Coût (abscisse) et Valeur (ordonnée) avec origine 0,0 */}
                {/* Axe horizontal X (Coût) */}
                <line
                  x1={matrixOriginX}
                  y1={matrixOriginY}
                  x2={matrixOriginX + matrixPlotW + 16}
                  y2={matrixOriginY}
                  stroke="#475569"
                  strokeWidth={2}
                  markerEnd="url(#matrix-arrow-x)"
                />
                {/* Axe vertical Y (Valeur) */}
                <line
                  x1={matrixOriginX}
                  y1={matrixOriginY}
                  x2={matrixOriginX}
                  y2={matrixMarginTop - 16}
                  stroke="#475569"
                  strokeWidth={2}
                  markerEnd="url(#matrix-arrow-y)"
                />

                {/* Origine (0, 0) */}
                <circle cx={matrixOriginX} cy={matrixOriginY} r={3.5} fill="#334155" />
                <text
                  x={matrixOriginX - 10}
                  y={matrixOriginY + 16}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight="700"
                  fill="#475569"
                  fontFamily="ui-monospace, monospace"
                >
                  0
                </text>

                {/* Graduations Axe X (Coût) */}
                {costTicks.filter((v) => v > 0).map((tickVal) => {
                  const tickX = matrixOriginX + (tickVal / maxCost) * matrixPlotW;
                  return (
                    <g key={`tick-x-${tickVal}`}>
                      <line
                        x1={tickX}
                        y1={matrixOriginY}
                        x2={tickX}
                        y2={matrixOriginY + 5}
                        stroke="#64748b"
                        strokeWidth={1.5}
                      />
                      <text
                        x={tickX}
                        y={matrixOriginY + 18}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="#475569"
                        fontFamily="ui-monospace, monospace"
                      >
                        {tickVal}
                      </text>
                    </g>
                  );
                })}

                {/* Titre de l'Axe X (Coût) */}
                <text
                  x={matrixOriginX + matrixPlotW / 2}
                  y={matrixOriginY + 44}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#1e293b"
                >
                  Coût (Somme pondérée des critères de coût — Max : {maxCost}) →
                </text>

                {/* Graduations Axe Y (Valeur) */}
                {valueTicks.filter((v) => v > 0).map((tickVal) => {
                  const tickY = matrixOriginY - (tickVal / maxValue) * matrixPlotH;
                  return (
                    <g key={`tick-y-${tickVal}`}>
                      <line
                        x1={matrixOriginX - 5}
                        y1={tickY}
                        x2={matrixOriginX}
                        y2={tickY}
                        stroke="#64748b"
                        strokeWidth={1.5}
                      />
                      <text
                        x={matrixOriginX - 10}
                        y={tickY + 4}
                        textAnchor="end"
                        fontSize="11"
                        fontWeight="600"
                        fill="#475569"
                        fontFamily="ui-monospace, monospace"
                      >
                        {tickVal}
                      </text>
                    </g>
                  );
                })}

                {/* Titre de l'Axe Y (Valeur) */}
                <text
                  x={-(matrixMarginTop + matrixPlotH / 2)}
                  y={22}
                  textAnchor="middle"
                  transform="rotate(-90)"
                  fontSize="13"
                  fontWeight="700"
                  fill="#1e293b"
                >
                  ← Valeur (Somme pondérée des critères de valeur — Max : {maxValue})
                </text>

                {/* 6. Pastilles de chaque projet (affichant sa priorité calculée et couleur de sa ligne budgétaire) */}
                {matrixPlotData.map((item) => {
                  const isHovered = hoveredMatrixProject?.project.id === item.project.id;
                  const isDimmed = !item.isHighlighted;
                  const contrast = getContrastColor(item.color);
                  const textColor = contrast === 'dark' ? '#0f172a' : '#ffffff';

                  return (
                    <g
                      key={item.project.id}
                      className="cursor-pointer transition-transform duration-150"
                      transform={`translate(${item.x}, ${item.y})`}
                      opacity={isDimmed ? 0.2 : 1}
                      onClick={() => {
                        if (item.project.isConfidential && !showConfidentialProjects) {
                          setConfidentialAlertOpen(true);
                          return;
                        }
                        setSelectedProjectForDetail(item.project);
                      }}
                      onMouseEnter={() =>
                        setHoveredMatrixProject({
                          project: item.project,
                          costScore: item.costScore,
                          valueScore: item.valueScore,
                          roi: item.roi,
                          priority: item.priority,
                          color: item.color,
                          stateName: item.stateName,
                          x: item.x,
                          y: item.y,
                        })
                      }
                      onMouseLeave={() => {
                        if (hoveredMatrixProject?.project.id === item.project.id) {
                          setHoveredMatrixProject(null);
                        }
                      }}
                    >
                      {/* Anneau pulsant au survol */}
                      {isHovered && (
                        <circle
                          r={21}
                          fill="none"
                          stroke={item.color}
                          strokeWidth={3}
                          strokeOpacity={0.6}
                          className="animate-pulse"
                        />
                      )}

                      {/* Disque de la pastille */}
                      <circle
                        r={isHovered ? 16 : 14}
                        fill={item.color}
                        stroke={isHovered ? '#0f172a' : '#ffffff'}
                        strokeWidth={isHovered ? 2.5 : 2}
                        filter="url(#matrix-pastille-shadow)"
                      />

                      {/* Numéro de priorité calculée du projet (au lieu de l'identifiant) */}
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={item.priority !== null && item.priority > 99 ? 9 : 11}
                        fontWeight="800"
                        fontFamily="ui-monospace, monospace"
                        fill={textColor}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {item.priority !== null ? item.priority : '-'}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Bulle d'information interactive au survol d'une pastille */}
              {hoveredMatrixProject && (
                <div
                  className="absolute z-30 pointer-events-none transition-all duration-100 ease-out"
                  style={{
                    left: `${(hoveredMatrixProject.x / matrixSvgWidth) * 100}%`,
                    top: `${(hoveredMatrixProject.y / matrixSvgHeight) * 100}%`,
                    transform:
                      hoveredMatrixProject.x > 680
                        ? hoveredMatrixProject.y < 140
                          ? 'translate(-105%, 15px)'
                          : 'translate(-105%, -105%)'
                        : hoveredMatrixProject.y < 140
                        ? 'translate(15px, 15px)'
                        : 'translate(-50%, -115%)',
                  }}
                >
                  <div className="bg-slate-900/95 backdrop-blur-xs text-white rounded-xl shadow-2xl p-3 border border-slate-700/80 min-w-[210px] max-w-[290px] text-xs space-y-2">
                    {/* 1. L'identifiant suivi du nom du projet */}
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/50 shadow-2xs"
                        style={{ backgroundColor: hoveredMatrixProject.color }}
                      />
                      <h4 className="font-bold text-sm text-white truncate leading-tight">
                        #{hoveredMatrixProject.project.projectNumber} {hoveredMatrixProject.project.name}
                      </h4>
                    </div>

                    {/* 2. La priorité calculée, suivie du ROI et entre parenthèses (V / C) */}
                    <div className="py-1.5 px-2.5 rounded-lg bg-slate-800/90 border border-slate-700/60 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 font-semibold">Priorité :</span>
                        <span className="font-bold font-mono text-emerald-400 text-sm">
                          {hoveredMatrixProject.priority !== null ? hoveredMatrixProject.priority : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-700/50">
                        <span className="text-slate-400">ROI :</span>
                        <span className="font-mono text-indigo-300 font-semibold">
                          {formatRoi(hoveredMatrixProject.roi)} ({hoveredMatrixProject.valueScore} / {hoveredMatrixProject.costScore})
                        </span>
                      </div>
                    </div>

                    {/* 3. L'état */}
                    <div className="flex items-center justify-between text-xs px-0.5">
                      <span className="text-slate-400 font-medium">État :</span>
                      <span className="font-semibold text-slate-200">{hoveredMatrixProject.stateName}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Légende interactive des lignes budgétaires */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Lignes budgétaires :</span>
              </span>
              <button
                type="button"
                onClick={() => setMatrixSelectedBudgetLineId(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  matrixSelectedBudgetLineId === null
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Toutes ({matrixPlotData.length})
              </button>
              {budgetLines.map((bl) => {
                const count = matrixPlotData.filter((it) => it.project.budgetLineId === bl.id).length;
                if (count === 0) return null;
                const isSelected = matrixSelectedBudgetLineId === bl.id;
                return (
                  <button
                    key={bl.id}
                    type="button"
                    onClick={() =>
                      setMatrixSelectedBudgetLineId(isSelected ? null : bl.id)
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-slate-900 shadow-2xs'
                        : 'hover:opacity-90'
                    }`}
                    style={{
                      backgroundColor: isSelected ? bl.color : `${bl.color}20`,
                      color: isSelected
                        ? getContrastColor(bl.color) === 'dark'
                          ? '#0f172a'
                          : '#ffffff'
                        : '#1e293b',
                      border: `1px solid ${bl.color}50`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: bl.color }}
                    />
                    <span>{bl.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ======================================================== */}
      {/* MODALE : Prévisualisation & confirmation de l'email */}
      {/* ======================================================== */}
      {emailModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* En-tête */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Demande de mise à jour par email
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Client de messagerie sollicité pour l'envoi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenu */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {/* Destinataires */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                    Destinataire(s)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyEmails}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  >
                    {copiedEmails ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Adresses copiées !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copier les adresses</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-mono text-[11px] break-all max-h-24 overflow-y-auto">
                  {emailModal.recipients.join(', ')}
                </div>
              </div>

              {/* Objet */}
              <div>
                <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block mb-1">
                  Objet
                </span>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-medium">
                  {emailModal.subject}
                </div>
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                    Corps de l'email
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Texte copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copier le texte</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-sans whitespace-pre-wrap leading-relaxed text-[11px] max-h-60 overflow-y-auto">
                  {emailModal.body}
                </pre>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] leading-relaxed">
                Votre logiciel ou webmail par défaut s'ouvre avec ces informations pré-remplies. Vous pouvez également copier le texte ou les adresses d'un simple clic ci-dessus.
              </div>
            </div>

            {/* Pied de modale */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const to = emailModal.recipients.join(',');
                  const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(
                    emailModal.subject
                  )}&body=${encodeURIComponent(emailModal.body)}`;
                  window.location.href = mailtoUrl;
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Réouvrir mon client email</span>
              </button>

              <button
                type="button"
                onClick={() => setEmailModal(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors cursor-pointer shadow-2xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALE : Détail du projet en lecture seule */}
      {/* ======================================================== */}
      {selectedProjectForDetail && (
        <ProjectModal
          isOpen={true}
          onClose={() => setSelectedProjectForDetail(null)}
          projectToEdit={selectedProjectForDetail}
          currentUserEmail={currentUserEmail}
          isReadOnly={true}
          projectStates={projectStates}
          budgetLines={budgetLines}
          criteria={criteria}
          customParams={customParams}
          users={users}
          bonusConfig={bonusConfig}
          onSuccess={() => setSelectedProjectForDetail(null)}
        />
      )}

      {/* ======================================================== */}
      {/* MODALE D'ALERTE : Projet confidentiel masqué */}
      {/* ======================================================== */}
      {confidentialAlertOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setConfidentialAlertOpen(false)}
        >
          <div
            className="w-full max-w-md bg-red-600 border border-red-500 text-white rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-150 select-none"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setConfidentialAlertOpen(false)}
              className="absolute top-3.5 right-3.5 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>

              <div className="text-white text-sm md:text-base font-semibold leading-relaxed">
                Projet confidentiel. Si vous en avez le droit, activer l'affichage des projets confidentiels dans l'onglet 'Priorité' ou dans l'onglet 'Capacitaire'.
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setConfidentialAlertOpen(false)}
                  className="px-5 py-2 bg-white text-red-700 hover:bg-red-50 font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

