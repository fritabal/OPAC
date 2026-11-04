import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  ChevronDown,
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
import {
  updateProjectCapacity,
  updateProjectStaffing,
  checkAndAutoArchiveCapacity,
  updateProjectRat,
  updateProjectPeriodDemands,
} from '../services/projectService';
import { isSuperAdminEmail } from '../services/userService';
import { getWorkingDaysInMonth, roundToHalfDay, calculateResourceAvailability } from '../utils/workingDays';
import {
  MY_FILTER_BUTTON_ACTIVE_CLASS,
  MY_FILTER_BUTTON_INACTIVE_CLASS,
  TABLE_HEADER_TEXT_CLASS,
  TABLE_HEADER_FONT_SIZE_CLASS,
  TABLE_HEADER_FONT_WEIGHT_CLASS,
  TABLE_HEADER_TEXT_COLOR_CLASS,
  CAPACITY_SKILL_COL_WIDTH_CLASS,
  TABLE_FROZEN_DIVIDER_CLASS,
  CHECKBOX_INPUT_CLASS,
  CHECKBOX_TITLE_CLASS,
  CHECKBOX_CONTAINER_CLASS,
  TOOLTIP_TEXT_SIZE_CLASS,
  TOOLTIP_TEXT_WEIGHT_CLASS,
  TOOLTIP_MAX_WIDTH_CLASS,
  TAB_TITLE_CLASS,
  SEGMENT_SELECTOR_CONTAINER_CLASS,
  getSegmentSelectorButtonClass,
} from '../constants/ui';
import { Tooltip } from './Tooltip';
import { ProjectModal } from './ProjectModal';
import { ProjectCapacityHistoryModal } from './ProjectCapacityHistoryModal';
import { ProjectStaffingPlanModal } from './ProjectStaffingPlanModal';
import {
  ProjectPermissionContext,
  canViewConfidentialProject,
  canEditProject,
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
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

import {
  formatPeriodLocale,
  normalizePeriodKey,
  getNextPeriodInfo,
} from '../utils/dateUtils';

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
  searchQuery: searchQueryProp,
  setSearchQuery: setSearchQueryProp,
}) => {
  const { t, i18n } = useTranslation();
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = searchQueryProp !== undefined ? searchQueryProp : internalSearchQuery;
  const setSearchQuery = setSearchQueryProp || setInternalSearchQuery;
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  const [filterCapacityOverruns, setFilterCapacityOverruns] = useState(false);
  const [filterBudgetOverruns, setFilterBudgetOverruns] = useState(false);
  const [filterOutdatedStaffingDemands, setFilterOutdatedStaffingDemands] = useState(false);
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

  const isAlertFilterActive =
    filterCapacityOverruns || filterBudgetOverruns || filterOutdatedStaffingDemands;

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

  // Gestion de la modal d'historique capacitaire
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyProject, setHistoryProject] = useState<Project | null>(null);

  // Gestion de la modal de plan de staffing prévisionnel (12 mois glissants & RAT)
  const [staffingPlanModalOpen, setStaffingPlanModalOpen] = useState(false);
  const [staffingPlanProject, setStaffingPlanProject] = useState<Project | null>(null);

  // Auto-archivage des demandes du mois écoulé lorsqu'on bascule sur un nouveau mois
  useEffect(() => {
    if (projects.length > 0 && skills.length > 0) {
      checkAndAutoArchiveCapacity(projects, skills.map((s) => s.id)).catch((err) => {
        console.error('Erreur auto-archivage capacitaire:', err);
      });
    }
  }, [projects, skills]);

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

  // Clé du mois courant (M) au format "YYYY-MM"
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Définition dynamique et internationalisée du "mois prochain" (le mois à venir)
  const { nextMonthKey, nextMonthLabel, nextMonthShort, nextMonthYear, nextMonthMonth } = useMemo(() => {
    const info = getNextPeriodInfo(new Date(), i18n.language);
    return {
      nextMonthKey: info.key,
      nextMonthLabel: info.longLabel,
      nextMonthShort: info.shortLabel,
      nextMonthYear: info.year,
      nextMonthMonth: info.month,
    };
  }, [i18n.language]);

  // Nombre de jours ouvrés pour le mois prochain (du lundi au vendredi hors jours fériés légaux français)
  const workingDaysNextMonth = useMemo(() => {
    return getWorkingDaysInMonth(nextMonthYear, nextMonthMonth);
  }, [nextMonthYear, nextMonthMonth]);

  // Liste des options de période : mois en cours + 12 prochains mois (13 mois au total)
  const periodOptions = useMemo(() => {
    const list: { key: string; label: string; year: number; month: number }[] = [];
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();

    for (let i = 0; i < 13; i++) {
      const d = new Date(currYear, currMonth + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const rawLabel = d.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
      const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
      list.push({ key, label, year, month });
    }
    return list;
  }, [i18n.language]);

  // Clés de stockage local pour persister la période et l'horizon lors des changements d'onglets
  const STORAGE_KEY_SELECTED_PERIOD = 'capacity_table_selected_period';
  const STORAGE_KEY_RAT_HORIZON = 'capacity_table_rat_horizon';

  // Période sélectionnée : mémorisée dans localStorage pour persister entre onglets
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SELECTED_PERIOD);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return nextMonthKey;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SELECTED_PERIOD, selectedPeriod);
    } catch {
      // ignore
    }
  }, [selectedPeriod]);

  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown lors d'un clic extérieur ou Échap
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPeriodDropdownOpen(false);
      }
    };
    if (isPeriodDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPeriodDropdownOpen]);

  // Horizon de capacité pour l'option "A terminaison" (3 mois, 6 mois, 12 mois) : mémorisé dans localStorage
  const [ratHorizon, setRatHorizon] = useState<3 | 6 | 12>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RAT_HORIZON);
      if (saved === '3' || saved === '6' || saved === '12') {
        return parseInt(saved, 10) as 3 | 6 | 12;
      }
    } catch {
      // ignore
    }
    return 3;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RAT_HORIZON, String(ratHorizon));
    } catch {
      // ignore
    }
  }, [ratHorizon]);

  // Réinitialiser les modifications locales temporaires lors d'un changement de période sélectionnée
  useEffect(() => {
    setLocalDays({});
  }, [selectedPeriod]);

  // Libellé d'affichage de la période sélectionnée
  const selectedPeriodLabel = useMemo(() => {
    if (selectedPeriod === 'rat') {
      return t('capacity.at_completion');
    }
    const found = periodOptions.find((p) => p.key === selectedPeriod);
    if (found) return found.label;
    return formatPeriodLocale(selectedPeriod, i18n.language, {
      format: 'short',
      fallback: selectedPeriod,
    });
  }, [selectedPeriod, periodOptions, i18n.language, t]);

  // Libellé pour la boîte d'en-tête de la colonne "À JOUR" :
  // - Pour "rat" : "à terminaison" in extenso et en minuscules
  // - Pour un mois : le mois court avec année (ex. "Nov. 2026")
  const truncatedPeriodLabel = useMemo(() => {
    if (selectedPeriod === 'rat') {
      return t('capacity.at_completion_lower', 'à terminaison');
    }
    const shortStr = formatPeriodLocale(selectedPeriod, i18n.language, {
      format: 'short',
      fallback: selectedPeriod,
    });
    return shortStr.charAt(0).toUpperCase() + shortStr.slice(1);
  }, [selectedPeriod, i18n.language, t]);

  const formatMonthKey = (key?: string | null): string => {
    if (!key) return t('capacity.status.not_defined');
    return formatPeriodLocale(key, i18n.language, {
      format: 'short',
      fallback: key,
    });
  };

  // Droits pour modifier le nombre de jours demandé sur les compétences clés :
  // - Seul le Super User, OU le Chef du projet considéré, OU son adjoint ont le droit.
  // - Y compris pour les projets confidentiels.
  // - Ni la persona Administrateur, ni le Value Management Officer (sauf s'ils sont PM/Adjoint sur ce projet ou Super User),
  //   ni un utilisateur sans rôle sur ce projet ne peuvent modifier ces données.
  const canEditProjectCapacity = (p: Project): boolean => {
    // 1. Super User (respecte l'endossement de rôle / simulation)
    if (isSuperUser) return true;
    if (!effectiveRole && activeUser?.email && isSuperAdminEmail(activeUser.email)) {
      return true;
    }
    if (activeUser) {
      const uEmail = (activeUser.email || '').toLowerCase().trim();
      const uId = (activeUser.id || '').toLowerCase().trim();
      // 2. Chef de projet ou adjoint du projet considéré
      const pm = (p.projectManagerEmail || '').toLowerCase().trim();
      const dep = (p.deputyEmail || '').toLowerCase().trim();
      if (
        (uEmail && (uEmail === pm || uEmail === dep)) ||
        (uId && (uId === pm || uId === dep))
      ) {
        return true;
      }
    }
    return false;
  };

  // Droits pour modifier la colonne "MOIS MAJ" :
  // Uniquement lorsque l'utilisateur est le Chef du projet considéré, ou Super User.
  const canEditProjectMonth = (p: Project): boolean => {
    // 1. Super User (respecte l'endossement de rôle / simulation)
    if (isSuperUser) return true;
    if (!effectiveRole && activeUser?.email && isSuperAdminEmail(activeUser.email)) {
      return true;
    }

    // 2. Chef du projet considéré (titulaire uniquement)
    if (activeUser) {
      const uEmail = (activeUser.email || '').toLowerCase().trim();
      const uId = (activeUser.id || '').toLowerCase().trim();
      const pmEmail = (p.projectManagerEmail || '').toLowerCase().trim();
      if ((uEmail && pmEmail && uEmail === pmEmail) || (uId && pmEmail && uId === pmEmail)) {
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
  // - Règle impérative : Interdire de staffer un projet qui n'est pas priorisé (état non coché "à prioriser")
  // - Les persona Administrateur ne doivent PAS avoir le droit de cocher / décocher cette case
  // - En tant que Value Management Officer (ou Super User), droit accordé pour TOUS les projets dont l'état est à prioriser
  // - Pour le Chef de projet ou son adjoint : autorisé sur ses propres projets priorisés (s'il y a accès et état à staffer)
  const canToggleProjectStaffing = (p: Project): boolean => {
    // Interdire de staffer un projet qui n'est pas priorisé
    if (!isProjectStatePrioritized(p.stateId)) {
      return false;
    }

    // Règle explicite : les persona Administrateur ne doivent pas avoir le droit de cocher / décocher cette case
    if (isPersonaAdmin) {
      return false;
    }

    // Le Value Management Officer (et le super user) sont autorisés à cocher / décocher tous les projets priorisés
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
    // Règle impérative : un projet non priorisé ne peut jamais être staffé
    if (!isProjectStatePrioritized(p.stateId)) {
      return false;
    }

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
    if (!isProjectStatePrioritized(project.stateId)) return;
    if (!canToggleProjectStaffing(project)) return;

    const currentlyStaffed = isProjectStaffed(project);
    const nextVal = !currentlyStaffed;

    setLocalStaffed((prev) => ({
      ...prev,
      [project.id]: nextVal,
    }));

    try {
      await updateProjectStaffing(project.id, nextVal, project.name);
    } catch (err) {
      console.error('Erreur mise à jour staffing projet:', err);
    }
  };

  // Tri des projets selon les règles de priorisation :
  // - Tous les projets ont leur ROI calculé en permanence quel que soit leur état
  // - Le numéro de priorité (1 à N) n'est calculé QUE pour les états cochés "à prioriser"
  // - Les projets sont ordonnés avec les projets à prioriser selon leur priorité (du numéro 1 au dernier),
  //   puis tous les projets non priorisés par ordre décroissant de ROI
  const sortedProjectsByPriority = useMemo(() => {
    const list = projects.map((p) => {
      const calculatedRoi = calculateProjectRoi(
        p.criteriaValues,
        criteria,
        true, // recalculé quel que soit l'état du projet
        p.bonus,
        bonusConfig?.isBonusActive ?? true
      );
      const isPrioritized = isProjectStatePrioritized(p.stateId);
      const isStaffed = isProjectStaffed(p);
      return {
        project: p,
        roi: calculatedRoi,
        isPrioritized,
        isStaffed,
        projectNumber: p.projectNumber || 0,
      };
    });

    // 1. Projets dont l'état est à prioriser
    const prioritizedList = list.filter((item) => item.isPrioritized);
    prioritizedList.sort((a, b) => {
      if (a.roi === null && b.roi === null) return a.projectNumber - b.projectNumber;
      if (a.roi === null) return 1;
      if (b.roi === null) return -1;
      const diff = b.roi - a.roi;
      if (diff !== 0) return diff;
      return a.projectNumber - b.projectNumber;
    });

    // Numérotation de la priorité uniquement sur les projets dont l'état est à prioriser avec ROI calculé
    const rankMap = new Map<string, number>();
    prioritizedList.forEach((item, index) => {
      if (item.roi !== null) {
        rankMap.set(item.project.id, index + 1);
      }
    });

    // 2. Projets dont l'état n'est pas à prioriser (triés par ordre décroissant de ROI)
    const nonPrioritizedList = list.filter((item) => !item.isPrioritized);
    nonPrioritizedList.sort((a, b) => {
      if (a.roi === null && b.roi === null) return a.projectNumber - b.projectNumber;
      if (a.roi === null) return 1;
      if (b.roi === null) return -1;
      const diff = b.roi - a.roi;
      if (diff !== 0) return diff;
      return a.projectNumber - b.projectNumber;
    });

    // 3. Concaténation : projets à prioriser (priorité 1 au dernier), puis projets non priorisés par ROI décroissant
    const orderedProjects = [
      ...prioritizedList.map((i) => i.project),
      ...nonPrioritizedList.map((i) => i.project),
    ];

    return { orderedProjects, rankMap };
  }, [projects, criteria, bonusConfig, localStaffed, projectStates]);

  // Récupération de la valeur locale ou distante du mois de mise à jour normalisée (language-independent "YYYY-MM")
  const getProjectMonth = (p: Project): string | null => {
    let rawVal: string | null = null;
    if (localMonths[p.id] !== undefined) {
      rawVal = localMonths[p.id];
    } else {
      rawVal = p.capacityUpdatedMonth || null;
    }
    if (!rawVal) return null;
    return normalizePeriodKey(rawVal) || rawVal;
  };

  const formatDaysVal = (val: number): string => {
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  };

  // Récupération de la valeur locale ou distante des jours mobilisés pour une compétence et pour la période sélectionnée
  const getSkillDays = (p: Project, skillId: string): string => {
    const localVal = localDays[p.id]?.[skillId];
    if (localVal !== undefined) {
      return localVal === null ? '' : String(localVal);
    }
    if (selectedPeriod === 'rat') {
      const storedRat = p.remainingToComplete?.[skillId];
      if (storedRat !== undefined && storedRat !== null && storedRat > 0) {
        return formatDaysVal(storedRat);
      }
      return '';
    }
    // Période mensuelle
    const staffingPlanVal = p.staffingPlan?.[selectedPeriod]?.[skillId];
    if (staffingPlanVal !== undefined && staffingPlanVal !== null && staffingPlanVal > 0) {
      return formatDaysVal(staffingPlanVal);
    }
    if (selectedPeriod === nextMonthKey) {
      const storedVal = p.capacityDaysPerSkill?.[skillId];
      if (storedVal !== undefined && storedVal !== null && storedVal > 0) {
        return formatDaysVal(storedVal);
      }
    }
    return '';
  };

  // Calcul des goulets d'étranglement par compétence et par projet :
  // Les projets sont évalués selon leur ordre strict de priorité (ROI décroissant).
  // Seuls les projets effectivement staffés (isProjectStaffed) consomment de la bande passante.
  // Pour chaque compétence clé, si la demande cumulée des projets plus prioritaires et du projet courant
  // dépasse la capacité totale disponible C sur la période sélectionnée, la demande ne peut pas être totalement honorée.
  const bottleneckData = useMemo(() => {
    const bottleneckCells = new Set<string>();
    const bottleneckProjects = new Set<string>();
    const cellDetails = new Map<string, {
      requested: number;
      availableBefore: number;
      capacity: number;
      deficit: number;
      projectDeficit?: number;
    }>();

    // Capacités disponibles C par compétence (arrondies à 0,5 près) pour la période sélectionnée
    const capacityBySkill: Record<string, number> = {};
    if (selectedPeriod === 'rat') {
      const horizonMonths = periodOptions.slice(0, ratHorizon);
      skills.forEach((skill) => {
        let C = 0;
        (resources || []).forEach((res) => {
          if (res.skillId === skill.id) {
            let resAvailOverHorizon = 0;
            horizonMonths.forEach((m) => {
              const wDays = getWorkingDaysInMonth(m.year, m.month);
              const unavail =
                res.unavailability && typeof res.unavailability[m.key] === 'number'
                  ? res.unavailability[m.key]
                  : 0;
              resAvailOverHorizon += calculateResourceAvailability(wDays, res.fte, unavail);
            });
            C += resAvailOverHorizon;
          }
        });
        capacityBySkill[skill.id] = roundToHalfDay(C);
      });
    } else {
      const [yStr, mStr] = selectedPeriod.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const workingDays = isNaN(y) || isNaN(m) ? workingDaysNextMonth : getWorkingDaysInMonth(y, m);

      skills.forEach((skill) => {
        let C = 0;
        (resources || []).forEach((res) => {
          if (res.skillId === skill.id) {
            const unavail =
              res.unavailability && typeof res.unavailability[selectedPeriod] === 'number'
                ? res.unavailability[selectedPeriod]
                : 0;
            const avail = calculateResourceAvailability(workingDays, res.fte, unavail);
            C += avail;
          }
        });
        capacityBySkill[skill.id] = roundToHalfDay(C);
      });
    }

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
        if (!isProjectStaffed(project)) {
          return;
        }

        const daysStr = getSkillDays(project, skill.id);
        const days = parseFloat(daysStr);
        if (isNaN(days) || days <= 0) {
          return;
        }

        const requested = roundToHalfDay(days);
        const availableBefore = Math.max(0, roundToHalfDay(C - cumulativeUsed));
        const totalWithCurrent = roundToHalfDay(cumulativeUsed + requested);

        // Si la demande cumulée (projets plus prioritaires + projet courant) dépasse la capacité totale C
        if (totalWithCurrent > C) {
          const projectDeficit = roundToHalfDay(requested - Math.min(requested, availableBefore));
          const key = `${project.id}_${skill.id}`;
          bottleneckCells.add(key);
          bottleneckProjects.add(project.id);
          cellDetails.set(key, {
            requested,
            availableBefore,
            capacity: C,
            deficit: projectDeficit,
            projectDeficit,
          });
        }

        cumulativeUsed = totalWithCurrent;
      });
    });

    return {
      bottleneckCells,
      bottleneckProjects,
      cellDetails,
      capacityBySkill,
    };
  }, [
    skills,
    sortedProjectsByPriority.orderedProjects,
    resources,
    selectedPeriod,
    ratHorizon,
    periodOptions,
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
        // Si le terme recherché correspond au nom exact d'un projet (ex: clic depuis l'onglet Rapports),
        // SEUL ce projet doit apparaître dans la liste.
        const isExactNameTarget = sortedProjectsByPriority.orderedProjects.some(
          (proj) => proj.name.trim().toLowerCase() === q
        );
        if (isExactNameTarget) {
          if (p.name.trim().toLowerCase() !== q) return false;
          return true; // Seul ce projet apparaît dans la liste
        }

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

      // Filtre Les alertes (dépassements capacitaires, dépassements budgétaires, et/ou demandes de staffing non à jour)
      if (isAlertFilterActive) {
        const matchesCapacity = filterCapacityOverruns && bottleneckData.bottleneckProjects.has(p.id);
        const matchesBudget = filterBudgetOverruns && budgetOverrunData.overrunProjects.has(p.id);
        const isProjectUpToDate = Boolean(
          selectedPeriod === 'rat'
            ? (p.staffingPlanValidatedMonths?.['rat'] ?? p.isRatValidated)
            : p.staffingPlanValidatedMonths?.[selectedPeriod]
        );
        const matchesOutdatedStaffing = filterOutdatedStaffingDemands && !isProjectUpToDate;
        if (!matchesCapacity && !matchesBudget && !matchesOutdatedStaffing) return false;
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
    isAlertFilterActive,
    filterCapacityOverruns,
    filterBudgetOverruns,
    filterOutdatedStaffingDemands,
    bottleneckData,
    budgetOverrunData,
    activeUser,
    localMonths,
    selectedPeriod,
    currentMonthKey,
    nextMonthKey,
    showConfidentialProjects,
    canViewConfidential,
    isValueManagementOfficer,
    localStaffed,
  ]);

  // Mise à jour du mois de planification vers le mois prochain (stockage indépendant de la langue au format "YYYY-MM")
  const handleUpdateMonth = async (project: Project, targetMonth: string | null) => {
    if (!canEditProjectMonth(project)) return;

    const normalizedMonth = targetMonth ? normalizePeriodKey(targetMonth) || targetMonth : null;

    setLocalMonths((prev) => ({
      ...prev,
      [project.id]: normalizedMonth,
    }));

    try {
      const currentDays = localDays[project.id] || project.capacityDaysPerSkill || {};
      await updateProjectCapacity(project.id, normalizedMonth, currentDays, project.name);
    } catch (err) {
      console.error('Erreur mise à jour mois capacitaire:', err);
    }
  };

  // Saisie du nombre de jours de compétence à mobiliser pour la période sélectionnée
  const handleSkillDaysChange = (project: Project, skillId: string, rawVal: string) => {
    if (!canEditProjectCapacity(project) || !isProjectStaffed(project)) return;

    const normalized = rawVal.replace(',', '.');
    let numVal: number | null = null;

    if (normalized.trim() !== '') {
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed) && parsed >= 0) {
        numVal = roundToHalfDay(parsed);
      }
    }

    const updatedSkillMap = {
      ...(localDays[project.id] || {}),
      [skillId]: numVal,
    };

    setLocalDays((prev) => ({
      ...prev,
      [project.id]: updatedSkillMap,
    }));

    // Débouncing pour persistance Firestore (600ms)
    const timeoutKey = `${project.id}_${skillId}`;
    if (saveTimeoutRef.current[timeoutKey]) {
      clearTimeout(saveTimeoutRef.current[timeoutKey]);
    }

    saveTimeoutRef.current[timeoutKey] = setTimeout(async () => {
      try {
        if (selectedPeriod === 'rat') {
          const currentRat = {
            ...(project.remainingToComplete || {}),
            [skillId]: numVal,
          };
          await updateProjectRat(project.id, currentRat, project.name);
        } else {
          const isNext = selectedPeriod === nextMonthKey;
          const currentStaffingPlan = project.staffingPlan || {};
          const currentPeriodDemands = {
            ...(currentStaffingPlan[selectedPeriod] || {}),
            [skillId]: numVal,
          };
          await updateProjectPeriodDemands(
            project.id,
            selectedPeriod,
            currentPeriodDemands,
            currentStaffingPlan,
            isNext,
            project.name
          );
        }
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
      // 1. D : Demande totale en jours sur l'ensemble de TOUS les projets staffés pour la période
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
      D = roundToHalfDay(D);

      // 2. C : Nombre total de jours disponibles de cette compétence sur la période sélectionnée
      const C = bottleneckData.capacityBySkill[skill.id] ?? 0;

      // 3. R : Nombre de jours restant disponibles (R = C - D, arrondi à 0,5 près)
      const R = roundToHalfDay(C - D);

      result[skill.id] = { D, P, C, R };
    });

    return result;
  }, [skills, sortedProjectsByPriority.orderedProjects, localDays, bottleneckData.capacityBySkill, projectStates, localStaffed, selectedPeriod]);

  // Statistiques globales pour la barre de synthèse
  const stats = useMemo(() => {
    let delayedCount = 0;
    let updatedCount = 0;
    let totalDaysMobilized = 0;

    projects.forEach((p) => {
      const isStaffed = isProjectStaffed(p);
      const isUpToDate = Boolean(
        selectedPeriod === 'rat'
          ? (p.staffingPlanValidatedMonths?.['rat'] ?? p.isRatValidated)
          : p.staffingPlanValidatedMonths?.[selectedPeriod]
      );

      if (isUpToDate) {
        updatedCount++;
      } else {
        delayedCount++;
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

    return { delayedCount, updatedCount, totalDaysMobilized: roundToHalfDay(totalDaysMobilized) };
  }, [projects, skills, localDays, selectedPeriod, currentMonthKey, projectStates, localStaffed]);

  // Nombre de projets staffés parmi les projets affichés
  const staffedProjectsCount = useMemo(() => {
    return displayedProjects.filter((p) => isProjectStaffed(p)).length;
  }, [displayedProjects, projectStates, localStaffed]);

  // Nombre total de projets nécessitant une mise à jour pour la période sélectionnée (pastille de la colonne À JOUR ...)
  // Indépendant des filtres appliqués (recherche, cycle de vie, lignes budgétaires, alertes, mes projets).
  // Lorsque les projets confidentiels sont masqués (option décochée), ils ne sont pas pris en compte dans ce décompte.
  const outdatedProjectsCount = useMemo(() => {
    return sortedProjectsByPriority.orderedProjects.filter((p) => {
      const isHidden = Boolean(p.isConfidential) && !canViewConfidential(p);
      if (isHidden) return false;
      if (!isProjectStaffed(p)) return false;
      const isUpToDate = Boolean(
        selectedPeriod === 'rat'
          ? (p.staffingPlanValidatedMonths?.['rat'] ?? p.isRatValidated)
          : p.staffingPlanValidatedMonths?.[selectedPeriod]
      );
      return !isUpToDate;
    }).length;
  }, [sortedProjectsByPriority.orderedProjects, canViewConfidential, selectedPeriod, projectStates, localStaffed]);

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

      {/* En-tête de section avec titre à gauche et cadre blanc de période à droite */}
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Titre et sous-titre de l'onglet à gauche */}
        <div className="max-w-2xl">
          <h2 className={`${TAB_TITLE_CLASS} text-rose-900 flex items-center gap-2.5`}>
            <Gauge className="w-5 h-5 text-rose-900 shrink-0" />
            <span>{t('capacity.title')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {t('capacity.info')}
          </p>
        </div>

        {/* Cadre blanc à droite du titre pour le choix de la période et le sélecteur d'horizon */}
        <div className="shrink-0 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs space-y-1 relative z-30">
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            <span className={CHECKBOX_TITLE_CLASS}>
              {t('capacity.period_prompt', 'Planifiez les besoins en compétences clés pour la période suivante :')}
            </span>

            {/* Bouton de sélection personnalisé (sans double filet de focus) */}
            <div className="relative" ref={periodDropdownRef}>
              <button
                type="button"
                onClick={() => setIsPeriodDropdownOpen((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-2 shadow-2xs select-none ${
                  selectedPeriod === 'rat'
                    ? 'bg-[#efebe9] hover:bg-[#e7e0db] text-[#4e342e] border-[#bcaaa4]'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
                title={t('capacity.choose_period', 'Choisir la période')}
              >
                <span>{selectedPeriodLabel}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    isPeriodDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isPeriodDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1.5 text-slate-800 animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto [scrollbar-width:thin]">
                  {/* Option 1 : A terminaison en premier */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPeriod('rat');
                      setIsPeriodDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      selectedPeriod === 'rat'
                        ? 'bg-[#efebe9] text-[#4e342e] font-bold'
                        : 'hover:bg-[#f7f5f4] text-[#4e342e] font-medium'
                    }`}
                  >
                    <span>{t('capacity.at_completion', 'À terminaison')}</span>
                    {selectedPeriod === 'rat' && <Check className="w-3.5 h-3.5 text-[#4e342e] shrink-0" />}
                  </button>

                  {/* Filet séparateur */}
                  <div className="my-1 border-t border-slate-100" />

                  {periodOptions.map((opt) => {
                    const isSelected = selectedPeriod === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setSelectedPeriod(opt.key);
                          setIsPeriodDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-900 font-bold'
                            : 'hover:bg-slate-100 text-slate-700 font-medium'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Si "A terminaison" est choisi, sélecteur à 3 états apparaissant sur la ligne en dessous avec peu d'espace */}
          {selectedPeriod === 'rat' && (
            <div className="pt-1 border-t border-slate-100 flex items-center justify-between sm:justify-end gap-2.5 animate-in fade-in">
              <span className={CHECKBOX_TITLE_CLASS}>
                {t('capacity.capacity_at_horizon', 'Capacité à :')}
              </span>
              <div className={SEGMENT_SELECTOR_CONTAINER_CLASS}>
                <button
                  type="button"
                  onClick={() => setRatHorizon(3)}
                  className={getSegmentSelectorButtonClass(ratHorizon === 3)}
                >
                  {t('capacity.horizon_3_months', '3 mois')}
                </button>
                <button
                  type="button"
                  onClick={() => setRatHorizon(6)}
                  className={getSegmentSelectorButtonClass(ratHorizon === 6)}
                >
                  {t('capacity.horizon_6_months', '6 mois')}
                </button>
                <button
                  type="button"
                  onClick={() => setRatHorizon(12)}
                  className={getSegmentSelectorButtonClass(ratHorizon === 12)}
                >
                  {t('capacity.horizon_12_months', '12 mois')}
                </button>
              </div>
            </div>
          )}
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
              placeholder={t('capacity.search_placeholder')}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-900 bg-white"
            />
          </div>

          {/* Filtre État */}
          <div className="sm:col-span-1 lg:col-span-2">
            <LifecycleStateFilter
              projectStates={projectStates}
              selectedStateIds={selectedStateIds}
              onChange={setSelectedStateIds}
              quickFilterType="staffing"
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
              filterOutdatedStaffingDemands={filterOutdatedStaffingDemands}
              onToggleCapacityOverruns={setFilterCapacityOverruns}
              onToggleBudgetOverruns={handleToggleBudgetOverruns}
              onToggleOutdatedStaffingDemands={setFilterOutdatedStaffingDemands}
              onSelectAllProjects={() => {
                setFilterCapacityOverruns(false);
                setFilterBudgetOverruns(false);
                setFilterOutdatedStaffingDemands(false);
              }}
              capacityOverrunCount={bottleneckData.bottleneckProjects.size}
              budgetOverrunCount={budgetOverrunData.overrunProjects.size}
              outdatedStaffingDemandsCount={outdatedProjectsCount}
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
              <span>{t('projects.only_my_projects')}</span>
            </button>
          </div>
        </div>

        {/* Ligne inférieure : Boîte de comptage à gauche et case Afficher les projets confidentiels à droite, alignées horizontalement */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                hasActiveFilters
                  ? 'bg-blue-50 border border-blue-200 text-blue-900'
                  : 'bg-slate-100 border border-slate-200 text-slate-600'
              }`}
            >
              {hasActiveFilters
                ? t('projects.counts.filtered', {
                    filtered: displayedProjects.length,
                    filtered_word: displayedProjects.length > 1 ? t('common.words.project_other') : t('common.words.project_one'),
                    total: projects.length,
                    total_word: projects.length > 1 ? t('common.words.project_other') : t('common.words.project_one'),
                  })
                : t('projects.counts.total', {
                    total: projects.length,
                    total_word: projects.length > 1 ? t('common.words.project_other') : t('common.words.project_one'),
                  })}
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('projects.clear_filters')}</span>
              </button>
            )}
          </div>

          {/* Cases à cocher pour le Value Management Officer alignées horizontalement à droite */}
          {isValueManagementOfficer && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className={CHECKBOX_CONTAINER_CLASS}>
                <input
                  type="checkbox"
                  id="vmo-checkbox-show-budget-overruns-capacity"
                  checked={showBudgetOverruns}
                  onChange={(e) => setShowBudgetOverruns(e.target.checked)}
                  className={CHECKBOX_INPUT_CLASS}
                />
                <label
                  htmlFor="vmo-checkbox-show-budget-overruns-capacity"
                  className={CHECKBOX_TITLE_CLASS}
                  title={t('capacity.budget_aspects')}
                >
                  {t('capacity.budget_aspects')}
                </label>
              </div>

              <div className={CHECKBOX_CONTAINER_CLASS}>
                <input
                  type="checkbox"
                  id="vmo-checkbox-show-confidential-capacity"
                  checked={showConfidentialProjects}
                  onChange={(e) => setShowConfidentialProjects(e.target.checked)}
                  className={CHECKBOX_INPUT_CLASS}
                />
                <label
                  htmlFor="vmo-checkbox-show-confidential-capacity"
                  className={CHECKBOX_TITLE_CLASS}
                  title={t('capacity.confidential')}
                >
                  {t('capacity.confidential')}
                </label>
              </div>
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
                  {t('capacity.columns.id')}
                </th>

                {/* Colonne 2 : Priorité (figée à gauche : 50px, top : 0) */}
                <th
                  scope="col"
                  className={`sticky left-[50px] top-0 bg-slate-100 z-50 px-1 py-2 text-center align-top w-[52px] min-w-[52px] max-w-[52px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                >
                  <Tooltip content={t('capacity.tooltips.prio')} className="w-full inline-block">
                    <span className="cursor-default">{t('capacity.columns.prio')}</span>
                  </Tooltip>
                </th>

                {/* Colonne 3 : Nom du projet (figée à gauche : 102px, top : 0) */}
                <th
                  scope="col"
                  className={`sticky left-[102px] top-0 bg-slate-100 z-50 px-3 py-2 text-left align-top w-[200px] min-w-[200px] max-w-[200px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                >
                  {t('capacity.columns.project')}
                </th>

                {/* Colonne : Action (figée à gauche : 302px, top : 0) */}
                <th
                  scope="col"
                  className={`sticky left-[302px] top-0 bg-slate-100 z-50 px-1 py-2 text-right pr-2.5 align-top w-[88px] min-w-[88px] max-w-[88px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                >
                  {t('capacity.columns.action')}
                </th>

                {/* Colonnes optionnelles affichées uniquement si "Afficher les dépassements budgétaires" est coché */}
                {showBudgetOverruns && (
                  <>
                    {/* Colonne : Ligne budgétaire (figée à gauche : 390px, top : 0) */}
                    <th
                      scope="col"
                      className={`sticky left-[390px] top-0 bg-slate-100 z-50 px-2 py-2 text-center align-top w-[140px] min-w-[140px] max-w-[140px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                    >
                      {t('capacity.columns.budget_line')}
                    </th>

                    {/* Colonne : Budget (figée à gauche : 530px, top : 0) */}
                    <th
                      scope="col"
                      className={`sticky left-[530px] top-0 bg-slate-100 z-50 px-2 py-2 text-center align-top w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                    >
                      <div className="flex flex-col items-center justify-start leading-tight">
                        <span>{t('capacity.columns.budget')}</span>
                        {budgetOverrunData.overrunProjects.size > 0 && (
                          <div className="mt-4">
                            <Tooltip
                              variant="error"
                              placement="bottom"
                              content={
                                budgetOverrunData.overrunProjects.size > 1
                                  ? t('capacity.badges.overrun_tooltip_plural', { count: budgetOverrunData.overrunProjects.size })
                                  : t('capacity.badges.overrun_tooltip_singular')
                              }
                            >
                              <span
                                className="inline-flex items-center justify-center text-[10px] font-bold text-amber-100 bg-amber-900 border border-amber-950 px-2 py-0.5 rounded-full shadow-2xs whitespace-nowrap normal-case tracking-normal min-w-[18px] cursor-default"
                              >
                                {budgetOverrunData.overrunProjects.size} {t('capacity.badges.proj_short')}
                              </span>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </th>
                  </>
                )}

                {/* Colonne 4 : Staffé (figée à gauche : 620px si budget affiché, sinon 390px) */}
                <th
                  scope="col"
                  className={`sticky ${showBudgetOverruns ? 'left-[620px]' : 'left-[390px]'} top-0 bg-slate-100 z-50 px-1 py-2 text-center align-top w-[60px] min-w-[60px] max-w-[60px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                >
                  <div className="flex flex-col items-center justify-start leading-tight">
                    <Tooltip content={t('capacity.tooltips.staffed')}>
                      <span className="cursor-default">{t('capacity.columns.staffed')}</span>
                    </Tooltip>
                    {bottleneckData.bottleneckProjects.size > 0 && (
                      <div className="mt-4">
                        <Tooltip
                          variant="error"
                          placement="bottom"
                          content={
                            bottleneckData.bottleneckProjects.size > 1
                              ? t('capacity.badges.bottleneck_tooltip_plural', { count: bottleneckData.bottleneckProjects.size })
                              : t('capacity.badges.bottleneck_tooltip_singular')
                          }
                        >
                          <span
                            className="inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full shadow-2xs whitespace-nowrap normal-case tracking-normal min-w-[18px] cursor-default"
                          >
                            {bottleneckData.bottleneckProjects.size} {t('capacity.badges.proj_short')}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </th>

                {/* Colonne 5 : À JOUR ... (figée à gauche : 680px si budget affiché, sinon 450px) - Dernière colonne figée avec double filet vertical */}
                <th
                  scope="col"
                  className={`sticky ${showBudgetOverruns ? 'left-[680px]' : 'left-[450px]'} top-0 bg-slate-100 z-50 px-1 py-2 text-center align-top w-[92px] min-w-[92px] max-w-[92px] ${TABLE_FROZEN_DIVIDER_CLASS} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] table-header-double-bottom ${TABLE_HEADER_TEXT_CLASS}`}
                >
                  <div className="flex flex-col items-center justify-start leading-tight">
                    <Tooltip
                      content={t('capacity.tooltips.up_to_date_indicator', {
                        period: selectedPeriod === 'rat' ? t('capacity.at_completion_def', 'la terminaison') : selectedPeriodLabel,
                      })}
                    >
                      <div className="cursor-default flex flex-col items-center text-center gap-1">
                        <span className="font-bold">{t('capacity.columns.up_to_date', 'À JOUR')}</span>
                        <span
                          className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs max-w-full text-center ${
                            selectedPeriod === 'rat'
                              ? 'bg-[#efebe9] text-[#4e342e] border-[#bcaaa4] normal-case leading-tight'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          }`}
                        >
                          <span className={selectedPeriod === 'rat' ? 'break-words leading-tight text-center' : 'truncate'}>
                            {truncatedPeriodLabel}
                          </span>
                        </span>
                      </div>
                    </Tooltip>
                    {outdatedProjectsCount > 0 && (
                      <div className="mt-2.5">
                        <Tooltip
                          variant="error"
                          placement="bottom"
                          content={
                            outdatedProjectsCount > 1
                              ? t('capacity.tooltips.projects_not_up_to_date_count_plural', {
                                  count: outdatedProjectsCount,
                                  period: selectedPeriod === 'rat' ? t('capacity.at_completion_def', 'la terminaison') : selectedPeriodLabel,
                                })
                              : t('capacity.tooltips.projects_not_up_to_date_count_singular', {
                                  period: selectedPeriod === 'rat' ? t('capacity.at_completion_def', 'la terminaison') : selectedPeriodLabel,
                                })
                          }
                        >
                          <span
                            className="inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-600 px-1.5 py-0.5 rounded-full shadow-2xs whitespace-nowrap normal-case tracking-normal min-w-[18px] cursor-default"
                          >
                            {outdatedProjectsCount} {t('capacity.badges.proj_to_update_short', 'proj. à màj')}
                          </span>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </th>

                {/* Colonnes dynamiques : Une par compétence clé */}
                {skills.length === 0 ? (
                  <th scope="col" className="sticky top-0 z-40 bg-slate-100 px-4 py-3 text-slate-400 italic align-top table-header-double-bottom">
                    {t('capacity.no_skills_declared')}
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
                        className={`sticky top-0 z-40 relative px-1 py-2 text-center align-top border-r border-slate-200 ${CAPACITY_SKILL_COL_WIDTH_CLASS} transition-colors table-header-double-bottom ${
                          isAlerting ? 'bg-rose-100' : 'bg-slate-100'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-start gap-1 leading-tight w-full overflow-hidden">
                          {/* Nom de la compétence : même police que les autres titres, sans majuscules, tronqué avec points de suspension */}
                          <Tooltip
                            title={skill.name}
                            content={skill.description?.trim()}
                            className="w-full flex justify-center overflow-hidden"
                          >
                            <span
                              className={`${TABLE_HEADER_FONT_SIZE_CLASS} ${TABLE_HEADER_FONT_WEIGHT_CLASS} truncate block w-full text-center cursor-default ${
                                isAlerting ? 'text-red-700' : TABLE_HEADER_TEXT_COLOR_CLASS
                              }`}
                            >
                              {skill.name}
                            </span>
                          </Tooltip>

                          {/* Bulle d'information détaillée sur les chiffres */}
                          <Tooltip
                            variant={isAlerting ? 'error' : 'default'}
                            placement="bottom"
                            maxWidthClass="w-auto"
                            content={
                              isAlerting ? (
                                <div className="text-left text-xs text-white space-y-1 whitespace-nowrap">
                                  <div className="font-bold border-b border-red-400/40 pb-0.5">
                                    {t('capacity.tooltips.skill_header_bottleneck', { skill: skill.name })}
                                  </div>
                                  <div className="text-[11px] space-y-0.5 font-normal">
                                    <div>
                                      {t('capacity.tooltips.skill_header_demand', {
                                        demand: formatDaysVal(cap.D),
                                        count: cap.P,
                                        projects_word: cap.P > 1 ? t('capacity.projects') : t('capacity.project'),
                                      })}
                                    </div>
                                    <div>
                                      {t('capacity.tooltips.skill_header_availability', {
                                        capacity: formatDaysVal(cap.C),
                                        workingDays: workingDaysNextMonth,
                                      })}
                                    </div>
                                    <div className="font-bold">
                                      {t('capacity.tooltips.skill_header_missing', {
                                        missing: missingDaysStr,
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-left text-xs text-slate-100 space-y-1 whitespace-nowrap">
                                  <div className="font-semibold text-white border-b border-slate-500/40 pb-0.5">
                                    {skill.name} :
                                  </div>
                                  <div className="text-[11px] text-slate-200 space-y-0.5 font-normal">
                                    <div>
                                      {t('capacity.tooltips.skill_header_demand', {
                                        demand: formatDaysVal(cap.D),
                                        count: cap.P,
                                        projects_word: cap.P > 1 ? t('capacity.projects') : t('capacity.project'),
                                      })}
                                    </div>
                                    <div>
                                      {t('capacity.tooltips.skill_header_availability', {
                                        capacity: formatDaysVal(cap.C),
                                        workingDays: workingDaysNextMonth,
                                      })}
                                    </div>
                                    <div>
                                      {t('capacity.tooltips.skill_header_remaining', {
                                        remaining: formatDaysVal(cap.R),
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                          >
                            <div className="flex flex-col items-center justify-start cursor-default w-full">
                              {/* 1ère ligne : "D j / P proj." en police normale (non grasse) et en gris */}
                              <div className="text-xs font-normal text-slate-500 whitespace-nowrap text-center">
                                {formatDaysVal(cap.D)} {t('capacity.units.day_short')} / {cap.P} {t('capacity.badges.proj_short')}
                              </div>

                              {/* 2ème ligne : "( R j / C j )" en police normale et en gris, sauf R en gras blanc sur fond rouge en cas d'alerte dépassement */}
                              <div className="flex items-center justify-center gap-0.5 text-xs font-normal text-slate-500 whitespace-nowrap">
                                <span>(</span>
                                {isAlerting ? (
                                  <span className="inline-flex items-center justify-center bg-red-600 text-white font-bold text-[11px] px-1 py-0.5 rounded-full shadow-2xs leading-none">
                                    {rFormatted} {t('capacity.units.day_short')}
                                  </span>
                                ) : (
                                  <span>{rFormatted} {t('capacity.units.day_short')}</span>
                                )}
                                <span>/ {formatDaysVal(cap.C)} {t('capacity.units.day_short')})</span>
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
                    {t('capacity.tooltips.loading_projects')}
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
                      <p className="font-semibold text-slate-700">{t('capacity.tooltips.no_projects_found')}</p>
                      <p className="text-xs text-slate-500">
                        {myProjectsOnly || isAlertFilterActive || isStateFilterActive
                          ? t('capacity.tooltips.no_projects_matching_filters')
                          : t('capacity.tooltips.no_projects_declare')}
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
                  const userCanEditMonth = canEditProjectMonth(project);

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
                          : 'bg-slate-50 hover:bg-slate-100/70 text-slate-400'
                      }`}
                      style={
                        openMonthDropdownId === project.id
                          ? { position: 'relative', zIndex: 45 }
                          : undefined
                      }
                    >
                      {/* Colonne 1 : Identifiant (figée à gauche : 0px) */}
                      <td className={`sticky left-0 z-20 px-1 py-2 text-center whitespace-nowrap w-[50px] min-w-[50px] max-w-[50px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                        isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-50 group-hover:bg-slate-100/70'
                      }`}>
                        <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-full shadow-2xs ${
                          isStaffed ? 'bg-slate-900 text-white' : 'bg-slate-400 text-white'
                        }`}>
                          #{project.projectNumber}
                        </span>
                      </td>

                      {/* Colonne 2 : Priorité (figée à gauche : 50px) */}
                      <td className={`sticky left-[50px] z-20 px-1 py-2 text-center whitespace-nowrap w-[52px] min-w-[52px] max-w-[52px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                        isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-50 group-hover:bg-slate-100/70'
                      }`}>
                        {isProjectStatePrioritized(project.stateId) && rank !== undefined ? (
                          <span
                            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded inline-block min-w-[20px] bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                            title={`Priorité #${rank} (État à prioriser)`}
                          >
                            {rank}
                          </span>
                        ) : (
                          <span
                            className="text-slate-300 font-mono"
                            title={!isProjectStatePrioritized(project.stateId) ? 'État non à prioriser : pas de numéro de priorité' : 'Critères non valorisés'}
                          >
                            -
                          </span>
                        )}
                      </td>

                      {/* Colonne 3 : Nom du projet (figée à gauche : 102px) */}
                      <td className={`sticky left-[102px] z-20 hover:z-30 px-3 py-2 w-[200px] min-w-[200px] max-w-[200px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                        isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-50 group-hover:bg-slate-100/70'
                      }`}>
                        {isConfidentialHidden ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-100 text-red-600 border border-red-300 px-2.5 py-1 rounded-md shadow-2xs select-none"
                            title={t('projects.tooltips.confidential_locked', 'Projet confidentiel — Visualisation et modification interdites')}
                          >
                            <Lock className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>{t('common.confidential', 'Confidentiel').toUpperCase()}</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Tooltip
                              icon={project.isConfidential ? <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : undefined}
                              title={project.name}
                              content={`${currentStateName} (${stateNeedsStaffing ? t('capacity.status.normally_staffable', 'normalement staffable') : t('capacity.status.not_staffable', 'non staffable')})`}
                              placement="right"
                              maxWidthClass={TOOLTIP_MAX_WIDTH_CLASS}
                              className="relative inline-flex items-center shrink-0 cursor-default"
                            >
                              <span
                                className={`font-bold text-xs truncate max-w-[150px] cursor-default ${
                                  isStaffed ? 'text-slate-900' : 'text-slate-500'
                                }`}
                              >
                                {project.name}
                              </span>
                            </Tooltip>
                            {project.isConfidential && (
                              <span
                                className="inline-flex items-center justify-center p-1 rounded-md bg-rose-50 border border-red-300 text-red-600 shadow-2xs shrink-0 cursor-default"
                                title={t('projects.tooltips.confidential_badge', 'Projet confidentiel (accès restreint)')}
                              >
                                <Lock className="w-3.5 h-3.5 text-red-600" />
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Colonne : Action (figée à gauche : 302px) */}
                      <td
                        className={`sticky left-[302px] z-20 px-1 py-2 text-center whitespace-nowrap w-[88px] min-w-[88px] max-w-[88px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                          isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-50 group-hover:bg-slate-100/70'
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
                          onOpenHistory={(proj) => {
                            setHistoryProject(proj);
                            setHistoryModalOpen(true);
                          }}
                          onOpenStaffingPlan={(proj) => {
                            setStaffingPlanProject(proj);
                            setStaffingPlanModalOpen(true);
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
                            {/* Colonne : Ligne budgétaire (figée à gauche : 390px) */}
                            <td
                              className={`sticky left-[390px] z-20 px-2.5 py-2 whitespace-nowrap w-[140px] min-w-[140px] max-w-[140px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] text-xs ${
                                isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-50 group-hover:bg-slate-100/70'
                              }`}
                            >
                              {isConfidentialHidden ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  <Lock className="w-2.5 h-2.5 text-red-600 shrink-0" />
                                  <span>{t('common.confidential', 'Confidentiel')}</span>
                                </span>
                              ) : (
                                <Tooltip content={bl ? `${bl.name} (${bl.budgetKe} K€)` : t('capacity.status.no_budget_line')}>
                                  <span
                                    className={`truncate block max-w-[130px] text-xs font-semibold cursor-default ${
                                      !isStaffed ? 'opacity-70' : ''
                                    }`}
                                    style={bl?.color ? { color: bl.color } : undefined}
                                  >
                                    {bl ? bl.name : <span className="italic text-slate-400 font-normal">{t('capacity.status.not_defined')}</span>}
                                  </span>
                                </Tooltip>
                              )}
                            </td>

                            {/* Colonne : Budget (figée à gauche : 530px) */}
                            <td
                              className={`sticky left-[530px] z-20 px-2 py-2 text-center whitespace-nowrap w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                                isStaffed
                                  ? 'bg-white group-hover:bg-slate-50/80'
                                  : 'bg-slate-50 group-hover:bg-slate-100/70'
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
                                        {t('capacity.tooltips.budget_overrun_title', { lineName: budgetDetail?.lineName })}
                                      </div>
                                      <div className="text-[11px] font-normal space-y-0.5">
                                        <div>{t('capacity.tooltips.budget_line_allocated', { amount: budgetDetail?.lineAllocated })}</div>
                                        <div>{t('capacity.tooltips.budget_cumulative_total', { amount: budgetDetail?.cumulativeTotal })}</div>
                                        <div>{t('capacity.tooltips.budget_overrun_caused', { amount: budgetDetail?.overrunAmount })}</div>
                                      </div>
                                    </div>
                                  }
                                >
                                  <div
                                    className="inline-flex items-center justify-center font-bold text-amber-950 bg-yellow-200 border border-amber-600 rounded px-2 py-0.5 text-xs shadow-2xs cursor-default select-none"
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

                      {/* Colonne 4 : Staffé (figée à gauche : 620px si budget affiché, sinon 390px) */}
                      <td
                        className={`sticky ${showBudgetOverruns ? 'left-[620px]' : 'left-[390px]'} z-20 px-1 py-2 text-center whitespace-nowrap w-[60px] min-w-[60px] max-w-[60px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                          !isStaffed
                            ? 'bg-slate-50 group-hover:bg-slate-100/70'
                            : isProjectBottlenecked
                            ? 'bg-rose-100 group-hover:bg-rose-200/80'
                            : 'bg-white group-hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          {!isProjectStatePrioritized(project.stateId) ? (
                            <Tooltip
                              variant="default"
                              placement="top"
                              content={t('capacity.tooltips.not_prioritized_project')}
                            >
                              <div
                                className="w-4 h-4 rounded-[4px] opacity-30 cursor-not-allowed bg-slate-200 border border-slate-300"
                              />
                            </Tooltip>
                          ) : isStaffed && !stateNeedsStaffing ? (
                            <Tooltip
                              variant="error"
                              placement="top"
                              content={
                                <div className="text-left text-xs whitespace-normal max-w-xs font-bold leading-snug">
                                  {t('capacity.tooltips.state_does_not_require_staffing', { state: currentStateName })}
                                </div>
                              }
                            >
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={true}
                                disabled={!canToggleStaffing}
                                onClick={() => canToggleStaffing && handleToggleStaffing(project)}
                                className={`w-4 h-4 rounded-[4px] transition-colors border-2 border-red-500 bg-red-600 text-white flex items-center justify-center ${
                                  canToggleStaffing ? 'cursor-pointer hover:bg-red-700 hover:border-red-700' : 'opacity-60 cursor-not-allowed'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </button>
                            </Tooltip>
                          ) : !isStaffed && stateNeedsStaffing ? (
                            <Tooltip
                              variant="error"
                              placement="top"
                              content={
                                <div className="text-left text-xs whitespace-normal max-w-xs font-bold leading-snug">
                                  {t('capacity.tooltips.state_requires_staffing_unstaffed', { state: currentStateName })}
                                </div>
                              }
                            >
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={false}
                                disabled={!canToggleStaffing}
                                onClick={() => canToggleStaffing && handleToggleStaffing(project)}
                                className={`w-4 h-4 rounded-[4px] transition-colors border-2 border-red-500 bg-white flex items-center justify-center ${
                                  canToggleStaffing ? 'cursor-pointer hover:border-red-600 hover:bg-red-50/50' : 'opacity-60 cursor-not-allowed'
                                }`}
                              />
                            </Tooltip>
                          ) : isStaffed && isProjectBottlenecked ? (
                            <Tooltip
                              variant="error"
                              placement="top"
                              content={
                                <div className="text-left text-xs whitespace-normal max-w-xs space-y-0.5">
                                  <div className="font-bold">{t('capacity.tooltips.bottleneck_title')}</div>
                                  <div className="text-[11px] font-normal">
                                    {t('capacity.tooltips.bottleneck_project_desc')}
                                  </div>
                                </div>
                              }
                            >
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={true}
                                disabled={!canToggleStaffing}
                                onClick={() => canToggleStaffing && handleToggleStaffing(project)}
                                className={`w-4 h-4 rounded-[4px] transition-colors border border-blue-600 bg-blue-600 text-white flex items-center justify-center ${
                                  canToggleStaffing ? 'cursor-pointer hover:bg-blue-700 hover:border-blue-700' : 'opacity-60 cursor-not-allowed'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </button>
                            </Tooltip>
                          ) : (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isStaffed}
                              disabled={!canToggleStaffing}
                              onClick={() => canToggleStaffing && handleToggleStaffing(project)}
                              className={`w-4 h-4 rounded-[4px] transition-colors flex items-center justify-center ${
                                isStaffed
                                  ? 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700'
                                  : 'border border-slate-300 bg-white hover:border-slate-400'
                              } ${
                                !stateNeedsStaffing && !canToggleStaffing
                                  ? 'opacity-30 cursor-not-allowed bg-slate-200 border-slate-300'
                                  : canToggleStaffing
                                  ? 'cursor-pointer'
                                  : 'opacity-60 cursor-not-allowed'
                              }`}
                              title={
                                !stateNeedsStaffing
                                  ? canToggleStaffing
                                    ? t('capacity.tooltips.staffed_vmo_toggle', { state: currentStateName })
                                    : t('capacity.tooltips.staffed_state_not_staffable', { state: currentStateName })
                                  : !canToggleStaffing
                                  ? isPersonaAdmin
                                    ? t('capacity.tooltips.staffed_admin_forbidden')
                                    : isStaffed
                                    ? t('capacity.tooltips.staffed_readonly_staffed')
                                    : t('capacity.tooltips.staffed_readonly_unstaffed')
                                  : isStaffed
                                  ? t('capacity.tooltips.staffed_click_to_unstaff')
                                  : t('capacity.tooltips.staffed_click_to_staff')
                              }
                            >
                              {isStaffed && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Colonne 5 : À jour pour la période sélectionnée (figée à gauche : 680px si budget affiché, sinon 450px) */}
                      <td
                        className={`sticky ${showBudgetOverruns ? 'left-[680px]' : 'left-[450px]'} z-20 px-1 py-2 text-center whitespace-nowrap w-[92px] min-w-[92px] max-w-[92px] ${TABLE_FROZEN_DIVIDER_CLASS} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                          isStaffed ? 'bg-white group-hover:bg-slate-50/80' : 'bg-slate-50 group-hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          {(() => {
                            const isProjectUpToDate = Boolean(
                              selectedPeriod === 'rat'
                                ? (project.staffingPlanValidatedMonths?.['rat'] ?? project.isRatValidated)
                                : project.staffingPlanValidatedMonths?.[selectedPeriod]
                            );

                            // Si le projet n'est pas coché dans la colonne Staffé : case à cocher à bord grisé sur fond blanc clair
                            if (!isStaffed) {
                              return (
                                <Tooltip content={t('capacity.status.unstaffed_project', 'Projet non staffé')}>
                                  <div
                                    role="checkbox"
                                    aria-checked={isProjectUpToDate}
                                    className="w-4 h-4 rounded-[4px] flex items-center justify-center cursor-default select-none shadow-2xs border border-slate-300 bg-white text-slate-400"
                                  >
                                    {isProjectUpToDate && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                </Tooltip>
                              );
                            }

                            const periodTarget =
                              selectedPeriod === 'rat' ? t('capacity.at_completion_def', 'la terminaison') : selectedPeriodLabel;

                            return isProjectUpToDate ? (
                              <Tooltip
                                content={t('capacity.tooltips.project_up_to_date', { period: periodTarget })}
                              >
                                <div
                                  role="checkbox"
                                  aria-checked={true}
                                  className="w-4 h-4 rounded-[4px] border border-blue-600 bg-blue-600 text-white flex items-center justify-center cursor-default select-none shadow-2xs"
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              </Tooltip>
                            ) : (
                              <Tooltip
                                variant="error"
                                content={t('capacity.tooltips.project_not_up_to_date', { period: periodTarget })}
                              >
                                <div
                                  role="checkbox"
                                  aria-checked={false}
                                  className="w-4 h-4 rounded-[4px] border-2 border-red-500 bg-white flex items-center justify-center cursor-default select-none shadow-2xs"
                                />
                              </Tooltip>
                            );
                          })()}
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
                                  ? t('capacity.tooltips.cell_input_disabled_state', { state: project.stateName || '' })
                                  : t('capacity.tooltips.cell_input_disabled_unstaffed')
                                : !isCellBottleneck
                                ? !userCanEditCapacity
                                  ? t('capacity.tooltips.cell_input_readonly')
                                  : t('capacity.tooltips.cell_input_planned', {
                                      project: isConfidentialHidden ? t('projects.tooltips.confidential_badge') : project.name,
                                      skill: skill.name,
                                      val: cellVal || '0',
                                      period: selectedPeriodLabel,
                                    })
                                : undefined
                            }
                          />
                        );

                        return (
                          <td
                            key={skill.id}
                            className={`p-1 text-center border-r border-slate-200 transition-colors ${CAPACITY_SKILL_COL_WIDTH_CLASS} ${
                              !isStaffed ? 'bg-slate-50 group-hover:bg-slate-100/70' : ''
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
                                      {t('capacity.tooltips.cell_bottleneck', { skill: skill.name })}
                                    </div>
                                    <div className="text-[11px] space-y-0.5 font-normal">
                                      <div>{t('capacity.tooltips.cell_demand', { val: cellVal })}</div>
                                      <div>{t('capacity.tooltips.cell_capacity', { capacity: cellDetail?.capacity ?? 0 })}</div>
                                      <div>{t('capacity.tooltips.cell_available_before', { availableBefore: cellDetail?.availableBefore ?? 0 })}</div>
                                      <div className="font-bold">{t('capacity.tooltips.cell_deficit', { deficit: cellDetail?.deficit ?? 0 })}</div>
                                    </div>
                                    {!userCanEditCapacity && (
                                      <div className="text-[10px] italic opacity-90 pt-0.5">
                                        {t('capacity.tooltips.cell_readonly')}
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
          const pNum = saved?.projectNumber || selectedProject?.projectNumber || '';
          setActionSuccess(
            selectedProject
              ? t('projects.success_update', { number: pNum })
              : t('projects.success_create', { number: pNum })
          );
          setTimeout(() => setActionSuccess(null), 4000);
        }}
      />

      {/* Modal Historique Capacitaire par Compétence Clé */}
      <ProjectCapacityHistoryModal
        isOpen={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setHistoryProject(null);
        }}
        project={historyProject}
        skills={skills}
        orderedProjects={sortedProjectsByPriority.orderedProjects}
        resources={resources}
      />

      {/* Modal Plan de Staffing Prévisionnel (12 mois glissants & RAT) */}
      <ProjectStaffingPlanModal
        isOpen={staffingPlanModalOpen}
        onClose={() => {
          setStaffingPlanModalOpen(false);
          setStaffingPlanProject(null);
        }}
        project={staffingPlanProject}
        skills={skills}
        nextMonthKey={nextMonthKey}
        onSaved={() => {
          setActionSuccess(t('capacity.staffing_plan.saved_success', 'Plan de staffing et reste à terminaison enregistrés avec succès.'));
          setTimeout(() => setActionSuccess(null), 4000);
        }}
      />
    </div>
  );
};
