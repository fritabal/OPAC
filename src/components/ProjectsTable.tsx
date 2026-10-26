import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  Eye,
  Lock,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Coins,
  User,
  Shield,
  Euro,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  Menu,
  Download,
  Upload,
  CheckSquare,
} from 'lucide-react';
import { Project } from '../types/project';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { Criterion } from '../types/criteria';
import { CustomProjectParam } from '../types/customParam';
import { KeySkill } from '../types/skill';
import { AppUser, UserRole } from '../types/user';
import { BonusConfig, DEFAULT_BONUS_CONFIG } from '../types/bonus';
import { saveBonusConfig } from '../services/bonusService';
import { deleteProject, updateProject } from '../services/projectService';
import { ProjectModal } from './ProjectModal';
import { ProjectsImportModal } from './ProjectsImportModal';
import { ProjectsImportResultModal } from './ProjectsImportResultModal';
import { ExportProjectsModal } from './ExportProjectsModal';
import { DeleteAllProjectsModal } from './DeleteAllProjectsModal';
import {
  ReferenceData,
  exportProjectsToCsv,
  downloadFile,
  ImportResult,
} from '../services/projectCsvService';
import { calculateProjectRoi, formatRoi } from '../utils/roiCalculator';
import { isSuperAdminEmail } from '../services/userService';
import { Tooltip } from './Tooltip';
import {
  ProjectPermissionContext,
  canEditProject,
  canViewConfidentialProject,
  canDeleteProject as canDeleteProjectUtil,
} from '../utils/projectPermissions';
import { ProjectActionButton } from './ProjectActionButton';
import { LifecycleStateFilter } from './LifecycleStateFilter';
import { BudgetLineFilter } from './BudgetLineFilter';

export type SortColumn = 'id' | 'roi' | 'name' | 'state' | 'pm' | 'budgetLine' | 'bonus' | string;
export type SortDirection = 'asc' | 'desc';

interface ProjectsTableProps {
  projects: Project[];
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
  customParams: CustomProjectParam[];
  skills?: KeySkill[];
  users: AppUser[];
  bonusConfig?: BonusConfig;
  showConfidentialProjects?: boolean;
  setShowConfidentialProjects?: (show: boolean) => void;
  sortColumn?: SortColumn;
  setSortColumn?: (col: SortColumn) => void;
  sortDirection?: SortDirection;
  setSortDirection?: (dir: SortDirection) => void;
}

