import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Gauge,
  Search,
  Filter,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  Brain,
  Lock,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Check,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { Project } from '../types/project';
import { KeySkill } from '../types/skill';
import { Resource } from '../types/resource';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { Criterion } from '../types/criteria';
import { CustomProjectParam } from '../types/customParam';
import { AppUser, UserRole } from '../types/user';
import { BonusConfig } from '../types/bonus';
import { calculateProjectRoi } from '../utils/roiCalculator';
import { updateProjectCapacity, updateProjectStaffing } from '../services/projectService';
import { isSuperAdminEmail } from '../services/userService';
import { getWorkingDaysInMonth } from '../utils/workingDays';
import {
  MY_FILTER_BUTTON_ACTIVE_CLASS,
  MY_FILTER_BUTTON_INACTIVE_CLASS,
  TABLE_HEADER_TEXT_CLASS,
  TABLE_FROZEN_DIVIDER_CLASS,
} from '../constants/ui';
import { Tooltip } from './Tooltip';
import { ProjectModal } from './ProjectModal';
import {
  ProjectPermissionContext,
  canViewConfidentialProject,
} from '../utils/projectPermissions';
import { ProjectActionButton } from './ProjectActionButton';
import { LifecycleStateFilter } from './LifecycleStateFilter';
import { BudgetLineFilter } from './BudgetLineFilter';
import { AlertsFilter } from './AlertsFilter';