export const ProjectsTable: React.FC<ProjectsTableProps> = ({
  projects,
  loading,
  activeUser,
  isSuperUser,
  isAdmin,
  isResourceManager = false,
  isProjectManager = false,
  isValueManagementOfficer,
  effectiveRole,
  projectStates,
  budgetLines,
  criteria,
  customParams,
  skills = [],
  users,
  bonusConfig = DEFAULT_BONUS_CONFIG,
  showConfidentialProjects: showConfidentialProjectsProp,
  setShowConfidentialProjects: setShowConfidentialProjectsProp,
  sortColumn: sortColumnProp,
  setSortColumn: setSortColumnProp,
  sortDirection: sortDirectionProp,
  setSortDirection: setSortDirectionProp,
}) => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);

  const [deleteCandidate, setDeleteCandidate] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [updatingStateProjectId, setUpdatingStateProjectId] = useState<string | null>(null);

  // Menu burger : Export / Import / Suppression de projets
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResultModalOpen, setImportResultModalOpen] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);

  // Sélection individuelle de projets (cases à cocher dans le tableau)
  const [manualSelectionActive, setManualSelectionActive] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const handleToggleSelectProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    };
    if (actionsMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [actionsMenuOpen]);

  const handleExportProjects = (targetProjects: Project[] = projects) => {
    try {
      const refs: ReferenceData = {
        projectStates,
        budgetLines,
        criteria,
        customParams,
        skills,
        users,
        bonusConfig,
      };
      const csvContent = exportProjectsToCsv(targetProjects, refs);
      const now = new Date();
      const dateTag = now.toISOString().slice(0, 10);
      const filename =
        targetProjects.length < projects.length
          ? `projets_opac_selection_${dateTag}.csv`
          : `projets_opac_${dateTag}.csv`;
      downloadFile(csvContent, filename);
      setActionSuccess(`${targetProjects.length} ${targetProjects.length > 1 ? 'projets exportés' : 'projet exporté'} avec succès au format CSV (|).`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Erreur export projets CSV:', err);
    }
  };

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
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

  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  const [bonusedOnly, setBonusedOnly] = useState(false);
  const [localShowConfidentialProjects, setLocalShowConfidentialProjects] = useState(false);

  const showConfidentialProjects =
    showConfidentialProjectsProp !== undefined ? showConfidentialProjectsProp : localShowConfidentialProjects;
  const setShowConfidentialProjects = (val: boolean) => {
    setLocalShowConfidentialProjects(val);
    setShowConfidentialProjectsProp?.(val);
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      isStateFilterActive ||
      isBudgetLineFilterActive ||
      myProjectsOnly ||
      bonusedOnly ||
      manualSelectionActive
  );

  // Références de lignes pour le défilement automatique
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const lastScrolledBreachKeyRef = useRef<string | null>(null);

  // Tri du tableau des projets (avec conservation lors du changement d'onglet)
  const [internalSortColumn, setInternalSortColumn] = useState<SortColumn>('id');
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>('desc');

  const sortColumn = sortColumnProp !== undefined ? sortColumnProp : internalSortColumn;
  const sortDirection = sortDirectionProp !== undefined ? sortDirectionProp : internalSortDirection;

  const setSortColumn = (colOrFn: SortColumn | ((prev: SortColumn) => SortColumn)) => {
    if (setSortColumnProp) {
      if (typeof colOrFn === 'function') {
        setSortColumnProp(colOrFn(sortColumn));
      } else {
        setSortColumnProp(colOrFn);
      }
    } else {
      setInternalSortColumn(colOrFn);
    }
  };

  const setSortDirection = (dirOrFn: SortDirection | ((prev: SortDirection) => SortDirection)) => {
    if (setSortDirectionProp) {
      if (typeof dirOrFn === 'function') {
        setSortDirectionProp(dirOrFn(sortDirection));
      } else {
        setSortDirectionProp(dirOrFn);
      }
    } else {
      setInternalSortDirection(dirOrFn);
    }
  };

  // Détection si l'utilisateur agit sous la casquette Resource Manager
  const isActingAsResourceManager =
    effectiveRole === 'resource manager' ||
    (isResourceManager && !isAdmin && !isValueManagementOfficer && !isSuperUser);

  // Droits globaux : En tant que Resource Manager, interdiction de créer des projets
  const canCreate = !isActingAsResourceManager && (isValueManagementOfficer || isSuperUser || isAdmin || isProjectManager);

  // Droits exclusifs sur le menu burger du portefeuille (Export, Import, Suppression) :
  // Réservé aux seuls Value Management Officer et au Super User (et pas aux autres rôles)
  const canAccessBurgerMenu =
    isSuperUser ||
    (isValueManagementOfficer && (!effectiveRole || effectiveRole === 'value management officer' || effectiveRole === 'super user'));

  // Droits exclusifs sur les bonus dans l'onglet projets : réservé au seul persona Value Management Officer
  const canToggleBonus = isValueManagementOfficer && (
    effectiveRole === 'value management officer' || isSuperUser
  );
  const [savingBonus, setSavingBonus] = useState(false);

  // Basculement de "Bonus actifs"
  const handleToggleBonusActive = async () => {
    if (!canToggleBonus || savingBonus) return;
    setSavingBonus(true);
    try {
      await saveBonusConfig(
        {
          ...bonusConfig,
          isBonusActive: !bonusConfig.isBonusActive,
        },
        activeUser?.email || ''
      );
    } catch (err) {
      console.error('Erreur mise à jour bonus actif:', err);
    } finally {
      setSavingBonus(false);
    }
  };

  // Basculement de "Vérification des quotas de bonus"
  const handleToggleCheckQuotas = async () => {
    if (!canToggleBonus || savingBonus) return;
    setSavingBonus(true);
    try {
      await saveBonusConfig(
        {
          ...bonusConfig,
          checkQuotas: !bonusConfig.checkQuotas,
        },
        activeUser?.email || ''
      );
    } catch (err) {
      console.error('Erreur mise à jour quotas bonus:', err);
    } finally {
      setSavingBonus(false);
    }
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

  const canEdit = (project: Project): boolean => canEditProject(project, permissionContext);
  const canViewConfidential = (project: Project): boolean => canViewConfidentialProject(project, permissionContext);
  const canDeleteProject = (project: Project): boolean => canDeleteProjectUtil(project, permissionContext);

  // Stockage local des modifications directes de bonus pour réactivité instantanée
  const [localBonuses, setLocalBonuses] = useState<Record<string, number | null>>({});
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    return () => {
      Object.values(saveTimeoutRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Helper : valeur effective du bonus (locale ou distante)
  const getProjectBonus = (p: Project): number | null => {
    if (localBonuses[p.id] !== undefined) {
      return localBonuses[p.id];
    }
    return typeof p.bonus === 'number' && !isNaN(p.bonus) ? p.bonus : null;
  };

  const persistBonus = async (p: Project, targetBonus: number | null) => {
    try {
      const calculatedRoi = calculateProjectRoi(
        p.criteriaValues,
        criteria,
        true, // calculé quel que soit l'état
        targetBonus,
        bonusConfig.isBonusActive
      );
      await updateProject(p.id, {
        bonus: targetBonus,
        roi: calculatedRoi,
      });
    } catch (err) {
      console.error('Erreur mise à jour bonus projet:', err);
    }
  };

  const handleBonusInputChange = (p: Project, rawVal: string) => {
    if (!canToggleBonus) return;
    const cleanDigits = rawVal.replace(/\D/g, '');
    let newBonus: number | null = null;
    if (cleanDigits !== '') {
      const parsed = parseInt(cleanDigits, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        newBonus = parsed;
      }
    }

    setLocalBonuses((prev) => ({ ...prev, [p.id]: newBonus }));

    // Débouncing de l'enregistrement en base (700ms)
    if (saveTimeoutRef.current[p.id]) {
      clearTimeout(saveTimeoutRef.current[p.id]);
    }
    saveTimeoutRef.current[p.id] = setTimeout(() => {
      persistBonus(p, newBonus);
      delete saveTimeoutRef.current[p.id];
    }, 700);
  };

  const handleBonusInputBlur = (p: Project) => {
    if (!canToggleBonus) return;
    if (saveTimeoutRef.current[p.id]) {
      clearTimeout(saveTimeoutRef.current[p.id]);
      delete saveTimeoutRef.current[p.id];
    }
    const currentVal = localBonuses[p.id];
    const targetBonus = currentVal !== undefined ? currentVal : (p.bonus ?? null);
    if (targetBonus !== (p.bonus ?? null)) {
      persistBonus(p, targetBonus);
    }
  };

  // Modification directe de l'état du projet depuis le tableau (avec recalcul automatique de l'état "à staffer")
  const handleDirectStateChange = async (p: Project, newStateId: string) => {
    if (!canEdit(p) || p.stateId === newStateId) return;
    const targetState = projectStates.find((s) => s.id === newStateId);
    if (!targetState) return;

    setUpdatingStateProjectId(p.id);
    try {
      // Recalcul de l'état "à staffer" selon l'attribut « À staffer » (needsStaffing) du nouvel état
      const newIsStaffed = Boolean(targetState.needsStaffing);

      // Recalcul du ROI si applicable
      const calculatedRoi = calculateProjectRoi(
        p.criteriaValues,
        criteria,
        true,
        getProjectBonus(p),
        bonusConfig.isBonusActive
      );

      await updateProject(p.id, {
        stateId: targetState.id,
        stateName: targetState.name,
        isStaffed: newIsStaffed,
        roi: calculatedRoi,
      });

      setActionSuccess(`État du projet #${p.projectNumber ?? ''} mis à jour : « ${targetState.name} » (Staffé : ${newIsStaffed ? 'Oui' : 'Non'}).`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      console.error('Erreur mise à jour directe de l\'état du projet:', err);
    } finally {
      setUpdatingStateProjectId(null);
    }
  };

  const handleOpenCreate = () => {
    setSelectedProject(null);
    setIsReadOnlyModal(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Project) => {
    if (p.isConfidential && !canViewConfidential(p)) {
      return; // Interdire formellement la visualisation des projets confidentiels
    }
    setSelectedProject(p);
    setIsReadOnlyModal(!canEdit(p));
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      await deleteProject(deleteCandidate.id);
      setActionSuccess(`Projet #${deleteCandidate.projectNumber} « ${deleteCandidate.name} » supprimé.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setDeleteCandidate(null);
    } catch (err: any) {
      alert('Erreur lors de la suppression : ' + err?.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtrage
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const isHidden = Boolean(p.isConfidential) && !canViewConfidential(p);

      // Recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesNumber = `#${p.projectNumber}`.includes(q) || String(p.projectNumber).includes(q);
        if (isHidden) {
          // Si le projet est caviardé pour l'utilisateur, ne pas permettre la recherche par le nom ou la description cachée
          if (!matchesNumber && !'confidentiel'.includes(q)) return false;
        } else {
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesDesc = p.description.toLowerCase().includes(q);
          const matchesPM = p.projectManagerEmail.toLowerCase().includes(q);
          if (!matchesName && !matchesDesc && !matchesNumber && !matchesPM) return false;
        }
      }

      // Filtre état
      if (isStateFilterActive) {
        if (!p.stateId || !selectedStateIds.includes(p.stateId)) return false;
      }

      // Filtre ligne budgétaire
      if (isBudgetLineFilterActive) {
        if (isHidden) return false; // Ligne budgétaire caviardée pour cet utilisateur
        if (!p.budgetLineId || !selectedBudgetLineIds.includes(p.budgetLineId)) return false;
      }

      // Mes projets uniquement
      if (myProjectsOnly && activeUser?.email) {
        const uEmail = activeUser.email.toLowerCase();
        const pm = p.projectManagerEmail.toLowerCase();
        const dep = p.deputyEmail ? p.deputyEmail.toLowerCase() : '';
        if (uEmail !== pm && uEmail !== dep) return false;
      }

      // Projets bonussés uniquement
      if (bonusedOnly) {
        const b = getProjectBonus(p);
        if (typeof b !== 'number' || isNaN(b) || b <= 0) return false;
      }

      return true;
    });
  }, [projects, searchQuery, isStateFilterActive, selectedStateIds, isBudgetLineFilterActive, selectedBudgetLineIds, myProjectsOnly, bonusedOnly, showConfidentialProjects, activeUser, localBonuses, isSuperUser, isValueManagementOfficer]);

  // Bascule de la sélection manuelle :
  // Ne cocher que les projets qui ont été pré-sélectionnés par un autre filtre.
  // S'il n'y a pas d'autre filtre prédéfini avant qu'on ne clique sur "sélection manuelle",
  // alors par défaut, aucun projet ne doit être sélectionné.
  const handleToggleManualSelection = () => {
    if (manualSelectionActive) {
      setManualSelectionActive(false);
      setSelectedProjectIds([]);
    } else {
      setManualSelectionActive(true);
      const hasOtherFilters = Boolean(
        searchQuery.trim() ||
        isStateFilterActive ||
        isBudgetLineFilterActive ||
        myProjectsOnly ||
        bonusedOnly
      );
      if (hasOtherFilters) {
        setSelectedProjectIds(filteredProjects.map((p) => p.id));
      } else {
        setSelectedProjectIds([]);
      }
    }
  };

  // Annulation automatique de la sélection manuelle si l'utilisateur applique un filtre prédéfini
  const cancelManualSelectionIfActive = () => {
    if (manualSelectionActive) {
      setManualSelectionActive(false);
      setSelectedProjectIds([]);
    }
  };

  const handleStateFilterChange = (ids: string[]) => {
    cancelManualSelectionIfActive();
    setSelectedStateIds(ids);
  };

  const handleBudgetLineFilterChange = (ids: string[]) => {
    cancelManualSelectionIfActive();
    setSelectedBudgetLineIds(ids);
  };

  const handleToggleMyProjects = () => {
    cancelManualSelectionIfActive();
    setMyProjectsOnly((prev) => !prev);
  };

  const handleSearchChange = (value: string) => {
    if (manualSelectionActive && value.trim() !== searchQuery.trim()) {
      cancelManualSelectionIfActive();
    }
    setSearchQuery(value);
  };

  const handleBonusedOnlyChange = (checked: boolean) => {
    cancelManualSelectionIfActive();
    setBonusedOnly(checked);
  };

  const getStateName = (stateId: string) => {
    const s = projectStates.find((st) => st.id === stateId);
    return s?.name || stateId || 'État non défini';
  };

  const getBudgetLineName = (lineId: string) => {
    const b = budgetLines.find((bl) => bl.id === lineId);
    return b ? b.name : 'Non renseignée';
  };

  const getUserName = (email: string) => {
    const u = users.find((usr) => usr.email.toLowerCase() === email.toLowerCase());
    return u ? u.displayName : email;
  };

  // Helper : vérifie si l'état d'un projet a l'attribut « à prioriser » à VRAI
  const isProjectStatePrioritized = (stateId: string): boolean => {
    const s = projectStates.find((st) => st.id === stateId);
    return Boolean(s?.needsPrioritization);
  };

  // Helper : vérifie si le projet est staffé (son état a pour attribut "à staffer", ou case cochée)
  const isProjectStaffed = (p: Project): boolean => {
    const s = projectStates.find((st) => st.id === p.stateId);
    const stateNeedsStaffing = Boolean(s?.needsStaffing);
    if (!stateNeedsStaffing) {
      return p.isStaffed === true;
    }
    return p.isStaffed !== false;
  };

  // Obtenir le ROI effectif d'un projet : calculé quel que soit son état
  const getProjectEffectiveRoi = (p: Project): number | null => {
    return calculateProjectRoi(
      p.criteriaValues,
      criteria,
      true, // quel que soit son état
      getProjectBonus(p),
      bonusConfig.isBonusActive
    );
  };

  // Paramètres personnalisés affichés dans le tableau selon l'ordre défini
  const visibleCustomParams = useMemo(() => {
    return [...customParams]
      .filter((cp) => Boolean(cp.showInTable))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [customParams]);

  const renderCustomParamValue = (cp: CustomProjectParam, val: any) => {
    switch (cp.type) {
      case 'case à cocher': {
        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={Boolean(val)}
              readOnly
              disabled
              aria-label={cp.name}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 disabled:opacity-85 cursor-default"
            />
          </div>
        );
      }

      case 'date': {
        if (val === undefined || val === null || val === '') {
          return <span className="font-mono text-xs text-slate-400 select-none">__/__/____</span>;
        }
        const str = String(val);
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const formatted = match ? `${match[3]}/${match[2]}/${match[1]}` : str;
        return <span className="font-mono text-xs text-slate-700 font-medium">{formatted}</span>;
      }

      case 'nombre entier': {
        if (val === undefined || val === null || val === '') {
          return <span className="text-slate-300 font-mono">—</span>;
        }
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
        if (isNaN(num)) {
          return <span className="font-mono text-xs text-slate-800 font-semibold">{String(val)}</span>;
        }
        const formattedNum = new Intl.NumberFormat('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.round(num));
        return <span className="font-mono text-xs text-slate-800 font-semibold">{formattedNum}</span>;
      }

      case 'nombre avec 2 décimales': {
        if (val === undefined || val === null || val === '') {
          return <span className="text-slate-300 font-mono">—</span>;
        }
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
        if (isNaN(num)) {
          return <span className="font-mono text-xs text-slate-800 font-semibold">{String(val)}</span>;
        }
        const formattedNum = new Intl.NumberFormat('fr-FR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
        return <span className="font-mono text-xs text-slate-800 font-semibold">{formattedNum}</span>;
      }

      case 'liste de valeurs': {
        const items = Array.isArray(val)
          ? val.filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
          : val !== null && val !== undefined && String(val).trim() !== ''
          ? [String(val)]
          : [];

        if (items.length === 0) {
          return <span className="text-slate-300 font-mono">—</span>;
        }

        return (
          <div className="flex flex-wrap items-center gap-1">
            {items.map((item, idx) => (
              <span
                key={`${item}_${idx}`}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-800 border border-violet-200 shadow-2xs whitespace-nowrap"
                title={item}
              >
                {item}
              </span>
            ))}
          </div>
        );
      }

      case 'texte long':
      case 'texte court':
      default: {
        if (val === undefined || val === null || val === '') {
          return <span className="text-slate-300 font-mono">—</span>;
        }
        const str = String(val);
        const isTruncated = str.length > 15;
        const displayed = isTruncated ? `${str.slice(0, 15)}...` : str;
        if (isTruncated) {
          return (
            <Tooltip content={str}>
              <span className="text-xs text-slate-800 font-medium whitespace-nowrap cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">
                {displayed}
              </span>
            </Tooltip>
          );
        }
        return (
          <span className="text-xs text-slate-800 font-medium whitespace-nowrap">
            {displayed}
          </span>
        );
      }
    }
  };

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      if (col === 'roi' || col === 'bonus' || col === 'id') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const renderSortIcon = (col: SortColumn) => {
    if (sortColumn !== col) {
      return (
        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
      );
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-bold shrink-0" />
    );
  };

  // Projets filtrés et triés
  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'id':
          comparison = (a.projectNumber || 0) - (b.projectNumber || 0);
          break;
        case 'roi': {
          const isPrioritizedA = isProjectStatePrioritized(a.stateId);
          const isPrioritizedB = isProjectStatePrioritized(b.stateId);

          // Les projets dont l'état est à prioriser (avec numéro de priorité) viennent en premier (du numéro 1 au dernier),
          // puis tous les projets non priorisés par ordre décroissant de ROI
          if (isPrioritizedA !== isPrioritizedB) {
            return sortDirection === 'asc' ? (isPrioritizedA ? 1 : -1) : (isPrioritizedA ? -1 : 1);
          }

          const roiA = getProjectEffectiveRoi(a);
          const roiB = getProjectEffectiveRoi(b);

          if (roiA === null && roiB === null) {
            return (a.projectNumber || 0) - (b.projectNumber || 0);
          }
          if (roiA === null) return 1;
          if (roiB === null) return -1;

          const diff = roiA - roiB;
          if (diff !== 0) {
            return sortDirection === 'asc' ? diff : -diff;
          }
          return (a.projectNumber || 0) - (b.projectNumber || 0);
        }
        case 'name':
          comparison = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
          break;
        case 'state': {
          const stateA = getStateName(a.stateId);
          const stateB = getStateName(b.stateId);
          comparison = stateA.localeCompare(stateB, 'fr', { sensitivity: 'base' });
          break;
        }
        case 'pm': {
          const pmA = getUserName(a.projectManagerEmail);
          const pmB = getUserName(b.projectManagerEmail);
          comparison = pmA.localeCompare(pmB, 'fr', { sensitivity: 'base' });
          break;
        }
        case 'budgetLine': {
          const blA = getBudgetLineName(a.budgetLineId);
          const blB = getBudgetLineName(b.budgetLineId);
          comparison = blA.localeCompare(blB, 'fr', { sensitivity: 'base' });
          break;
        }
        case 'bonus': {
          const bonusA = getProjectBonus(a) ?? -Infinity;
          const bonusB = getProjectBonus(b) ?? -Infinity;
          comparison = bonusA - bonusB;
          break;
        }
        default: {
          if (sortColumn.startsWith('cp_')) {
            const cpId = sortColumn.replace('cp_', '');
            const cp = customParams.find((c) => c.id === cpId);
            const valA = a.customParamValues?.[cpId];
            const valB = b.customParamValues?.[cpId];

            const isEmptyA = valA === undefined || valA === null || valA === '';
            const isEmptyB = valB === undefined || valB === null || valB === '';

            if (isEmptyA && isEmptyB) {
              comparison = (a.projectNumber || 0) - (b.projectNumber || 0);
            } else if (isEmptyA) {
              comparison = 1;
            } else if (isEmptyB) {
              comparison = -1;
            } else if (cp?.type === 'case à cocher') {
              const boolA = valA === true ? 1 : 0;
              const boolB = valB === true ? 1 : 0;
              comparison = boolA - boolB;
            } else if (cp?.type === 'nombre entier' || cp?.type === 'nombre avec 2 décimales') {
              const numA = typeof valA === 'number' ? valA : parseFloat(String(valA)) || 0;
              const numB = typeof valB === 'number' ? valB : parseFloat(String(valB)) || 0;
              comparison = numA - numB;
            } else if (cp?.type === 'date') {
              comparison = String(valA).localeCompare(String(valB));
            } else if (Array.isArray(valA) || Array.isArray(valB)) {
              const strA = Array.isArray(valA) ? valA.join(', ') : String(valA);
              const strB = Array.isArray(valB) ? valB.join(', ') : String(valB);
              comparison = strA.localeCompare(strB, 'fr', { sensitivity: 'base' });
            } else {
              comparison = String(valA).localeCompare(String(valB), 'fr', { sensitivity: 'base' });
            }
          }
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredProjects, sortColumn, sortDirection, criteria, projectStates, budgetLines, users, bonusConfig, localBonuses, customParams]);

  // Analyse des quotas de bonus et identification du premier projet en dépassement selon le tri courant
  const bonusQuotaAnalysis = useMemo(() => {
    if (!bonusConfig.checkQuotas) {
      return {
        hasAlert: false,
        firstBreachingProjectId: null,
        firstBreachingProjectName: '',
        breachReason: '',
        breachingProjectsMap: new Map<string, { reason: string; labels: string[] }>(),
        breachingProjectsCount: 0,
        totalBonusedProjects: 0,
        totalDistributedBonus: 0,
      };
    }

    let bonusedCount = 0;
    let distributedPoints = 0;
    let firstBreachingProjectId: string | null = null;
    let firstBreachingProjectName = '';
    let breachReason = '';
    const breachingProjectsMap = new Map<string, { reason: string; labels: string[] }>();

    // On parcourt les projets dans l'ordre du tri effectué
    for (const p of sortedProjects) {
      const b = getProjectBonus(p);
      const bonus = typeof b === 'number' && !isNaN(b) ? b : 0;
      if (bonus > 0) {
        bonusedCount++;
        distributedPoints += bonus;

        const breaches: string[] = [];
        const labels: string[] = [];

        // a) "Bonus projet > ..." si c'est le nombre de point attribué à ce projet qui est trop élevé
        if (
          bonusConfig.maxBonusPointsPerProject !== null &&
          bonus > bonusConfig.maxBonusPointsPerProject
        ) {
          labels.push(`Bonus projet > ${bonusConfig.maxBonusPointsPerProject}`);
          breaches.push(
            `Bonus (${bonus} pts) supérieur au plafond par projet (${bonusConfig.maxBonusPointsPerProject} pts)`
          );
        }

        // b) "Total bonus > ..." si c'est le total de points distribué sur les projets précédents qui dépasse le seuil total fixé en paramètre
        if (
          bonusConfig.maxTotalBonusPoints !== null &&
          distributedPoints > bonusConfig.maxTotalBonusPoints
        ) {
          labels.push(`Total bonus > ${bonusConfig.maxTotalBonusPoints}`);
          breaches.push(
            `Total cumulé (${distributedPoints} pts) supérieur à l'enveloppe globale (${bonusConfig.maxTotalBonusPoints} pts)`
          );
        }

        // c) "Nb. bonus > ..." si c'est le nombre de bonus distribués sur les projets précédents
        if (
          bonusConfig.maxBonusedProjects !== null &&
          bonusedCount > bonusConfig.maxBonusedProjects
        ) {
          labels.push(`Nb. bonus > ${bonusConfig.maxBonusedProjects}`);
          breaches.push(
            `${bonusedCount}e projet bonussé (quota max : ${bonusConfig.maxBonusedProjects} projets)`
          );
        }

        if (labels.length > 0) {
          const reason = breaches.join(' • ');
          breachingProjectsMap.set(p.id, { reason, labels });
          if (!firstBreachingProjectId) {
            firstBreachingProjectId = p.id;
            firstBreachingProjectName = p.name;
            breachReason = reason;
          }
        }
      }
    }

    return {
      hasAlert: Boolean(firstBreachingProjectId),
      firstBreachingProjectId,
      firstBreachingProjectName,
      breachReason,
      breachingProjectsCount: breachingProjectsMap.size,
      breachingProjectsMap,
      totalBonusedProjects: bonusedCount,
      totalDistributedBonus: distributedPoints,
    };
  }, [sortedProjects, bonusConfig]);

  // Classement des projets selon leur priorité :
  // Le numéro de priorité ne doit être calculé que sur les projets dont l'état est coché "à prioriser".
  // Les projets non priorisés ne doivent pas avoir un numéro de priorité.
  const projectRoiRanks = useMemo(() => {
    const prioritizedWithRoi: { id: string; roi: number; projectNumber: number }[] = [];
    for (const p of projects) {
      if (!isProjectStatePrioritized(p.stateId)) continue;
      const roi = getProjectEffectiveRoi(p);
      if (roi !== null) {
        prioritizedWithRoi.push({ id: p.id, roi, projectNumber: p.projectNumber || 0 });
      }
    }
    // Tri décroissant selon le ROI (et par #ID pour départager en cas d'égalité)
    prioritizedWithRoi.sort((a, b) => {
      const diff = b.roi - a.roi;
      if (diff !== 0) return diff;
      return a.projectNumber - b.projectNumber;
    });

    const rankMap = new Map<string, number>();
    prioritizedWithRoi.forEach((item, index) => {
      rankMap.set(item.id, index + 1);
    });
    return rankMap;
  }, [projects, criteria, projectStates, bonusConfig, localBonuses]);

  // Défilement automatique pour que le premier projet en dépassement apparaisse en 2ème ligne
  useEffect(() => {
    if (!bonusConfig.checkQuotas || !bonusQuotaAnalysis.hasAlert || !bonusQuotaAnalysis.firstBreachingProjectId) {
      lastScrolledBreachKeyRef.current = null;
      return;
    }

    const breachId = bonusQuotaAnalysis.firstBreachingProjectId;
    const breachIndex = sortedProjects.findIndex((p) => p.id === breachId);
    if (breachIndex === -1) return;

    // Pour que le premier projet en dépassement apparaisse en 2ème ligne :
    // On cible la ligne précédente (breachIndex - 1) si elle existe, sinon la ligne 0
    const targetProject = breachIndex > 0 ? sortedProjects[breachIndex - 1] : sortedProjects[0];
    const targetId = targetProject.id;

    const scrollKey = `${breachId}_${targetId}_${sortColumn}_${sortDirection}_${sortedProjects.length}`;
    if (lastScrolledBreachKeyRef.current === scrollKey) {
      return;
    }
    lastScrolledBreachKeyRef.current = scrollKey;

    const timer = setTimeout(() => {
      const targetElement = rowRefs.current.get(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [
    bonusConfig.checkQuotas,
    bonusQuotaAnalysis.hasAlert,
    bonusQuotaAnalysis.firstBreachingProjectId,
    sortedProjects,
    sortColumn,
    sortDirection,
  ]);

  // Projets sélectionnés au lancement de l'option de suppression
  const projectsSelectedForDeletion = useMemo(() => {
    if (selectedProjectIds.length > 0) {
      return projects.filter((p) => selectedProjectIds.includes(p.id));
    }
    if (filteredProjects.length < projects.length) {
      return filteredProjects;
    }
    return [];
  }, [projects, selectedProjectIds, filteredProjects]);

  const isAllVisibleSelected =
    sortedProjects.length > 0 && sortedProjects.every((p) => selectedProjectIds.includes(p.id));
  const isSomeVisibleSelected =
    sortedProjects.some((p) => selectedProjectIds.includes(p.id)) && !isAllVisibleSelected;

  const handleToggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      const visibleIds = new Set(sortedProjects.map((p) => p.id));
      setSelectedProjectIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = sortedProjects.map((p) => p.id);
      setSelectedProjectIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3">
      {/* En-tête de section */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-blue-600 flex items-center gap-2.5">
            <Briefcase className="w-5 h-5 text-blue-600 shrink-0" />
            <span>{t('projects.title')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
            {t('projects.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Menu burger (Export, Import, Supprimer des projets) directement sur le fond de la frame - Réservé au Value Management Officer et au Super User */}
          {canAccessBurgerMenu && (
            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setActionsMenuOpen((prev) => !prev)}
                title={t('projects.import_export.burger_tooltip')}
                aria-label={t('projects.import_export.burger_title')}
                className="p-1 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-slate-200/60"
              >
                <Menu className="w-6 h-6" />
              </button>

              {actionsMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-1.5 animate-in fade-in zoom-in-95">
                  {/* En-tête / Titre du menu */}
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('projects.import_export.burger_title')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t('projects.import_export.burger_subtitle')}
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    {/* Option 1 : Exporter des projets */}
                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        setExportModalOpen(true);
                      }}
                      disabled={projects.length === 0}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-800 transition-colors flex items-start gap-2.5 group cursor-pointer disabled:opacity-50"
                    >
                      <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors shrink-0 mt-0.5">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {t('projects.import_export.export_title')}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                          {t('projects.import_export.export_desc')}
                        </div>
                      </div>
                    </button>

                    {/* Option 2 : Importer des projets */}
                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        setImportModalOpen(true);
                      }}
                      disabled={!canCreate}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-800 transition-colors flex items-start gap-2.5 group cursor-pointer disabled:opacity-50"
                    >
                      <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors shrink-0 mt-0.5">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                          {t('projects.import_export.import_title')}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                          {t('projects.import_export.import_desc')}
                        </div>
                      </div>
                    </button>

                    {/* Option 3 : Supprimer des projets */}
                    <div className="pt-1 border-t border-slate-100 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActionsMenuOpen(false);
                          setDeleteAllModalOpen(true);
                        }}
                        disabled={!canCreate || projects.length === 0}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-rose-50 text-rose-700 transition-colors flex items-start gap-2.5 group cursor-pointer disabled:opacity-50"
                      >
                        <div className="p-1.5 rounded-md bg-rose-100 text-rose-600 group-hover:bg-rose-200 transition-colors shrink-0 mt-0.5">
                          <Trash2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-rose-700 group-hover:text-rose-800 transition-colors">
                            {t('projects.import_export.delete_title')}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                            {t('projects.import_export.delete_desc')}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {canCreate && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0 h-8"
            >
              <Plus className="w-4 h-4" />
              <span>{t('projects.new_project')}</span>
            </button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="shrink-0 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 font-bold hover:underline cursor-pointer">
            Fermer
          </button>
        </div>
      )}

      {/* Barre de recherche et de filtres */}
      <div className="shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Recherche textuelle */}
          <div className="lg:col-span-3 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('projects.search_placeholder')}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filtre État du cycle de vie */}
          <div className="lg:col-span-3">
            <LifecycleStateFilter
              projectStates={projectStates}
              selectedStateIds={selectedStateIds}
              onChange={handleStateFilterChange}
              quickFilterType="prioritization"
            />
          </div>

          {/* Filtre Ligne budgétaire */}
          <div className="lg:col-span-2">
            <BudgetLineFilter
              budgetLines={budgetLines}
              selectedBudgetLineIds={selectedBudgetLineIds}
              onChange={handleBudgetLineFilterChange}
            />
          </div>

          {/* Bouton bascule Mes projets uniquement */}
          <div className="lg:col-span-2 flex items-center">
            <button
              type="button"
              onClick={handleToggleMyProjects}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                myProjectsOnly
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('projects.only_my_projects')}</span>
            </button>
          </div>

          {/* Bouton bascule Sélection manuelle */}
          <div className="lg:col-span-2 flex items-center">
            <Tooltip
              content={
                <div className="space-y-2 text-left">
                  <div className="font-bold text-white text-sm sm:text-base border-b border-white/20 pb-1">
                    {manualSelectionActive
                      ? `${t('projects.manual_selection')} — ${selectedProjectIds.length} ${
                          selectedProjectIds.length > 1
                            ? t('common.words.project_other')
                            : t('common.words.project_one')
                        }`
                      : t('projects.manual_selection')}
                  </div>
                  <p className="text-white/95 font-medium leading-relaxed text-[13px] sm:text-sm">
                    {t('projects.manual_selection_tooltip')}
                  </p>
                </div>
              }
              placement="bottom"
              maxWidthClass="max-w-sm sm:max-w-md"
              className="w-full flex"
            >
              <button
                type="button"
                onClick={handleToggleManualSelection}
                className={`w-full py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  manualSelectionActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                aria-label={
                  manualSelectionActive
                    ? `${t('projects.manual_selection')} (${selectedProjectIds.length})`
                    : t('projects.manual_selection')
                }
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>{t('projects.manual_selection')}</span>
                {manualSelectionActive && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/20 text-white">
                    {selectedProjectIds.length}
                  </span>
                )}
              </button>
            </Tooltip>
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
              {manualSelectionActive
                ? t('projects.counts.selected', {
                    selected: selectedProjectIds.length,
                    selected_word: selectedProjectIds.length > 1 ? t('common.words.project_other') : t('common.words.project_one'),
                    total: projects.length,
                    total_word: projects.length > 1 ? t('common.words.project_other') : t('common.words.project_one'),
                  })
                : hasActiveFilters
                ? t('projects.counts.filtered', {
                    filtered: filteredProjects.length,
                    filtered_word: filteredProjects.length > 1 ? t('common.words.project_other') : t('common.words.project_one'),
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
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStateIds(projectStates.map((s) => s.id));
                  setSelectedBudgetLineIds(budgetLines.map((b) => b.id));
                  setMyProjectsOnly(false);
                  setBonusedOnly(false);
                  setManualSelectionActive(false);
                  setSelectedProjectIds([]);
                }}
                className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('projects.clear_filters')}</span>
              </button>
            )}
          </div>

          {/* Case à cocher pour le Value Management Officer alignée horizontalement à droite */}
          {isValueManagementOfficer && (
            <label
              htmlFor="vmo-checkbox-show-confidential-priorities"
              className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-semibold text-slate-700 hover:text-slate-900 px-0.5 shrink-0"
            >
              <input
                type="checkbox"
                id="vmo-checkbox-show-confidential-priorities"
                checked={showConfidentialProjects}
                onChange={(e) => setShowConfidentialProjects(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
              <span className="text-xs" title={t('projects.show_confidential')}>
                {t('projects.show_confidential')}
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Encart Prise en compte des bonus */}
      {(() => {
        const hasQuotaAlert = bonusConfig.checkQuotas && bonusQuotaAnalysis.hasAlert;
        return (
          <div
            className={`shrink-0 rounded-xl transition-all shadow-xs p-3 space-y-2.5 ${
              hasQuotaAlert
                ? 'bg-amber-50/90 border-2 border-amber-300 text-amber-950'
                : 'bg-white border border-slate-200'
            }`}
          >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              {/* Titre de l'encart à gauche (pictogramme vert par défaut conservé en permanence) */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-200 shrink-0">
                  <Coins className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <span className="text-base font-bold text-slate-900 block leading-tight">
                    {t('projects.bonus_panel.title')}
                  </span>
                  {!canToggleBonus && (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{t('projects.bonus_panel.locked_tooltip')}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Les 3 boîtes à cocher avec pictogrammes (?) et bulles d'information au survol */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 xl:gap-8 xl:justify-end flex-wrap">
                {/* Boîte à cocher 1 : Bonus actifs */}
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="projects-checkbox-bonus-active"
                    checked={bonusConfig.isBonusActive}
                    disabled={!canToggleBonus || savingBonus}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleBonusActive();
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                  />
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="projects-checkbox-bonus-active"
                      className={`text-xs font-bold leading-tight ${
                        canToggleBonus ? 'cursor-pointer hover:text-teal-700' : 'cursor-default'
                      } ${bonusConfig.isBonusActive ? 'text-teal-950' : 'text-slate-800'}`}
                    >
                      {t('projects.bonus_panel.active_label')}
                    </label>
                    <Tooltip
                      content={
                        bonusConfig.isBonusActive
                          ? t('projects.bonus_panel.active_tooltip_on')
                          : t('projects.bonus_panel.active_tooltip_off')
                      }
                      placement="top"
                      maxWidthClass="w-56"
                    >
                      <span
                        tabIndex={0}
                        role="button"
                        className="text-slate-400 hover:text-slate-600 focus:text-slate-600 cursor-help inline-flex items-center"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </Tooltip>
                  </div>
                </div>

                {/* Boîte à cocher 2 : Vérification des quotas de bonus */}
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="projects-checkbox-bonus-quotas"
                    checked={bonusConfig.checkQuotas}
                    disabled={!canToggleBonus || savingBonus}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleCheckQuotas();
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                  />
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="projects-checkbox-bonus-quotas"
                      className={`text-xs font-bold leading-tight ${
                        canToggleBonus ? 'cursor-pointer hover:text-indigo-700' : 'cursor-default'
                      } ${bonusConfig.checkQuotas ? 'text-indigo-950' : 'text-slate-800'}`}
                    >
                      {t('projects.bonus_panel.quotas_label')}
                    </label>
                    <Tooltip
                      content={
                        bonusConfig.checkQuotas
                          ? t('projects.bonus_panel.quotas_tooltip_on')
                          : t('projects.bonus_panel.quotas_tooltip_off')
                      }
                      placement="top"
                      maxWidthClass="w-56"
                    >
                      <span
                        tabIndex={0}
                        role="button"
                        className="text-slate-400 hover:text-slate-600 focus:text-slate-600 cursor-help inline-flex items-center"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </Tooltip>
                  </div>
                </div>

                {/* Boîte à cocher 3 : Projets bonussés uniquement */}
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="projects-checkbox-bonused-only"
                    checked={bonusedOnly}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleBonusedOnlyChange(e.target.checked);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0"
                  />
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="projects-checkbox-bonused-only"
                      className={`text-xs font-bold leading-tight cursor-pointer ${
                        bonusedOnly ? 'text-teal-950' : 'text-slate-800 hover:text-teal-700'
                      }`}
                    >
                      {t('projects.bonus_panel.only_bonused_label')}
                    </label>
                    <Tooltip
                      content={t('projects.bonus_panel.only_bonused_tooltip')}
                      placement="top"
                      maxWidthClass="w-56"
                    >
                      <span
                        tabIndex={0}
                        role="button"
                        className="text-slate-400 hover:text-slate-600 focus:text-slate-600 cursor-help inline-flex items-center"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>

            {/* Message d'alerte des quotas de bonus (format direct et compact sur la même ligne) */}
            {hasQuotaAlert && (
              <div className="pt-3 border-t border-amber-200/90 flex items-center gap-2 flex-wrap text-xs text-amber-950 animate-in fade-in">
                <div className="p-1 bg-amber-100 rounded text-amber-700 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="font-bold text-amber-900 uppercase tracking-wider">
                  {t('projects.bonus_alert.title')}
                </span>
                <span className="font-medium bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full text-[11px]">
                  {t('projects.bonus_alert.active_sort')} {sortColumn === 'roi' ? t('projects.columns.roi') : sortColumn === 'bonus' ? t('projects.columns.bonus') : sortColumn === 'id' ? t('projects.columns.id') : sortColumn === 'name' ? t('projects.columns.name') : sortColumn === 'state' ? t('projects.columns.state') : sortColumn === 'pm' ? t('projects.columns.pm') : t('projects.columns.budget_line')} ({sortDirection === 'asc' ? 'asc' : 'desc'})
                </span>
                <span className="font-semibold text-amber-950">
                  {bonusQuotaAnalysis.breachingProjectsCount} {bonusQuotaAnalysis.breachingProjectsCount > 1 ? t('common.words.project_other') : t('common.words.project_one')} / {bonusQuotaAnalysis.totalBonusedProjects} ({bonusQuotaAnalysis.totalDistributedBonus} {bonusQuotaAnalysis.totalDistributedBonus > 1 ? t('common.words.point_other') : t('common.words.point_one')})
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Table des projets (ascenseur vertical dédié à la liste seule) */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden relative z-10">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            Chargement des projets...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {projects.length === 0 ? 'Aucun projet enregistré' : 'Aucun projet ne correspond aux filtres'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {projects.length === 0
                ? 'Les projets feront l’objet d’une priorisation sur la base des critères de valeur et de coût.'
                : 'Modifiez ou réinitialisez vos critères de recherche.'}
            </p>
            {canCreate && projects.length === 0 && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Créer le premier projet</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto [scrollbar-width:thin]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-30 bg-slate-100 uppercase font-semibold tracking-wider select-none">
                <tr>
                  {/* Case à cocher de sélection groupée (affichée uniquement lorsque la sélection manuelle est activée) */}
                  {manualSelectionActive && (
                    <th
                      scope="col"
                      className="sticky top-0 bg-slate-100 z-30 py-2.5 px-2 w-9 min-w-[36px] max-w-[36px] text-center border-r border-slate-200 table-header-double-bottom select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeVisibleSelected;
                        }}
                        onChange={handleToggleSelectAllVisible}
                        title="Sélectionner tous les projets affichés"
                        aria-label="Sélectionner tous les projets affichés"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                  )}

                  {/* ID */}
                  <th
                    scope="col"
                    onClick={() => handleSort('id')}
                    className="sticky top-0 bg-slate-100 z-30 py-2.5 px-1.5 w-14 min-w-[56px] max-w-[56px] text-center cursor-pointer select-none group hover:bg-slate-200/60 transition-colors border-r border-slate-200 table-header-double-bottom"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{t('projects.columns.id')}</span>
                      {renderSortIcon('id')}
                    </div>
                  </th>

                  {/* PRIORITE */}
                  <th
                    scope="col"
                    onClick={() => handleSort('roi')}
                    className="sticky top-0 bg-slate-100 z-30 py-2.5 px-1.5 w-24 min-w-[96px] max-w-[96px] text-center cursor-pointer select-none group hover:bg-slate-200/60 transition-colors border-r border-slate-200 table-header-double-bottom"
                  >
                    <Tooltip content={t('projects.tooltips.sort_priority')} className="w-full inline-block">
                      <div className="flex items-center justify-center gap-1 cursor-help">
                        <span>{t('projects.columns.roi')}</span>
                        {renderSortIcon('roi')}
                      </div>
                    </Tooltip>
                  </th>

                  {/* Projet (Nom & Description) */}
                  <th
                    scope="col"
                    onClick={() => handleSort('name')}
                    className="sticky top-0 bg-slate-100 z-30 py-2.5 px-4 min-w-[200px] cursor-pointer select-none group hover:bg-slate-200/60 transition-colors border-r border-slate-200 table-header-double-bottom"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t('projects.columns.name')}</span>
                      {renderSortIcon('name')}
                    </div>
                  </th>

                  {/* État (Cycle de vie) */}
                  <th
                    scope="col"
                    onClick={() => handleSort('state')}
                    className="sticky top-0 bg-slate-100 z-30 py-2.5 px-4 min-w-[140px] cursor-pointer select-none group hover:bg-slate-200/60 transition-colors border-r border-slate-200 table-header-double-bottom"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t('projects.columns.state')}</span>
                      {renderSortIcon('state')}
                    </div>
                  </th>

                  {/* Chef de projet & Adjoint */}
                  <th
                    scope="col"
                    onClick={() => handleSort('pm')}
                    className="sticky top-0 bg-slate-100 z-30 py-2.5 px-4 min-w-[180px] cursor-pointer select-none group hover:bg-slate-200/60 transition-colors border-r border-slate-200 table-header-double-bottom"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t('projects.columns.pm')}</span>
                      {renderSortIcon('pm')}
                    </div>
                  </th>

                  {/* Ligne budgétaire */}
                  <th
                    scope="col"
                    onClick={() => handleSort('budgetLine')}
                    className="sticky top-0 bg-slate-100 z-30 py-2.5 px-4 min-w-[150px] cursor-pointer select-none group hover:bg-slate-200/60 transition-colors border-r border-slate-200 table-header-double-bottom"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t('projects.columns.budget_line')}</span>
                      {renderSortIcon('budgetLine')}
                    </div>
                  </th>

                  {/* Bonus */}
                  <th
                    scope="col"
                    onClick={() => handleSort('bonus')}
                    className="sticky top-0 bg-slate-100 z-30 py-2.5 px-3 min-w-[85px] text-center cursor-pointer select-none group hover:bg-slate-200/60 transition-colors border-r border-slate-200 table-header-double-bottom"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t('projects.columns.bonus')}</span>
                      {renderSortIcon('bonus')}
                    </div>
                  </th>

                  {/* Paramètres personnalisés affichés dans le tableau (dans l'ordre défini) */}
                  {visibleCustomParams.map((cp) => {
                    const colKey = `cp_${cp.id}`;
                    const isCheckbox = cp.type === 'case à cocher';
                    const isDate = cp.type === 'date';
                    const isNumber = cp.type === 'nombre entier' || cp.type === 'nombre avec 2 décimales';
                    const isCentered = isCheckbox || isDate;
                    const isRightAligned = isNumber;
                    const widthClass = isCheckbox
                      ? 'w-px min-w-[50px] px-2'
                      : isDate
                      ? 'w-px min-w-[95px] px-2'
                      : isNumber
                      ? 'w-px min-w-[90px] px-2'
                      : 'min-w-[130px] px-3';
                    const maxTitleWidth = isCheckbox
                      ? 'max-w-[48px]'
                      : isDate
                      ? 'max-w-[70px]'
                      : isNumber
                      ? 'max-w-[75px]'
                      : 'max-w-[150px]';

                    const tooltipContent = (
                      <div className="space-y-1">
                        <div className="font-bold text-white text-sm">{cp.name}</div>
                        {cp.description ? (
                          <div className="text-white/90 text-xs font-normal leading-relaxed">
                            {cp.description}
                          </div>
                        ) : (
                          <div className="text-white/70 text-[11px] font-normal italic">
                            Paramètre personnalisé ({cp.type})
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <th
                        key={cp.id}
                        scope="col"
                        onClick={() => handleSort(colKey)}
                        className={`sticky top-0 bg-slate-100 z-30 py-2.5 ${widthClass} cursor-pointer select-none group hover:bg-slate-200/60 transition-colors border-r border-slate-200 table-header-double-bottom ${
                          isCentered ? 'text-center' : isRightAligned ? 'text-right' : 'text-left'
                        }`}
                      >
                        <Tooltip content={tooltipContent} className="w-full inline-block" placement="bottom">
                          <div
                            className={`flex items-center gap-1 ${
                              isCentered ? 'justify-center' : isRightAligned ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <span className={`truncate ${maxTitleWidth}`}>{cp.name}</span>
                            {renderSortIcon(colKey)}
                          </div>
                        </Tooltip>
                      </th>
                    );
                  })}

                  {/* Actions */}
                  <th scope="col" className="sticky top-0 bg-slate-100 z-30 py-2.5 px-4 w-24 text-right table-header-double-bottom">
                    {t('projects.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedProjects.map((p) => {
                  const userCanEdit = canEdit(p);
                  const isConfidentialHidden = Boolean(p.isConfidential) && !canViewConfidential(p);
                  const projectRoi = getProjectEffectiveRoi(p);
                  const breachInfo = bonusQuotaAnalysis.breachingProjectsMap.get(p.id);
                  const isBreaching = bonusConfig.checkQuotas && Boolean(breachInfo);
                  return (
                    <tr
                      key={p.id}
                      ref={(el) => {
                        if (el) {
                          rowRefs.current.set(p.id, el);
                        } else {
                          rowRefs.current.delete(p.id);
                        }
                      }}
                      className={`scroll-mt-28 transition-colors ${
                        isBreaching
                          ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Case à cocher de sélection individuelle (affichée uniquement lorsque la sélection manuelle est activée) */}
                      {manualSelectionActive && (
                        <td
                          className="py-2.5 px-2 text-center whitespace-nowrap border-r border-slate-200 select-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedProjectIds.includes(p.id)}
                            onChange={() => handleToggleSelectProject(p.id)}
                            title={`Sélectionner le projet #${p.projectNumber} ${p.name}`}
                            aria-label={`Sélectionner le projet #${p.projectNumber} ${p.name}`}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Colonne 1 : Identifiant de création unique */}
                      <td className="py-2.5 px-1.5 text-center whitespace-nowrap border-r border-slate-200">
                        <span className="font-mono font-bold text-xs bg-slate-900 text-white px-1.5 py-0.5 rounded-full shadow-2xs">
                          #{p.projectNumber}
                        </span>
                      </td>

                      {/* Colonne 2 : PRIORITE (Numéro de priorité pour états cochés "à prioriser", ROI affiché pour tous) */}
                      <td className="py-2.5 px-1.5 text-center whitespace-nowrap border-r border-slate-200">
                        {projectRoi !== null ? (
                          isProjectStatePrioritized(p.stateId) && projectRoiRanks.has(p.id) ? (
                            <div className="inline-flex items-center justify-center gap-1">
                              <span
                                className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs min-w-[20px] text-center"
                                title={t('projects.tooltips.priority_badge', { rank: projectRoiRanks.get(p.id) })}
                              >
                                {projectRoiRanks.get(p.id)}
                              </span>
                              <span
                                className="font-mono text-xs text-slate-500 font-medium"
                                title={`ROI : ${formatRoi(projectRoi)}`}
                              >
                                ({formatRoi(projectRoi)})
                              </span>
                            </div>
                          ) : (
                            <div
                              className="inline-flex items-center justify-center"
                              title={t('projects.tooltips.not_prioritized_state')}
                            >
                              <span className="font-mono text-xs text-slate-500 font-medium">
                                ({formatRoi(projectRoi)})
                              </span>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Colonne 3 : Nom et description (remplacé par la boîte CONFIDENTIEL si non autorisé) */}
                      <td className="py-2.5 px-4 border-r border-slate-200">
                        {isConfidentialHidden ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-100 text-red-600 border border-red-300 px-2.5 py-1 rounded-md shadow-2xs select-none"
                            title={t('projects.tooltips.confidential_badge')}
                          >
                            <Lock className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>{t('common.confidential').toUpperCase()}</span>
                          </span>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                              <span>{p.name}</span>
                              {p.isConfidential && (
                                <span
                                  className="inline-flex items-center justify-center p-1 rounded-md bg-rose-50 border border-red-300 text-red-600 shadow-2xs shrink-0"
                                  title={t('projects.tooltips.confidential_badge')}
                                >
                                  <Lock className="w-3.5 h-3.5 text-red-600" />
                                </span>
                              )}
                              {/* Petit pictogramme gris en forme de point d'interrogation dans un cercle */}
                              <Tooltip
                                content={
                                  <div>
                                    <div className="text-[10px] font-semibold text-slate-200 uppercase tracking-wider mb-1 flex items-center justify-between gap-4">
                                      <span>{t('projects.tooltips.description_title')}</span>
                                      {p.isConfidential && (
                                        <span className="text-rose-200 flex items-center gap-1 font-medium normal-case">
                                          <Lock className="w-2.5 h-2.5" />
                                          {t('common.confidential')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-white text-xs">
                                      {p.description?.trim() || (
                                        <span className="italic text-slate-300">{t('projects.tooltips.no_description')}</span>
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
                            {p.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 max-w-sm">
                                {p.description}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Colonne 3 : État du cycle de vie */}
                      <td className="py-2.5 px-4 border-r border-slate-200">
                        {canEdit(p) ? (
                          <div className="relative inline-flex items-center group/state">
                            <Tag className="w-3 h-3 text-indigo-600 absolute left-2.5 pointer-events-none z-10" />
                            <select
                              value={p.stateId}
                              onChange={(e) => handleDirectStateChange(p, e.target.value)}
                              disabled={updatingStateProjectId === p.id}
                              title={t('projects.tooltips.state_change')}
                              className="appearance-none inline-flex items-center pl-7 pr-7 py-1 rounded-full text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-colors shadow-2xs disabled:opacity-60 disabled:cursor-wait"
                            >
                              {projectStates.map((st) => (
                                <option key={st.id} value={st.id} className="text-slate-800 bg-white font-normal py-1">
                                  {st.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-indigo-600 absolute right-2.5 pointer-events-none z-10 transition-transform group-hover/state:translate-y-0.5" />
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-900 border border-indigo-200"
                            title={t('projects.tooltips.state_readonly')}
                          >
                            <Tag className="w-3 h-3 text-indigo-600" />
                            <span>{getStateName(p.stateId)}</span>
                          </span>
                        )}
                      </td>

                      {/* Colonne 4 : Chef de projet & Adjoint */}
                      <td className="py-2.5 px-4 border-r border-slate-200">
                        <div className="flex flex-col gap-0.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <span className="truncate max-w-[170px]" title={p.projectManagerEmail}>
                              {getUserName(p.projectManagerEmail)}
                            </span>
                          </div>
                          {p.deputyEmail && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate max-w-[170px]" title={`Adjoint : ${p.deputyEmail}`}>
                              <span className="text-slate-400">Adj:</span>
                              <span>{getUserName(p.deputyEmail)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Colonne 5 : Ligne budgétaire (remplacée par la boîte CONFIDENTIEL si non autorisé) */}
                      <td className="py-2.5 px-4 text-slate-700 border-r border-slate-200">
                        {isConfidentialHidden ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-red-600 border border-red-300 px-2 py-0.5 rounded-md shadow-2xs select-none"
                            title="Ligne budgétaire confidentielle masquée"
                          >
                            <Lock className="w-2.5 h-2.5 text-red-600 shrink-0" />
                            <span>CONFIDENTIEL</span>
                          </span>
                        ) : (() => {
                          const bl = budgetLines.find((b) => b.id === p.budgetLineId);
                          return (
                            <Tooltip content={bl ? `${bl.name} (${bl.budgetKe} K€)` : 'Ligne budgétaire non renseignée'}>
                              <span
                                className="truncate block max-w-[160px] text-xs font-semibold cursor-help"
                                style={bl?.color ? { color: bl.color } : undefined}
                              >
                                {bl ? bl.name : <span className="text-slate-400 italic font-normal">Non renseignée</span>}
                              </span>
                            </Tooltip>
                          );
                        })()}
                      </td>

                      {/* Colonne 6 : Bonus */}
                      <td className="py-2 px-3 text-center font-mono border-r border-slate-200">
                        {canToggleBonus ? (
                          <div className="inline-flex flex-col items-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={
                                  (localBonuses[p.id] !== undefined
                                    ? localBonuses[p.id]
                                    : p.bonus) ?? ''
                                }
                                onChange={(e) => handleBonusInputChange(p, e.target.value)}
                                onBlur={() => handleBonusInputBlur(p)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                placeholder="0"
                                className={`w-14 px-2 py-1 text-center font-mono font-bold text-xs rounded-md border transition-all ${
                                  isBreaching
                                    ? 'bg-amber-100 text-amber-950 border-amber-400 focus:ring-2 focus:ring-amber-500'
                                    : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
                                }`}
                                title="Saisir manuellement le bonus du projet (Value Management Officer)"
                              />
                              {isBreaching && (
                                <span
                                  className="text-xs shrink-0 cursor-help"
                                  title={`⚠️ Dépassement : ${breachInfo?.reason}`}
                                >
                                  ⚠️
                                </span>
                              )}
                            </div>
                            {isBreaching && breachInfo?.labels && breachInfo.labels.length > 0 && (
                              <div className="flex flex-col items-center mt-1 space-y-0.5">
                                {breachInfo.labels.map((lbl, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[9px] font-sans font-bold text-amber-900 bg-amber-200/90 border border-amber-300/80 px-1.5 py-0.5 rounded whitespace-nowrap leading-tight"
                                  >
                                    {lbl}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          typeof p.bonus === 'number' && p.bonus > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isBreaching
                                    ? 'bg-amber-200 text-amber-950 border border-amber-400 shadow-2xs'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                                title={
                                  isBreaching
                                    ? `⚠️ Dépassement : ${breachInfo?.reason}`
                                    : `Bonus : ${p.bonus} pts`
                                }
                              >
                                {p.bonus}
                                {isBreaching && <span className="ml-1 text-xs">⚠️</span>}
                              </span>
                              {isBreaching && breachInfo?.labels && breachInfo.labels.length > 0 && (
                                <div className="flex flex-col items-center mt-1 space-y-0.5">
                                  {breachInfo.labels.map((lbl, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] font-sans font-bold text-amber-900 bg-amber-200/90 border border-amber-300/80 px-1.5 py-0.5 rounded whitespace-nowrap leading-tight"
                                    >
                                      {lbl}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )
                        )}
                      </td>

                      {/* Colonnes des paramètres personnalisés affichés dans le tableau (dans l'ordre défini) */}
                      {visibleCustomParams.map((cp) => {
                        const rawVal = isConfidentialHidden ? null : p.customParamValues?.[cp.id];
                        const isCheckbox = cp.type === 'case à cocher';
                        const isDate = cp.type === 'date';
                        const isNumber = cp.type === 'nombre entier' || cp.type === 'nombre avec 2 décimales';
                        const isCentered = isCheckbox || isDate;
                        const isRightAligned = isNumber;
                        const tdWidthClass = (isCheckbox || isDate || isNumber)
                          ? 'w-px px-2'
                          : 'px-3';

                        return (
                          <td
                            key={cp.id}
                            className={`py-2.5 ${tdWidthClass} border-r border-slate-200 whitespace-nowrap ${
                              isCentered ? 'text-center' : isRightAligned ? 'text-right' : 'text-left'
                            }`}
                          >
                            {isConfidentialHidden ? (
                              <span className="text-slate-300 font-mono">—</span>
                            ) : (
                              renderCustomParamValue(cp, rawVal)
                            )}
                          </td>
                        );
                      })}

                      {/* Colonne : Actions */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end">
                          <ProjectActionButton
                            project={p}
                            permissionContext={permissionContext}
                            onOpenProject={(proj, isReadOnly) => {
                              setSelectedProject(proj);
                              setIsReadOnlyModal(isReadOnly);
                              setModalOpen(true);
                            }}
                            onDeleteProject={(proj) => setDeleteCandidate(proj)}
                            showDelete={true}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Projet (4 encarts) */}
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

      {/* Modal Confirmation de suppression */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Supprimer le projet ?
                </h3>
                <p className="text-xs text-slate-500">
                  L'identifiant #{deleteCandidate.projectNumber} ne sera jamais réutilisé
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Êtes-vous sûr de vouloir supprimer définitivement le projet{' '}
              <strong className="text-slate-900 font-semibold">
                #{deleteCandidate.projectNumber} « {deleteCandidate.name} »
              </strong>{' '}
              ?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fenêtre 1 : Lancement de l'importation de projets (CSV) */}
      <ProjectsImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        refs={{
          projectStates,
          budgetLines,
          criteria,
          customParams,
          skills,
          users,
          bonusConfig,
        }}
        currentProjects={projects}
        currentUserEmail={activeUser?.email || ''}
        onSuccess={(result) => {
          setImportModalOpen(false);
          setLastImportResult(result);
          setImportResultModalOpen(true);
          setActionSuccess(
            `Import terminé : ${result.successCount} ${result.successCount > 1 ? 'projets importés' : 'projet importé'} (${result.warningCount} ${result.warningCount > 1 ? 'avertissements' : 'avertissement'}, ${result.errorCount} ${result.errorCount > 1 ? 'échecs' : 'échec'}).`
          );
          setTimeout(() => setActionSuccess(null), 6000);
        }}
      />

      {/* Fenêtre 2 : Restitution du résultat de l'importation & journal d'audit */}
      <ProjectsImportResultModal
        isOpen={importResultModalOpen}
        onClose={() => setImportResultModalOpen(false)}
        result={lastImportResult}
      />

      {/* Modal d'export de projets (tous ou sélectionnés) */}
      <ExportProjectsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        projects={projects}
        selectedProjects={projectsSelectedForDeletion}
        onExport={(targets) => handleExportProjects(targets)}
      />

      {/* Modal de suppression de projets (tous ou sélectionnés) */}
      <DeleteAllProjectsModal
        isOpen={deleteAllModalOpen}
        onClose={() => setDeleteAllModalOpen(false)}
        projects={projects}
        selectedProjects={projectsSelectedForDeletion}
        onSuccess={(count) => {
          setSelectedProjectIds([]);
          setActionSuccess(`${count} ${count > 1 ? 'projets supprimés' : 'projet supprimé'} avec succès.`);
          setTimeout(() => setActionSuccess(null), 5000);
        }}
      />
    </div>
  );
};