interface ProjectsCapacityTableProps {
  projects: Project[];
  skills: KeySkill[];
  resources?: Resource[];
  loading: boolean;
  activeUser: AppUser | null;
  isSuperUser: boolean;
  isAdmin: boolean;
  isResourceManager?: boolean;
  isProjectManager?: boolean;
  isValueManagementOfficer: boolean;
  effectiveRole?: UserRole;
  projectStates: ProjectState[];
  budgetLines: BudgetLine[];
  criteria: Criterion[];
  customParams?: CustomProjectParam[];
  users: AppUser[];
  bonusConfig?: BonusConfig;
  showConfidentialProjects?: boolean;
  setShowConfidentialProjects?: (show: boolean) => void;
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MONTH_NAMES_SHORT = [
  'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin',
  'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'
];

export const ProjectsCapacityTable: React.FC<ProjectsCapacityTableProps> = ({
  projects,
  skills,
  resources = [],
  loading,
  activeUser,
  isSuperUser,
  isAdmin,
  isResourceManager,
  isProjectManager,
  isValueManagementOfficer,
  effectiveRole,
  projectStates,
  budgetLines = [],
  criteria,
  customParams = [],
  users,
  bonusConfig,
  showConfidentialProjects: showConfidentialProjectsProp,
  setShowConfidentialProjects: setShowConfidentialProjectsProp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  const [filterCapacityOverruns, setFilterCapacityOverruns] = useState(false);
  const [filterBudgetOverruns, setFilterBudgetOverruns] = useState(false);
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>([]);
  const hasInitializedStatesRef = useRef(false);

  useEffect(() => {
    if (projectStates.length > 0 && !hasInitializedStatesRef.current) {
      setSelectedStateIds(projectStates.map((s) => s.id));
      hasInitializedStatesRef.current = true;
    }
  }, [projectStates]);

  const isStateFilterActive =
    hasInitializedStatesRef.current &&
    selectedStateIds.length < projectStates.length;

  const [selectedBudgetLineIds, setSelectedBudgetLineIds] = useState<string[]>([]);
  const hasInitializedBudgetLinesRef = useRef(false);

  useEffect(() => {
    if (budgetLines.length > 0 && !hasInitializedBudgetLinesRef.current) {
      setSelectedBudgetLineIds(budgetLines.map((b) => b.id));
      hasInitializedBudgetLinesRef.current = true;
    }
  }, [budgetLines]);

  const isBudgetLineFilterActive =
    hasInitializedBudgetLinesRef.current &&
    selectedBudgetLineIds.length < budgetLines.length;

  const isAlertFilterActive = filterCapacityOverruns || filterBudgetOverruns;

  const [localShowConfidentialProjects, setLocalShowConfidentialProjects] = useState(false);
  const [showBudgetOverruns, setShowBudgetOverruns] = useState(false);

  // Lorsqu'on coche l'option "Les dépassements budgétaires", cocher automatiquement "Afficher les aspects budgétaires"
  const handleToggleBudgetOverruns = (checked: boolean) => {
    setFilterBudgetOverruns(checked);
    if (checked) {
      setShowBudgetOverruns(true);
    }
  };

  // Gestion de la modal de visualisation / modification du projet
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const showConfidentialProjects =
    showConfidentialProjectsProp !== undefined ? showConfidentialProjectsProp : localShowConfidentialProjects;
  const setShowConfidentialProjects = (val: boolean) => {
    setLocalShowConfidentialProjects(val);
    setShowConfidentialProjectsProp?.(val);
  };

  const permissionContext: ProjectPermissionContext = useMemo(() => ({
    activeUser,
    isSuperUser,
    isValueManagementOfficer,
    isAdmin,
    isResourceManager,
    isProjectManager,
    effectiveRole,
    showConfidentialProjects,
  }), [
    activeUser,
    isSuperUser,
    isValueManagementOfficer,
    isAdmin,
    isResourceManager,
    isProjectManager,
    effectiveRole,
    showConfidentialProjects,
  ]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      isStateFilterActive ||
      isBudgetLineFilterActive ||
      isAlertFilterActive ||
      myProjectsOnly
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStateIds(projectStates.map((s) => s.id));
    setSelectedBudgetLineIds(budgetLines.map((b) => b.id));
    setFilterCapacityOverruns(false);
    setFilterBudgetOverruns(false);
    setMyProjectsOnly(false);
  };

  // États locaux réactifs pour saisie instantanée sans latence
  const [localDays, setLocalDays] = useState<Record<string, Record<string, number | null>>>({});
  const [localMonths, setLocalMonths] = useState<Record<string, string | null>>({});
  const [localStaffed, setLocalStaffed] = useState<Record<string, boolean>>({});
  const [openMonthDropdownId, setOpenMonthDropdownId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    return () => {
      Object.values(saveTimeoutRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Fermeture du menu de sélection au clic extérieur ou à l'échappement
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.month-dropdown-container')) {
        setOpenMonthDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMonthDropdownId(null);
      }
    };
    if (openMonthDropdownId) {
      document.addEventListener('click', handleDocumentClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMonthDropdownId]);

  // Définition dynamique du "mois prochain" (le mois à venir)
  const { nextMonthKey, nextMonthLabel, nextMonthShort, nextMonthYear, nextMonthMonth } = useMemo(() => {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const year = nextDate.getFullYear();
    const month = nextDate.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = `${MONTH_NAMES_FR[nextDate.getMonth()]} ${year}`;
    const shortLabel = `${MONTH_NAMES_SHORT[nextDate.getMonth()]} ${year}`;
    return {
      nextMonthKey: key,
      nextMonthLabel: label,
      nextMonthShort: shortLabel,
      nextMonthYear: year,
      nextMonthMonth: month,
    };
  }, []);

  // Nombre de jours ouvrés pour le mois prochain (du lundi au vendredi hors jours fériés légaux français)
  const workingDaysNextMonth = useMemo(() => {
    return getWorkingDaysInMonth(nextMonthYear, nextMonthMonth);
  }, [nextMonthYear, nextMonthMonth]);

  const formatMonthKey = (key?: string | null): string => {
    if (!key) return 'Non planifié';
    const parts = key.split('-');
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        return `${MONTH_NAMES_SHORT[m - 1]} ${y}`;
      }
    }
    return key;
  };

  // Droits pour modifier le nombre de jours demandé sur les compétences clés et le mois de màj :
  // - Seul le Super User (ou compte super admin dont stephane.labati@...), OU le Chef du projet considéré, OU son adjoint ont le droit.
  // - Y compris pour les projets confidentiels.
  // - Ni la persona Administrateur, ni le Value Management Officer (sauf s'ils sont PM/Adjoint sur ce projet ou Super User),
  //   ni un utilisateur sans rôle sur ce projet ne peuvent modifier ces données.
  const canEditProjectCapacity = (p: Project): boolean => {
    // 1. Super User
    if (isSuperUser) return true;
    if (activeUser?.email) {
      const uEmail = activeUser.email.toLowerCase().trim();
      if (isSuperAdminEmail(uEmail)) {
        return true;
      }
      // 2. Chef de projet ou adjoint du projet considéré
      const pm = (p.projectManagerEmail || '').toLowerCase().trim();
      const dep = (p.deputyEmail || '').toLowerCase().trim();
      if (uEmail && (uEmail === pm || uEmail === dep)) {
        return true;
      }
    }
    return false;
  };

  // Visualisation d'un projet confidentiel (règle partagée et homogène)
  const canViewConfidential = useCallback(
    (p: Project): boolean => canViewConfidentialProject(p, permissionContext),
    [permissionContext]
  );

  // Helper : vérifie si l'état d'un projet a l'attribut « à prioriser » à VRAI
  const isProjectStatePrioritized = (stateId: string): boolean => {
    const s = projectStates.find((st) => st.id === stateId);
    return Boolean(s?.needsPrioritization);
  };

  // Helper : vérifie si l'état d'un projet a l'attribut « à staffer » à VRAI
  const isProjectStateNeedsStaffing = (stateId: string): boolean => {
    const s = projectStates.find((st) => st.id === stateId);
    return Boolean(s?.needsStaffing);
  };

  // Persona Administrateur : n'a pas le droit de cocher / décocher la case staffé
  const isPersonaAdmin =
    effectiveRole === 'administrateur' ||
    (isAdmin && !isValueManagementOfficer && !isSuperUser);

  // Droits pour cocher / décocher la case « Staffé » d'un projet dans le tableau capacitaire :
  // - L'état du projet doit avoir l'attribut « à staffer »
  // - Les persona Administrateur ne doivent PAS avoir le droit de cocher / décocher cette case
  // - En tant que Value Management Officer (ou Super User), droit accordé pour TOUS les projets à staffer,
  //   MÊME pour les projets qui sont confidentiels (qu'ils soient masqués ou affichés)
  // - Pour le Chef de projet ou son adjoint : autorisé sur ses propres projets (s'il y a accès)
  const canToggleProjectStaffing = (p: Project): boolean => {
    // Règle explicite : les persona Administrateur ne doivent pas avoir le droit de cocher / décocher cette case
    if (isPersonaAdmin) {
      return false;
    }

    // Le Value Management Officer (et le super user) sont autorisés à cocher / décocher TOUS les projets,
    // y compris ceux dont l'état ne réclame normalement pas de le staffer, même confidentiels
    if (isValueManagementOfficer || isSuperUser) {
      return true;
    }

    // Pour les autres rôles, l'état doit être à staffer
    const stateNeedsStaffing = isProjectStateNeedsStaffing(p.stateId);
    if (!stateNeedsStaffing) return false;

    // Chef de projet ou adjoint (sur ses propres projets non confidentiels ou visibles)
    if (p.isConfidential && !canViewConfidential(p)) return false;
    if (!activeUser?.email) return false;
    const uEmail = activeUser.email.toLowerCase();
    const pm = (p.projectManagerEmail || '').toLowerCase();
    const dep = (p.deputyEmail || '').toLowerCase();
    return uEmail === pm || uEmail === dep;
  };

  // Helper : vérifie si le projet est effectivement staffé (prise en compte dans le capacitaire)
  const isProjectStaffed = (p: Project): boolean => {
    if (localStaffed[p.id] !== undefined) {
      return localStaffed[p.id];
    }
    const stateNeedsStaffing = isProjectStateNeedsStaffing(p.stateId);
    if (!stateNeedsStaffing) {
      // Pour les états dont l'état ne réclame normalement pas de le staffer,
      // le projet n'est staffé que si la case a été explicitement cochée (true)
      return p.isStaffed === true;
    }
    // Pour les états à staffer, il est staffé par défaut sauf si explicitement décoché (false)
    return p.isStaffed !== false;
  };

  // Basculer le statut de staffing directement depuis la case à cocher du tableau
  const handleToggleStaffing = async (project: Project) => {
    if (!canToggleProjectStaffing(project)) return;

    const currentlyStaffed = isProjectStaffed(project);
    const nextVal = !currentlyStaffed;

    setLocalStaffed((prev) => ({
      ...prev,
      [project.id]: nextVal,
    }));

    try {
      await updateProjectStaffing(project.id, nextVal);
    } catch (err) {
      console.error('Erreur mise à jour staffing projet:', err);
    }
  };

  // Tri des projets selon les règles de priorisation :
  // - Tous les projets ont leur ROI calculé en permanence quel que soit leur état
  // - Le numéro de priorité (1 à N) n'est calculé QUE sur les projets staffés
  // - Les projets sont ordonnés avec les projets staffés selon leur priorité (du numéro 1 au dernier),
  //   puis tous les projets non staffés par ordre décroissant de ROI
  const sortedProjectsByPriority = useMemo(() => {
    const list = projects.map((p) => {
      const calculatedRoi = calculateProjectRoi(
        p.criteriaValues,
        criteria,
        true, // recalculé quel que soit l'état du projet
        p.bonus,
        bonusConfig?.isBonusActive ?? true
      );
      const isStaffed = isProjectStaffed(p);
      return {
        project: p,
        roi: calculatedRoi,
        isStaffed,
        projectNumber: p.projectNumber || 0,
      };
    });

    // 1. Projets staffés
    const staffedList = list.filter((item) => item.isStaffed);
    staffedList.sort((a, b) => {
      if (a.roi === null && b.roi === null) return a.projectNumber - b.projectNumber;
      if (a.roi === null) return 1;
      if (b.roi === null) return -1;
      const diff = b.roi - a.roi;
      if (diff !== 0) return diff;
      return a.projectNumber - b.projectNumber;
    });

    // Numérotation de la priorité uniquement sur les projets staffés avec ROI calculé
    const rankMap = new Map<string, number>();
    staffedList.forEach((item, index) => {
      if (item.roi !== null) {
        rankMap.set(item.project.id, index + 1);
      }
    });

    // 2. Projets non staffés (triés par ordre décroissant de ROI)
    const nonStaffedList = list.filter((item) => !item.isStaffed);
    nonStaffedList.sort((a, b) => {
      if (a.roi === null && b.roi === null) return a.projectNumber - b.projectNumber;
      if (a.roi === null) return 1;
      if (b.roi === null) return -1;
      const diff = b.roi - a.roi;
      if (diff !== 0) return diff;
      return a.projectNumber - b.projectNumber;
    });

    // 3. Concaténation : projets staffés (priorité 1 au dernier), puis projets non staffés par ROI décroissant
    const orderedProjects = [
      ...staffedList.map((i) => i.project),
      ...nonStaffedList.map((i) => i.project),
    ];

    return { orderedProjects, rankMap };
  }, [projects, criteria, bonusConfig, localStaffed, projectStates]);

  // Récupération de la valeur locale ou distante du mois de mise à jour
  const getProjectMonth = (p: Project): string | null => {
    if (localMonths[p.id] !== undefined) {
      return localMonths[p.id];
    }
    return p.capacityUpdatedMonth || null;
  };

  // Récupération de la valeur locale ou distante des jours mobilisés pour une compétence
  const getSkillDays = (p: Project, skillId: string): string => {
    const localVal = localDays[p.id]?.[skillId];
    if (localVal !== undefined) {
      return localVal === null ? '' : String(localVal);
    }
    const storedVal = p.capacityDaysPerSkill?.[skillId];
    if (storedVal !== undefined && storedVal !== null) {
      return String(storedVal);
    }
    return '';
  };

  // Calcul des goulets d'étranglement par compétence et par projet :
  // Les projets sont évalués selon leur ordre strict de priorité (ROI décroissant).
  // Seuls les projets effectivement staffés (isProjectStaffed) consomment de la bande passante.
  // Pour chaque compétence clé, si la demande cumulée des projets plus prioritaires et du projet courant
  // dépasse la capacité totale disponible C, la demande de ce projet ne peut pas être totalement honorée.
  // Ce projet et cette cellule sont alors marqués comme goulet d'étranglement (en rouge sur fond rose).
  const bottleneckData = useMemo(() => {
    const bottleneckCells = new Set<string>();
    const bottleneckProjects = new Set<string>();
    const cellDetails = new Map<string, {
      requested: number;
      availableBefore: number;
      capacity: number;
      deficit: number;
    }>();

    // Capacités disponibles C par compétence
    const capacityBySkill: Record<string, number> = {};
    skills.forEach((skill) => {
      let C = 0;
      (resources || []).forEach((res) => {
        if (res.skillId === skill.id) {
          const fte = typeof res.fte === 'number' && !isNaN(res.fte) ? res.fte : 1.0;
          const unavail = (res.unavailability && typeof res.unavailability[nextMonthKey] === 'number')
            ? res.unavailability[nextMonthKey]
            : 0;
          const avail = (workingDaysNextMonth * fte) - unavail;
          C += Math.max(0, avail);
        }
      });
      capacityBySkill[skill.id] = Math.round(C * 10) / 10;
    });

    // Parcours par compétence dans l'ordre strict de priorité des projets
    skills.forEach((skill) => {
      // Ne pas générer d'alerte de dépassement pour les compétences dont l'attribut "Alerte dépassement" est à FAUX (non coché)
      if (!skill.alertOnDemandOverrun) {
        return;
      }

      const C = capacityBySkill[skill.id] ?? 0;
      let cumulativeUsed = 0;

      sortedProjectsByPriority.orderedProjects.forEach((project) => {
        // Les projets non staffés ne sont JAMAIS pris en compte dans le capacitaire
        // et restent en grisé sans subir de goulet d'étranglement
        if (!isProjectStaffed(project)) {
          return;
        }

        const daysStr = getSkillDays(project, skill.id);
        const days = parseFloat(daysStr);
        if (isNaN(days) || days <= 0) {
          return;
        }

        const requested = Math.round(days * 10) / 10;
        const availableBefore = Math.max(0, Math.round((C - cumulativeUsed) * 10) / 10);
        const totalWithCurrent = Math.round((cumulativeUsed + requested) * 10) / 10;

        // Si la demande cumulée (projets plus prioritaires + projet courant) dépasse la capacité totale,
        // la demande ne peut pas être totalement honorée
        if (totalWithCurrent > C) {
          const deficit = Math.round((totalWithCurrent - C) * 10) / 10;
          const key = `${project.id}_${skill.id}`;
          bottleneckCells.add(key);
          bottleneckProjects.add(project.id);
          cellDetails.set(key, {
            requested,
            availableBefore,
            capacity: C,
            deficit,
          });
        }

        cumulativeUsed = totalWithCurrent;
      });
    });

    return {
      bottleneckCells,
      bottleneckProjects,
      cellDetails,
    };
  }, [
    skills,
    sortedProjectsByPriority.orderedProjects,
    resources,
    nextMonthKey,
    workingDaysNextMonth,
    localDays,
    localStaffed,
    projectStates,
  ]);

  // Détection des dépassements budgétaires par projet et par ligne budgétaire :
  // Les projets sont évalués selon leur ordre strict de priorité (ROI décroissant).
  // Comme pour les alertes capacitaires, un projet n'est pris en compte dans le calcul que s'il est staffé (case cochée dans le tableau).
  const budgetOverrunData = useMemo(() => {
    const overrunProjects = new Set<string>();
    const details = new Map<string, {
      projectBudget: number;
      lineAllocated: number;
      cumulativeBefore: number;
      cumulativeTotal: number;
      overrunAmount: number;
      lineName: string;
    }>();

    const cumulativeByLine: Record<string, number> = {};
    const budgetLinesMap = new Map<string, BudgetLine>();
    budgetLines.forEach((bl) => {
      budgetLinesMap.set(bl.id, bl);
    });

    sortedProjectsByPriority.orderedProjects.forEach((project) => {
      // Ne considérer un projet dans le calcul du dépassement budgétaire que s'il est staffé
      if (!isProjectStaffed(project)) return;
      if (!project.budgetLineId) return;

      const bl = budgetLinesMap.get(project.budgetLineId);
      if (!bl) return;

      const projectBudget = Number(project.estimatedBudget) || 0;
      const lineAllocated = Number(bl.budgetKe) || 0;
      const cumulativeBefore = cumulativeByLine[bl.id] || 0;
      const cumulativeTotal = Math.round((cumulativeBefore + projectBudget) * 10) / 10;

      cumulativeByLine[bl.id] = cumulativeTotal;

      if (lineAllocated > 0 && cumulativeTotal > lineAllocated) {
        overrunProjects.add(project.id);
        details.set(project.id, {
          projectBudget,
          lineAllocated,
          cumulativeBefore,
          cumulativeTotal,
          overrunAmount: Math.round((cumulativeTotal - lineAllocated) * 10) / 10,
          lineName: bl.name,
        });
      }
    });

    return {
      overrunProjects,
      details,
    };
  }, [sortedProjectsByPriority.orderedProjects, budgetLines, localStaffed, projectStates]);

  // Filtrage des projets affichés
  const displayedProjects = useMemo(() => {
    return sortedProjectsByPriority.orderedProjects.filter((p) => {
      const isHidden = Boolean(p.isConfidential) && !canViewConfidential(p);

      // Filtre texte
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesNum = `#${p.projectNumber}`.includes(q) || String(p.projectNumber).includes(q);
        if (isHidden) {
          if (!matchesNum && !'confidentiel'.includes(q)) return false;
        } else {
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesPM = (p.projectManagerEmail || '').toLowerCase().includes(q);
          if (!matchesNum && !matchesName && !matchesPM) return false;
        }
      }

      // Filtre "Mes projets"
      if (myProjectsOnly && activeUser?.email) {
        const uEmail = activeUser.email.toLowerCase();
        const pm = (p.projectManagerEmail || '').toLowerCase();
        const dep = (p.deputyEmail || '').toLowerCase();
        if (uEmail !== pm && uEmail !== dep) return false;
      }

      // Filtre cycle de vie
      if (isStateFilterActive) {
        if (!p.stateId || !selectedStateIds.includes(p.stateId)) return false;
      }

      // Filtre ligne budgétaire
      if (isBudgetLineFilterActive) {
        if (isHidden) return false;
        if (!p.budgetLineId || !selectedBudgetLineIds.includes(p.budgetLineId)) return false;
      }

      // Filtre Les alertes (dépassements capacitaires et/ou budgétaires)
      if (filterCapacityOverruns && filterBudgetOverruns) {
        const hasCapacity = bottleneckData.bottleneckProjects.has(p.id);
        const hasBudget = budgetOverrunData.overrunProjects.has(p.id);
        if (!hasCapacity && !hasBudget) return false;
      } else if (filterCapacityOverruns) {
        if (!bottleneckData.bottleneckProjects.has(p.id)) return false;
      } else if (filterBudgetOverruns) {
        if (!budgetOverrunData.overrunProjects.has(p.id)) return false;
      }

      return true;
    });
  }, [
    sortedProjectsByPriority,
    searchQuery,
    myProjectsOnly,
    isStateFilterActive,
    selectedStateIds,
    isBudgetLineFilterActive,
    selectedBudgetLineIds,
    filterCapacityOverruns,
    filterBudgetOverruns,
    bottleneckData,
    budgetOverrunData,
    activeUser,
    localMonths,
    nextMonthKey,
    showConfidentialProjects,
    canViewConfidential,
    isValueManagementOfficer,
    localStaffed,
  ]);

  // Mise à jour du mois de planification vers le mois prochain
  const handleUpdateMonth = async (project: Project, targetMonth: string | null) => {
    if (!canEditProjectCapacity(project)) return;

    setLocalMonths((prev) => ({
      ...prev,
      [project.id]: targetMonth,
    }));

    try {
      const currentDays = localDays[project.id] || project.capacityDaysPerSkill || {};
      await updateProjectCapacity(project.id, targetMonth, currentDays);
    } catch (err) {
      console.error('Erreur mise à jour mois capacitaire:', err);
    }
  };

  // Saisie du nombre de jours de compétence à mobiliser
  const handleSkillDaysChange = (project: Project, skillId: string, rawVal: string) => {
    if (!canEditProjectCapacity(project) || !isProjectStaffed(project)) return;

    const normalized = rawVal.replace(',', '.');
    let numVal: number | null = null;

    if (normalized.trim() !== '') {
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed) && parsed >= 0) {
        // Arrondi à une décimale
        numVal = Math.round(parsed * 10) / 10;
      }
    }

    const updatedSkillMap = {
      ...(localDays[project.id] || project.capacityDaysPerSkill || {}),
      [skillId]: numVal,
    };

    setLocalDays((prev) => ({
      ...prev,
      [project.id]: updatedSkillMap,
    }));

    // Ne pas modifier automatiquement le mois : la mise à jour du mois doit être une action volontaire
    const currentMonth = getProjectMonth(project);

    // Débouncing pour persistance Firestore (600ms)
    const timeoutKey = `${project.id}_${skillId}`;
    if (saveTimeoutRef.current[timeoutKey]) {
      clearTimeout(saveTimeoutRef.current[timeoutKey]);
    }

    saveTimeoutRef.current[timeoutKey] = setTimeout(async () => {
      try {
        await updateProjectCapacity(project.id, currentMonth, updatedSkillMap);
      } catch (err) {
        console.error('Erreur sauvegarde jours capacitaire:', err);
      } finally {
        delete saveTimeoutRef.current[timeoutKey];
      }
    }, 600);
  };

  // Calcul de la capacité C, de la demande D, du nombre de projets P et du restant R pour chaque compétence clé :
  // Le calcul de dépassement capacitaire se fait TOUJOURS sur l'ensemble des projets (comme pour le dépassement budgétaire)
  // et non pas seulement sur les projets affichés via un filtre éventuel.
  const skillsCapacityData = useMemo(() => {
    const result: Record<string, { D: number; P: number; C: number; R: number }> = {};

    skills.forEach((skill) => {
      // 1. D : Demande totale en jours sur l'ensemble de TOUS les projets staffés
      // P : Nombre de projets qui demandent de la capacité sur cette compétence (> 0) ET staffés
      let D = 0;
      let P = 0;
      sortedProjectsByPriority.orderedProjects.forEach((p) => {
        // Seuls les projets effectivement staffés sont pris en compte dans le capacitaire
        if (!isProjectStaffed(p)) return;

        const valStr = getSkillDays(p, skill.id);
        const val = parseFloat(valStr);
        if (!isNaN(val) && val > 0) {
          D += val;
          P += 1;
        }
      });
      D = Math.round(D * 10) / 10;

      // 2. C : Nombre total de jours disponibles de cette compétence sur ce mois
      // C = somme( (jours_ouvrés * ETP) - indisponibilité ) pour toutes les ressources ayant cette compétence clé
      let C = 0;
      (resources || []).forEach((res) => {
        if (res.skillId === skill.id) {
          const fte = typeof res.fte === 'number' && !isNaN(res.fte) ? res.fte : 1.0;
          const unavail = (res.unavailability && typeof res.unavailability[nextMonthKey] === 'number')
            ? res.unavailability[nextMonthKey]
            : 0;
          const avail = (workingDaysNextMonth * fte) - unavail;
          C += Math.max(0, avail);
        }
      });
      C = Math.round(C * 10) / 10;

      // 3. R : Nombre de jours restant disponibles (R = C - D)
      const R = Math.round((C - D) * 10) / 10;

      result[skill.id] = { D, P, C, R };
    });

    return result;
  }, [skills, sortedProjectsByPriority.orderedProjects, localDays, resources, nextMonthKey, workingDaysNextMonth, projectStates, localStaffed]);

  const formatDaysVal = (val: number): string => {
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  };

  // Statistiques globales pour la barre de synthèse
  const stats = useMemo(() => {
    let delayedCount = 0;
    let updatedCount = 0;
    let totalDaysMobilized = 0;

    projects.forEach((p) => {
      const isStaffed = isProjectStaffed(p);
      const m = getProjectMonth(p);
      if (!m || m < nextMonthKey) {
        delayedCount++;
      } else {
        updatedCount++;
      }

      if (isStaffed) {
        skills.forEach((s) => {
          const valStr = getSkillDays(p, s.id);
          const val = parseFloat(valStr);
          if (!isNaN(val) && val > 0) {
            totalDaysMobilized += val;
          }
        });
      }
    });

    return { delayedCount, updatedCount, totalDaysMobilized };
  }, [projects, skills, localMonths, localDays, nextMonthKey, projectStates, localStaffed]);

  // Nombre de projets staffés parmi les projets affichés
  const staffedProjectsCount = useMemo(() => {
    return displayedProjects.filter((p) => isProjectStaffed(p)).length;
  }, [displayedProjects, projectStates, localStaffed]);

  // Nombre total de projets nécessitant une mise à jour pour le mois prochain (pastille de la colonne MOIS MÀJ)
  // Indépendant des filtres appliqués (recherche, cycle de vie, lignes budgétaires, alertes, mes projets).
  // Lorsque les projets confidentiels sont masqués (option décochée), ils ne sont pas pris en compte dans ce décompte.
  const outdatedProjectsCount = useMemo(() => {
    return sortedProjectsByPriority.orderedProjects.filter((p) => {
      const isHidden = Boolean(p.isConfidential) && !canViewConfidential(p);
      if (isHidden) return false;
      return getProjectMonth(p) !== nextMonthKey;
    }).length;
  }, [sortedProjectsByPriority.orderedProjects, canViewConfidential, localMonths, nextMonthKey]);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3">
      {actionSuccess && (
        <div className="shrink-0 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <span>{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* En-tête de section sur le fond de page */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-indigo-600 flex items-center gap-2.5">
            <Gauge className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Capacitaire des projets</span>
          </h2>
          <div className="text-xs text-slate-600 mt-0.5 max-w-3xl leading-relaxed space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Planifiez les besoins en compétences clés pour la période à venir :</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{nextMonthShort}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span>Les projets sont classés selon le numéro de priorité des projets staffés (du n°1 au dernier), puis tous les projets non staffés par ROI décroissant.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de filtres et recherche */}
      <div className="shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Recherche texte */}
          <div className="sm:col-span-2 lg:col-span-3 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par identifiant, nom, chef de projet..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 bg-white"
            />
          </div>

          {/* Filtre État */}
          <div className="sm:col-span-1 lg:col-span-2">
            <LifecycleStateFilter
              projectStates={projectStates}
              selectedStateIds={selectedStateIds}
              onChange={setSelectedStateIds}
            />
          </div>

          {/* Filtre Lignes budgétaires */}
          <div className="sm:col-span-1 lg:col-span-3">
            <BudgetLineFilter
              budgetLines={budgetLines}
              selectedBudgetLineIds={selectedBudgetLineIds}
              onChange={setSelectedBudgetLineIds}
            />
          </div>

          {/* Filtre Les alertes */}
          <div className="sm:col-span-1 lg:col-span-2">
            <AlertsFilter
              filterCapacityOverruns={filterCapacityOverruns}
              filterBudgetOverruns={filterBudgetOverruns}
              onToggleCapacityOverruns={setFilterCapacityOverruns}
              onToggleBudgetOverruns={handleToggleBudgetOverruns}
              onSelectAllProjects={() => {
                setFilterCapacityOverruns(false);
                setFilterBudgetOverruns(false);
              }}
              capacityOverrunCount={bottleneckData.bottleneckProjects.size}
              budgetOverrunCount={budgetOverrunData.overrunProjects.size}
            />
          </div>

          {/* Bouton bascule "Mes projets" */}
          <div className="sm:col-span-1 lg:col-span-2 flex items-center">
            <button
              type="button"
              onClick={() => setMyProjectsOnly(!myProjectsOnly)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                myProjectsOnly
                  ? MY_FILTER_BUTTON_ACTIVE_CLASS
                  : MY_FILTER_BUTTON_INACTIVE_CLASS
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Mes projets</span>
            </button>
          </div>
        </div>

        {/* Ligne inférieure : Boîte de comptage à gauche et case Afficher les projets confidentiels à droite, alignées horizontalement */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                hasActiveFilters
                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                  : 'bg-slate-100 border border-slate-200 text-slate-600'
              }`}
            >
              {hasActiveFilters
                ? `${displayedProjects.length} projet${displayedProjects.length > 1 ? 's' : ''} sur ${projects.length} projet${projects.length > 1 ? 's' : ''} au total`
                : `${projects.length} projet${projects.length > 1 ? 's' : ''} au total`}
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser les filtres</span>
              </button>
            )}
          </div>

          {/* Cases à cocher pour le Value Management Officer alignées horizontalement à droite */}
          {isValueManagementOfficer && (
            <div className="flex items-center gap-4 flex-wrap">
              <label
                htmlFor="vmo-checkbox-show-budget-overruns-capacity"
                className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-semibold text-slate-700 hover:text-slate-900 px-0.5 shrink-0"
              >
                <input
                  type="checkbox"
                  id="vmo-checkbox-show-budget-overruns-capacity"
                  checked={showBudgetOverruns}
                  onChange={(e) => setShowBudgetOverruns(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <span className="text-xs" title="Afficher les dépassements budgétaires">
                  Afficher les aspects budgétaires
                </span>
              </label>

              <label
                htmlFor="vmo-checkbox-show-confidential-capacity"
                className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-semibold text-slate-700 hover:text-slate-900 px-0.5 shrink-0"
              >
                <input
                  type="checkbox"
                  id="vmo-checkbox-show-confidential-capacity"
                  checked={showConfidentialProjects}
                  onChange={(e) => setShowConfidentialProjects(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <span className="text-xs" title="Afficher les projets confidentiels">
                  Afficher les projets confidentiels
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Tableau capacitaire avec colonnes figées à gauche, en-têtes figés en haut et ascenseur vertical dédié à la liste */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden relative z-0">
        <div className="flex-1 min-h-0 overflow-auto [scrollbar-width:thin]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="select-none sticky top-0 z-40 bg-slate-100">
              <tr className="text-slate-700 select-none align-top">
                {/* Colonne 1 : Identifiant (figée à gauche : 0px, top : 0) */}
                <th
                  scope="col"
                  className={`sticky left-0 top-0 bg-slate-100 z-50 px-1 py-2 text-center align-top w-[50px] min-w-[50px] max-w-[50px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                >
                  ID
                </th>

                {/* Colonne 2 : Priorité (figée à gauche : 50px, top : 0) */}
                <th
                  scope="col"
                  className={`sticky left-[50px] top-0 bg-slate-100 z-50 px-1 py-2 text-center align-top w-[52px] min-w-[52px] max-w-[52px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                  title="Priorité du projet selon le ROI décroissant"
                >
                  PRIO.
                </th>

                {/* Colonne 3 : Nom du projet (figée à gauche : 102px, top : 0) */}
                <th
                  scope="col"
                  className={`sticky left-[102px] top-0 bg-slate-100 z-50 px-3 py-2 text-left align-top w-[200px] min-w-[200px] max-w-[200px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                >
                  PROJET
                </th>

                {/* Colonne : Action (figée à gauche : 302px, top : 0) */}
                <th
                  scope="col"
                  className={`sticky left-[302px] top-0 bg-slate-100 z-50 px-1 py-2 text-center align-top w-[50px] min-w-[50px] max-w-[50px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                >
                  ACTION
                </th>

                {/* Colonnes optionnelles affichées uniquement si "Afficher les dépassements budgétaires" est coché */}
                {showBudgetOverruns && (
                  <>
                    {/* Colonne : Ligne budgétaire (figée à gauche : 352px, top : 0) */}
                    <th
                      scope="col"
                      className={`sticky left-[352px] top-0 bg-slate-100 z-50 px-2 py-2 text-center align-top w-[140px] min-w-[140px] max-w-[140px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                    >
                      LIGNE BUDGÉTAIRE
                    </th>

                    {/* Colonne : Budget (figée à gauche : 492px, top : 0) */}
                    <th
                      scope="col"
                      className={`sticky left-[492px] top-0 bg-slate-100 z-50 px-2 py-2 text-center align-top w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                    >
                      <div className="flex flex-col items-center justify-start leading-tight">
                        <span>BUDGET</span>
                        {budgetOverrunData.overrunProjects.size > 0 && (
                          <div className="mt-4">
                            <Tooltip
                              variant="error"
                              placement="bottom"
                              content={`${budgetOverrunData.overrunProjects.size} projet(s) provoqu(ent) un dépassement budgétaire`}
                            >
                              <span
                                className="inline-flex items-center justify-center text-[10px] font-bold text-amber-100 bg-amber-900 border border-amber-950 px-2 py-0.5 rounded-full shadow-2xs whitespace-nowrap normal-case tracking-normal min-w-[18px] cursor-help"
                              >
                                {budgetOverrunData.overrunProjects.size} proj.
                              </span>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </th>
                  </>
                )}

                {/* Colonne 4 : Staffé (figée à gauche : 582px si budget affiché, sinon 352px) */}
                <th
                  scope="col"
                  className={`sticky ${showBudgetOverruns ? 'left-[582px]' : 'left-[352px]'} top-0 bg-slate-100 z-50 px-1 py-2 text-center align-top w-[60px] min-w-[60px] max-w-[60px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                  title="Projets staffés : prise en compte des demandes de compétences clés dans le capacitaire"
                >
                  <div className="flex flex-col items-center justify-start leading-tight">
                    <span>STAFFÉ</span>
                    {bottleneckData.bottleneckProjects.size > 0 && (
                      <div className="mt-4">
                        <Tooltip
                          variant="error"
                          placement="bottom"
                          content={`${bottleneckData.bottleneckProjects.size} projet(s) staffé(s) rencontr(ent) au moins un goulet d'étranglement`}
                        >
                          <span
                            className="inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full shadow-2xs whitespace-nowrap normal-case tracking-normal min-w-[18px] cursor-help"
                          >
                            {bottleneckData.bottleneckProjects.size} proj.
                          </span>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </th>

                {/* Colonne 5 : Mois de mise à jour (figée à gauche : 642px si budget affiché, sinon 412px) - Dernière colonne figée avec double filet vertical */}
                <th
                  scope="col"
                  className={`sticky ${showBudgetOverruns ? 'left-[642px]' : 'left-[412px]'} top-0 bg-slate-100 z-50 px-2 py-2 text-center align-top w-[130px] min-w-[130px] max-w-[130px] ${TABLE_FROZEN_DIVIDER_CLASS} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                  title="Mois de mise à jour"
                >
                  <div className="flex flex-col items-center justify-start leading-tight">
                    <span>MOIS MÀJ</span>
                    {outdatedProjectsCount > 0 && (
                      <div className="mt-4">
                        <Tooltip
                          variant="error"
                          placement="bottom"
                          content={`${outdatedProjectsCount} projet${outdatedProjectsCount > 1 ? 's n\'ont pas été mis' : ' n\'a pas été mis'} à jour de leurs demandes de compétences clé pour la période suivante`}
                        >
                          <span
                            className="inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full shadow-2xs whitespace-nowrap normal-case tracking-normal min-w-[18px] cursor-help"
                          >
                            {outdatedProjectsCount} proj. à màj.
                          </span>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </th>

                {/* Colonnes dynamiques : Une par compétence clé */}
                {skills.length === 0 ? (
                  <th scope="col" className="sticky top-0 z-40 bg-slate-100 px-4 py-3 text-slate-400 italic align-top table-header-double-bottom">
                    Aucune compétence clé déclarée dans les paramètres
                  </th>
                ) : (
                  skills.map((skill) => {
                    const cap = skillsCapacityData[skill.id] || { D: 0, P: 0, C: 0, R: 0 };
                    const isDeficit = cap.R < 0;
                    const shouldAlert = Boolean(skill.alertOnDemandOverrun);
                    const isAlerting = isDeficit && shouldAlert;
                    const missingDaysStr = formatDaysVal(Math.abs(cap.R));
                    const rFormatted = cap.R >= 0 ? `+${formatDaysVal(cap.R)}` : `-${missingDaysStr}`;

                    return (
                      <th
                        key={skill.id}
                        scope="col"
                        className={`sticky top-0 z-40 relative px-2 py-2 text-center align-top border-r border-slate-200 min-w-[135px] transition-colors table-header-double-bottom ${
                          isAlerting ? 'bg-rose-100' : 'bg-slate-100'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-start gap-1 leading-tight">
                          {/* Nom de la compétence : en gras et rouge uniquement en cas d'alerte dépassement */}
                          <span
                            className={`text-xs font-bold truncate max-w-[140px] text-center ${
                              isAlerting ? 'text-red-700' : 'text-slate-800'
                            }`}
                            title={skill.name}
                          >
                            {skill.name}
                          </span>

                          {/* Bulle d'information détaillée sur les chiffres */}
                          <Tooltip
                            variant={isAlerting ? 'error' : 'default'}
                            placement="bottom"
                            maxWidthClass="w-auto"
                            content={
                              isAlerting ? (
                                <div className="text-left text-xs text-white space-y-1 whitespace-nowrap">
                                  <div className="font-bold border-b border-red-400/40 pb-0.5">
                                    Goulet d'étranglement : {skill.name}
                                  </div>
                                  <div className="text-[11px] space-y-0.5 font-normal">
                                    <div>- demande totale : {formatDaysVal(cap.D)} j sur {cap.P} projet(s)</div>
                                    <div>- disponibilité : {formatDaysVal(cap.C)} j ({workingDaysNextMonth} jours ouvrés)</div>
                                    <div className="font-bold">- il manque au total : {missingDaysStr} j</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-left text-xs text-slate-100 space-y-1 whitespace-nowrap">
                                  <div className="font-semibold text-white border-b border-slate-500/40 pb-0.5">
                                    {skill.name} :
                                  </div>
                                  <div className="text-[11px] text-slate-200 space-y-0.5 font-normal">
                                    <div>- demande totale : {formatDaysVal(cap.D)} j sur {cap.P} projet(s)</div>
                                    <div>- disponibilité : {formatDaysVal(cap.C)} j ({workingDaysNextMonth} jours ouvrés)</div>
                                    <div>- reste : {formatDaysVal(cap.R)} j</div>
                                  </div>
                                </div>
                              )
                            }
                          >
                            <div className="flex flex-col items-center justify-start cursor-help">
                              {/* 1ère ligne : "D j / P proj." en police normale (non grasse) et en gris */}
                              <div className="text-xs font-normal text-slate-500 whitespace-nowrap">
                                {formatDaysVal(cap.D)} j / {cap.P} proj.
                              </div>

                              {/* 2ème ligne : "( R j / C j )" en police normale et en gris, sauf R en gras blanc sur fond rouge en cas d'alerte dépassement */}
                              <div className="flex items-center justify-center gap-1 text-xs font-normal text-slate-500 whitespace-nowrap">
                                <span>( </span>
                                {isAlerting ? (
                                  <span className="inline-flex items-center justify-center bg-red-600 text-white font-bold text-[11px] px-1.5 py-0.5 rounded-full shadow-2xs leading-none">
                                    {rFormatted} j
                                  </span>
                                ) : (
                                  <span>{rFormatted} j</span>
                                )}
                                <span> / {formatDaysVal(cap.C)} j )</span>
                              </div>
                            </div>
                          </Tooltip>
                        </div>
                      </th>
                    );
                  })
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={(showBudgetOverruns ? 8 : 6) + Math.max(skills.length, 1)}
                    className="px-6 py-12 text-center text-slate-400 italic"
                  >
                    Chargement des projets et compétences capacitaires...
                  </td>
                </tr>
              ) : displayedProjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={(showBudgetOverruns ? 8 : 6) + Math.max(skills.length, 1)}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <div className="max-w-md mx-auto space-y-2">
                      <Gauge className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700">Aucun projet trouvé</p>
                      <p className="text-xs text-slate-500">
                        {myProjectsOnly || isAlertFilterActive || isStateFilterActive
                          ? "Aucun projet ne correspond aux filtres appliqués."
                          : "Déclarez des projets dans l'onglet Priorités pour planifier leurs compétences capacitaires."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedProjects.map((project, projectIndex) => {
                  const rank = sortedProjectsByPriority.rankMap.get(project.id);
                  const isConfidentialHidden =
                    Boolean(project.isConfidential) && !canViewConfidential(project);
                  const userCanEditCapacity = canEditProjectCapacity(project);

                  const monthVal = getProjectMonth(project);
                  const isDelayed = !monthVal || monthVal < nextMonthKey;
                  const isUpdatedForNextMonth = monthVal === nextMonthKey;

                  const stateObj = projectStates.find((st) => st.id === project.stateId);
                  const stateNeedsStaffing = Boolean(stateObj?.needsStaffing);
                  const currentStateName = stateObj?.name || project.stateName || 'actuel';
                  const isStaffed = isProjectStaffed(project);
                  const canEditCell = userCanEditCapacity && isStaffed;
                  const canToggleStaffing = canToggleProjectStaffing(project);
                  const isProjectBottlenecked = isStaffed && bottleneckData.bottleneckProjects.has(project.id);

                  return (
                    <tr
                      key={project.id}
                      className={`transition-colors group ${
                        openMonthDropdownId === project.id ? 'relative z-40' : 'relative z-0'
                      } ${
                        isStaffed
                          ? 'bg-white hover:bg-slate-50/80 text-slate-900'
                          : 'bg-slate-100/70 hover:bg-slate-100/90 text-slate-400'
                      }`}
                      style={
                        openMonthDropdownId === project.id
                          ? { position: 'relative', zIndex: 45 }
                          : undefined
                      }
                    >
                      {/* Colonne 1 : Identifiant (figée à gauche : 0px) */}
                      <td className={`sticky left-0 z-20 px-1 py-2 text-center whitespace-nowrap w-[50px] min-w-[50px] max-w-[50px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                        isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-100 group-hover:bg-slate-200/90'
                      }`}>
                        <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-full shadow-2xs ${
                          isStaffed ? 'bg-slate-900 text-white' : 'bg-slate-400 text-white'
                        }`}>
                          #{project.projectNumber}
                        </span>
                      </td>

                      {/* Colonne 2 : Priorité (figée à gauche : 50px) */}
                      <td className={`sticky left-[50px] z-20 px-1 py-2 text-center whitespace-nowrap w-[52px] min-w-[52px] max-w-[52px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                        isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-100 group-hover:bg-slate-200/90'
                      }`}>
                        {isStaffed && rank !== undefined ? (
                          <span
                            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded inline-block min-w-[20px] bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                            title={`Priorité #${rank} (Projet staffé)`}
                          >
                            {rank}
                          </span>
                        ) : (
                          <span
                            className="text-slate-300 font-mono"
                            title={!isStaffed ? 'Projet non staffé : pas de numéro de priorité' : 'Critères non valorisés'}
                          >
                            -
                          </span>
                        )}
                      </td>

                      {/* Colonne 3 : Nom du projet (figée à gauche : 102px) */}
                      <td className={`sticky left-[102px] z-20 hover:z-30 px-3 py-2 w-[200px] min-w-[200px] max-w-[200px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                        isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-100 group-hover:bg-slate-200/90'
                      }`}>
                        {isConfidentialHidden ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-100 text-red-600 border border-red-300 px-2.5 py-1 rounded-md shadow-2xs select-none"
                            title="Projet confidentiel (accès restreint)"
                          >
                            <Lock className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>CONFIDENTIEL</span>
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-bold text-xs truncate max-w-[150px] ${
                                  isStaffed ? 'text-slate-900' : 'text-slate-500'
                                }`}
                                title={project.name}
                              >
                                {project.name}
                              </span>
                              {project.isConfidential && (
                                <span
                                  className="inline-flex items-center justify-center p-1 rounded-md bg-rose-50 border border-red-300 text-red-600 shadow-2xs shrink-0"
                                  title="Projet confidentiel"
                                >
                                  <Lock className="w-3.5 h-3.5 text-red-600" />
                                </span>
                              )}
                              {/* Petit pictogramme gris en forme de point d'interrogation dans un cercle */}
                              <Tooltip
                                content={
                                  <div>
                                    <div className="text-[10px] font-semibold text-slate-200 uppercase tracking-wider mb-1 flex items-center justify-between gap-4">
                                      <span>Description du projet</span>
                                      {project.isConfidential && (
                                        <span className="text-rose-200 flex items-center gap-1 font-medium normal-case">
                                          <Lock className="w-2.5 h-2.5" />
                                          Confidentiel
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-white text-xs">
                                      {project.description?.trim() || (
                                        <span className="italic text-slate-300">Aucune description renseignée</span>
                                      )}
                                    </div>
                                  </div>
                                }
                                placement="right"
                                maxWidthClass="w-72"
                                className="relative inline-flex items-center shrink-0 cursor-help"
                              >
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                              </Tooltip>
                            </div>
                            {currentStateName && (
                              <span className={`text-[10px] truncate max-w-[190px] ${
                                isStaffed ? 'text-slate-500' : 'text-slate-400'
                              }`}>
                                {currentStateName}
                                {!stateNeedsStaffing && !isStaffed && ' (non staffable)'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Colonne : Action (figée à gauche : 302px) */}
                      <td
                        className={`sticky left-[302px] z-20 px-1 py-2 text-center whitespace-nowrap w-[50px] min-w-[50px] max-w-[50px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                          isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-100 group-hover:bg-slate-200/90'
                        }`}
                      >
                        <ProjectActionButton
                          project={project}
                          permissionContext={permissionContext}
                          onOpenProject={(proj, isReadOnly) => {
                            setSelectedProject(proj);
                            setIsReadOnlyModal(isReadOnly);
                            setModalOpen(true);
                          }}
                          showDelete={false}
                        />
                      </td>

                      {/* Colonnes optionnelles : Ligne budgétaire et Budget */}
                      {showBudgetOverruns && (() => {
                        const bl = budgetLines.find((b) => b.id === project.budgetLineId);
                        const isBudgetOverrun = budgetOverrunData.overrunProjects.has(project.id);
                        const budgetDetail = isBudgetOverrun ? budgetOverrunData.details.get(project.id) : null;

                        return (
                          <>
                            {/* Colonne : Ligne budgétaire (figée à gauche : 352px) */}
                            <td
                              className={`sticky left-[352px] z-20 px-2.5 py-2 whitespace-nowrap w-[140px] min-w-[140px] max-w-[140px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] text-xs ${
                                isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-100 group-hover:bg-slate-200/90'
                              }`}
                            >
                              {isConfidentialHidden ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  <Lock className="w-2.5 h-2.5 text-red-600 shrink-0" />
                                  <span>Confidentiel</span>
                                </span>
                              ) : (
                                <div
                                  className="flex items-center gap-1.5 truncate"
                                  title={bl ? `${bl.name} (${bl.budgetKe} K€)` : 'Aucune ligne budgétaire rattachée'}
                                >
                                  {bl?.color && (
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 shadow-2xs"
                                      style={{ backgroundColor: bl.color }}
                                    />
                                  )}
                                  <span className={`truncate text-xs ${isStaffed ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                                    {bl ? bl.name : <span className="italic text-slate-400">Non définie</span>}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Colonne : Budget (figée à gauche : 492px) */}
                            <td
                              className={`sticky left-[492px] z-20 px-2 py-2 text-center whitespace-nowrap w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                                isStaffed
                                  ? 'bg-white group-hover:bg-slate-50/80'
                                  : 'bg-slate-100 group-hover:bg-slate-200/90'
                              }`}
                            >
                              {isConfidentialHidden ? (
                                <span className="text-slate-400 font-mono text-xs">-</span>
                              ) : isBudgetOverrun ? (
                                <Tooltip
                                  variant="error"
                                  placement="top"
                                  content={
                                    <div className="space-y-0.5 text-xs">
                                      <div className="font-bold">
                                        Dépassement budgétaire sur « {budgetDetail?.lineName} »
                                      </div>
                                      <div className="text-[11px] font-normal space-y-0.5">
                                        <div>• Budget alloué à la ligne : {budgetDetail?.lineAllocated} K€</div>
                                        <div>• Cumul des projets prioritaires : {budgetDetail?.cumulativeTotal} K€</div>
                                        <div>• Dépassement provoqué : +{budgetDetail?.overrunAmount} K€</div>
                                      </div>
                                    </div>
                                  }
                                >
                                  <div
                                    className="inline-flex items-center justify-center font-bold text-amber-950 bg-yellow-200 border border-amber-600 rounded px-2 py-0.5 text-xs shadow-2xs cursor-help select-none"
                                  >
                                    <span>{project.estimatedBudget ?? 0} K€</span>
                                  </div>
                                </Tooltip>
                              ) : (
                                <span className={`text-xs ${isStaffed ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                                  {project.estimatedBudget !== undefined && project.estimatedBudget !== null ? `${project.estimatedBudget} K€` : '0 K€'}
                                </span>
                              )}
                            </td>
                          </>
                        );
                      })()}

                      {/* Colonne 4 : Staffé (figée à gauche : 582px si budget affiché, sinon 352px) */}
                      <td
                        className={`sticky ${showBudgetOverruns ? 'left-[582px]' : 'left-[352px]'} z-20 px-1 py-2 text-center whitespace-nowrap w-[60px] min-w-[60px] max-w-[60px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                          !isStaffed
                            ? 'bg-slate-100 group-hover:bg-slate-200/90'
                            : isProjectBottlenecked
                            ? 'bg-rose-100 group-hover:bg-rose-200/80'
                            : 'bg-white group-hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          {isStaffed && !stateNeedsStaffing ? (
                            <Tooltip
                              variant="error"
                              placement="top"
                              content={
                                <div className="text-left text-xs whitespace-normal max-w-xs font-bold leading-snug">
                                  Ce projet ne devrait pas mobiliser de compétences clé car il est dans un état ({currentStateName}) qui ne nécessite pas de le staffer
                                </div>
                              }
                            >
                              <input
                                type="checkbox"
                                checked={isStaffed}
                                disabled={!canToggleStaffing}
                                onChange={() => handleToggleStaffing(project)}
                                className="w-4 h-4 rounded transition-colors border-red-500 text-red-600 focus:ring-red-500 accent-red-600 cursor-pointer"
                              />
                            </Tooltip>
                          ) : isStaffed && isProjectBottlenecked ? (
                            <Tooltip
                              variant="error"
                              placement="top"
                              content={
                                <div className="text-left text-xs whitespace-normal max-w-xs space-y-0.5">
                                  <div className="font-bold">Goulet d'étranglement capacitaire</div>
                                  <div className="text-[11px] font-normal">
                                    Ce projet a des demandes de jours sur des compétences clés qui ne pourront pas être totalement honorées car les projets plus prioritaires ont déjà consommé la capacité disponible.
                                  </div>
                                </div>
                              }
                            >
                              <input
                                type="checkbox"
                                checked={isStaffed}
                                disabled={!canToggleStaffing}
                                onChange={() => handleToggleStaffing(project)}
                                className={`w-4 h-4 rounded transition-colors border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 ${
                                  canToggleStaffing ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
                                }`}
                              />
                            </Tooltip>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isStaffed}
                              disabled={!canToggleStaffing}
                              onChange={() => handleToggleStaffing(project)}
                              className={`w-4 h-4 rounded transition-colors ${
                                !stateNeedsStaffing && !canToggleStaffing
                                  ? 'opacity-30 cursor-not-allowed bg-slate-200'
                                  : canToggleStaffing
                                  ? 'cursor-pointer'
                                  : 'opacity-60 cursor-not-allowed'
                              } border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600`}
                              title={
                                !stateNeedsStaffing
                                  ? canToggleStaffing
                                    ? `L'état de ce projet (« ${currentStateName} ») ne réclame normalement pas d'être staffé. En tant que Value Management Officer, vous pouvez cocher pour le staffer.`
                                    : `L'état de ce projet (« ${currentStateName} ») n'a pas l'attribut « à staffer » coché.`
                                  : !canToggleStaffing
                                  ? isPersonaAdmin
                                    ? "Les persona Administrateur n'ont pas le droit de cocher / décocher cette case."
                                    : isStaffed
                                    ? 'Projet staffé (Modification non autorisée)'
                                    : 'Projet non staffé (Modification non autorisée)'
                                  : isStaffed
                                  ? 'Projet staffé : cliquer pour décocher et exclure du staffing'
                                  : 'Projet non staffé : cliquer pour cocher et reprendre en compte les demandes de compétences clés'
                              }
                            />
                          )}
                        </div>
                      </td>

                      {/* Colonne 5 : Mois de mise à jour (figée à gauche : 642px si budget affiché, sinon 412px) */}
                      <td
                        className={`sticky ${showBudgetOverruns ? 'left-[642px]' : 'left-[412px]'} ${
                          openMonthDropdownId === project.id ? 'z-50' : 'z-20'
                        } px-1.5 py-2 text-center whitespace-nowrap w-[130px] min-w-[130px] max-w-[130px] ${TABLE_FROZEN_DIVIDER_CLASS} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                          isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-100 group-hover:bg-slate-200/90'
                        }`}
                        style={
                          openMonthDropdownId === project.id
                            ? { zIndex: 50 }
                            : undefined
                        }
                      >
                        <div className={`relative inline-block month-dropdown-container ${openMonthDropdownId === project.id ? 'z-50' : ''}`}>
                          {userCanEditCapacity ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMonthDropdownId((prev) =>
                                  prev === project.id ? null : project.id
                                );
                              }}
                              title={
                                isUpdatedForNextMonth
                                  ? `À jour pour ${nextMonthShort}. Cliquer pour modifier.`
                                  : `Cliquer pour ouvrir le choix et mettre à jour pour ${nextMonthShort}`
                              }
                              className={`cursor-pointer transition-transform hover:scale-105 ${!isStaffed ? 'opacity-75' : ''}`}
                            >
                              {isUpdatedForNextMonth ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold shadow-2xs ${
                                  isStaffed
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{nextMonthShort}</span>
                                </span>
                              ) : !monthVal ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${
                                  isStaffed
                                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                                    : 'bg-slate-200 text-slate-500 border-slate-300'
                                }`}>
                                  ???
                                </span>
                              ) : (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${
                                  isStaffed
                                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                                    : 'bg-slate-200 text-slate-500 border-slate-300'
                                }`}>
                                  {formatMonthKey(monthVal)}
                                </span>
                              )}
                            </button>
                          ) : (
                            /* En lecture seule pour les utilisateurs non autorisés */
                            <div title="Modification non autorisée : seuls le Super User, le Chef de projet et son adjoint peuvent mettre à jour le mois.">
                              {isUpdatedForNextMonth ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold shadow-2xs opacity-80 ${
                                  isStaffed
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{nextMonthShort}</span>
                                </span>
                              ) : !monthVal ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-500 border border-slate-300 shadow-2xs opacity-80">
                                  ???
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-500 border border-slate-300 shadow-2xs opacity-80">
                                  {formatMonthKey(monthVal)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Liste de choix du mois : au premier plan absolu avec élévation et positionnement fluide */}
                          {userCanEditCapacity && openMonthDropdownId === project.id && (
                            <div className={`absolute left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 rounded-lg shadow-2xl py-1.5 px-1.5 min-w-[185px] whitespace-nowrap ring-2 ring-indigo-500/10 animate-in fade-in zoom-in-95 ${
                              projectIndex >= 2 && projectIndex >= displayedProjects.length - 2
                                ? 'bottom-full mb-1.5'
                                : 'top-full mt-1.5'
                            }`}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateMonth(project, nextMonthKey);
                                  setOpenMonthDropdownId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 rounded flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>à jour pour {nextMonthShort}</span>
                              </button>
                              {isUpdatedForNextMonth && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateMonth(project, null);
                                    setOpenMonthDropdownId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded flex items-center gap-2 cursor-pointer transition-colors mt-0.5 border-t border-slate-100 pt-1"
                                >
                                  <RotateCcw className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>Réinitialiser (???)</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Colonnes de compétences clés : Saisie des jours de mobilisation */}
                      {skills.map((skill) => {
                        const cellVal = getSkillDays(project, skill.id);
                        const numVal = cellVal !== '' ? parseFloat(cellVal) : 0;
                        const hasDays = numVal > 0;
                        const cellKey = `${project.id}_${skill.id}`;
                        const isCellBottleneck = isStaffed && bottleneckData.bottleneckCells.has(cellKey);
                        const cellDetail = isCellBottleneck ? bottleneckData.cellDetails.get(cellKey) : null;

                        const inputElement = (
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={!canEditCell}
                            value={cellVal}
                            placeholder={isStaffed ? '0' : '-'}
                            onChange={(e) =>
                              handleSkillDaysChange(project, skill.id, e.target.value)
                            }
                            className={`w-full text-center px-1.5 py-1 text-xs rounded transition-all ${
                              !isStaffed
                                ? 'text-slate-300 bg-transparent border border-transparent cursor-not-allowed'
                                : isCellBottleneck
                                ? 'font-bold text-red-700 bg-rose-100 border border-rose-300 hover:border-red-400 focus:border-red-600 focus:bg-white focus:text-red-800 focus:outline-none focus:ring-1 focus:ring-red-600 shadow-2xs'
                                : hasDays
                                ? 'font-bold text-slate-900 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600'
                                : 'text-slate-400 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600'
                            } disabled:bg-transparent disabled:cursor-not-allowed`}
                            title={
                              !isStaffed
                                ? !stateNeedsStaffing
                                  ? `Saisie désactivée : l'état du projet (« ${project.stateName || ''} ») n'est pas à staffer.`
                                  : 'Saisie désactivée : projet non staffé (cochez la case Staffé pour réactiver).'
                                : !isCellBottleneck
                                ? !userCanEditCapacity
                                  ? `Modification non autorisée : seuls le Super User, le Chef de projet et son adjoint peuvent modifier les jours demandés.`
                                  : `${isConfidentialHidden ? 'Projet confidentiel' : project.name} - ${skill.name} : ${cellVal || '0'} j prévus sur ${nextMonthLabel}`
                                : undefined
                            }
                          />
                        );

                        return (
                          <td
                            key={skill.id}
                            className={`p-1 text-center border-r border-slate-200 transition-colors ${
                              !isStaffed ? 'bg-slate-50/60' : ''
                            }`}
                          >
                            {isCellBottleneck ? (
                              <Tooltip
                                variant="error"
                                placement="top"
                                maxWidthClass="w-auto"
                                content={
                                  <div className="text-left text-xs whitespace-normal max-w-xs space-y-1">
                                    <div className="font-bold border-b border-red-400/50 pb-0.5">
                                      Goulet d'étranglement : {skill.name}
                                    </div>
                                    <div className="text-[11px] space-y-0.5 font-normal">
                                      <div>• Demande de ce projet : <span className="font-bold">{cellVal} j</span></div>
                                      <div>• Capacité disponible : {cellDetail?.capacity ?? 0} j</div>
                                      <div>• Restant après projets prioritaires : {cellDetail?.availableBefore ?? 0} j</div>
                                      <div className="font-bold">• Déficit non satisfait : {cellDetail?.deficit ?? 0} j</div>
                                    </div>
                                    {!userCanEditCapacity && (
                                      <div className="text-[10px] italic opacity-90 pt-0.5">
                                        (Modification non autorisée)
                                      </div>
                                    )}
                                  </div>
                                }
                              >
                                {inputElement}
                              </Tooltip>
                            ) : (
                              inputElement
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Projet (Consultation / Modification) */}
      <ProjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        projectToEdit={selectedProject}
        currentUserEmail={activeUser?.email || ''}
        isReadOnly={isReadOnlyModal}
        projectStates={projectStates}
        budgetLines={budgetLines}
        criteria={criteria}
        customParams={customParams}
        users={users}
        bonusConfig={bonusConfig}
        onSuccess={(saved) => {
          setActionSuccess(
            selectedProject
              ? `Projet #${saved?.projectNumber || selectedProject.projectNumber} mis à jour avec succès.`
              : `Nouveau projet #${saved?.projectNumber || ''} créé avec succès.`
          );
          setTimeout(() => setActionSuccess(null), 4000);
        }}
      />
    </div>
  );
};
