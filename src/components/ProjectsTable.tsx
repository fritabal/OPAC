import React, { useState, useMemo, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { Project } from '../types/project';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { Criterion } from '../types/criteria';
import { CustomProjectParam } from '../types/customParam';
import { AppUser, UserRole } from '../types/user';
import { BonusConfig, DEFAULT_BONUS_CONFIG } from '../types/bonus';
import { saveBonusConfig } from '../services/bonusService';
import { deleteProject, updateProject } from '../services/projectService';
import { ProjectModal } from './ProjectModal';
import { calculateProjectRoi, formatRoi } from '../utils/roiCalculator';

type SortColumn = 'id' | 'roi' | 'name' | 'state' | 'pm' | 'budgetLine' | 'bonus';
type SortDirection = 'asc' | 'desc';

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
  users: AppUser[];
  bonusConfig?: BonusConfig;
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
  users,
  bonusConfig = DEFAULT_BONUS_CONFIG,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);

  const [deleteCandidate, setDeleteCandidate] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [budgetLineFilter, setBudgetLineFilter] = useState('');
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);

  const hasActiveFilters = Boolean(searchQuery.trim() || stateFilter || budgetLineFilter || myProjectsOnly);

  // Tri du tableau des projets
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Détection si l'utilisateur agit sous la casquette Resource Manager
  const isActingAsResourceManager =
    effectiveRole === 'resource manager' ||
    (isResourceManager && !isAdmin && !isValueManagementOfficer && !isSuperUser);

  // Droits globaux : En tant que Resource Manager, interdiction de créer ou détruire des projets
  const canCreate = !isActingAsResourceManager && (isValueManagementOfficer || isSuperUser || isAdmin);
  const canDelete = !isActingAsResourceManager && (isValueManagementOfficer || isSuperUser || isAdmin);

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

  // Droit d'édition par projet : En tant que Resource Manager, interdiction de modifier des projets
  const canEdit = (project: Project): boolean => {
    if (isActingAsResourceManager) return false;
    if (isValueManagementOfficer || isSuperUser || isAdmin) return true;
    if (!activeUser?.email) return false;
    const userEmail = activeUser.email.toLowerCase();
    const pmEmail = project.projectManagerEmail.toLowerCase();
    const deputyEmail = project.deputyEmail ? project.deputyEmail.toLowerCase() : '';
    return userEmail === pmEmail || userEmail === deputyEmail;
  };

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
        isProjectStatePrioritized(p.stateId),
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

  const handleOpenCreate = () => {
    setSelectedProject(null);
    setIsReadOnlyModal(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Project) => {
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
      // Recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesNumber = `#${p.projectNumber}`.includes(q) || String(p.projectNumber).includes(q);
        const matchesPM = p.projectManagerEmail.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesNumber && !matchesPM) return false;
      }

      // Filtre état
      if (stateFilter && p.stateId !== stateFilter) return false;

      // Filtre ligne budgétaire
      if (budgetLineFilter && p.budgetLineId !== budgetLineFilter) return false;

      // Mes projets uniquement
      if (myProjectsOnly && activeUser?.email) {
        const uEmail = activeUser.email.toLowerCase();
        const pm = p.projectManagerEmail.toLowerCase();
        const dep = p.deputyEmail ? p.deputyEmail.toLowerCase() : '';
        if (uEmail !== pm && uEmail !== dep) return false;
      }

      return true;
    });
  }, [projects, searchQuery, stateFilter, budgetLineFilter, myProjectsOnly, activeUser]);

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

  // Obtenir le ROI effectif d'un projet : calculé uniquement si son état est « à prioriser », sinon strictement null (vide)
  const getProjectEffectiveRoi = (p: Project): number | null => {
    if (!isProjectStatePrioritized(p.stateId)) {
      return null;
    }
    return calculateProjectRoi(
      p.criteriaValues,
      criteria,
      true,
      getProjectBonus(p),
      bonusConfig.isBonusActive
    );
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
          const roiA = getProjectEffectiveRoi(a);
          const roiB = getProjectEffectiveRoi(b);

          // Règle métier : Les projets dont l'état a « à prioriser » à FAUX ont un ROI vide
          // et sont systématiquement rejetés en fin de liste quel que soit le sens du tri
          if (roiA === null && roiB === null) {
            return (b.projectNumber || 0) - (a.projectNumber || 0);
          }
          if (roiA === null) return 1; // A sans ROI -> après B
          if (roiB === null) return -1; // B sans ROI -> après A

          const diff = roiA - roiB;
          return sortDirection === 'asc' ? diff : -diff;
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
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredProjects, sortColumn, sortDirection, criteria, projectStates, budgetLines, users, bonusConfig, localBonuses]);

  // Analyse des quotas de bonus et identification du premier projet en dépassement selon le tri courant
  const bonusQuotaAnalysis = useMemo(() => {
    if (!bonusConfig.checkQuotas) {
      return {
        hasAlert: false,
        firstBreachingProjectId: null,
        firstBreachingProjectName: '',
        breachReason: '',
        breachingProjectsMap: new Map<string, string>(),
        totalBonusedProjects: 0,
        totalDistributedBonus: 0,
      };
    }

    let bonusedCount = 0;
    let distributedPoints = 0;
    let firstBreachingProjectId: string | null = null;
    let firstBreachingProjectName = '';
    let breachReason = '';
    const breachingProjectsMap = new Map<string, string>();

    // On parcourt les projets dans l'ordre du tri effectué
    for (const p of sortedProjects) {
      const b = getProjectBonus(p);
      const bonus = typeof b === 'number' && !isNaN(b) ? b : 0;
      if (bonus > 0) {
        bonusedCount++;
        distributedPoints += bonus;

        const breaches: string[] = [];

        // 1. Dépassement points max par projet
        if (
          bonusConfig.maxBonusPointsPerProject !== null &&
          bonus > bonusConfig.maxBonusPointsPerProject
        ) {
          breaches.push(
            `Bonus (${bonus} pts) supérieur au plafond par projet (${bonusConfig.maxBonusPointsPerProject} pts)`
          );
        }

        // 2. Dépassement nombre max de projets bonussés
        if (
          bonusConfig.maxBonusedProjects !== null &&
          bonusedCount > bonusConfig.maxBonusedProjects
        ) {
          breaches.push(
            `${bonusedCount}e projet bonussé (quota max : ${bonusConfig.maxBonusedProjects} projets)`
          );
        }

        // 3. Dépassement total points de bonus à distribuer
        if (
          bonusConfig.maxTotalBonusPoints !== null &&
          distributedPoints > bonusConfig.maxTotalBonusPoints
        ) {
          breaches.push(
            `Total cumulé (${distributedPoints} pts) supérieur à l'enveloppe globale (${bonusConfig.maxTotalBonusPoints} pts)`
          );
        }

        if (breaches.length > 0) {
          const reason = breaches.join(' • ');
          breachingProjectsMap.set(p.id, reason);
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
      breachingProjectsMap,
      totalBonusedProjects: bonusedCount,
      totalDistributedBonus: distributedPoints,
    };
  }, [sortedProjects, bonusConfig]);

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-blue-600 flex items-center gap-2.5">
            <Briefcase className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Portefeuille Projets</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {isValueManagementOfficer || isSuperUser
              ? 'En tant que Value Management Officer, créez, qualifiez, modifiez et supprimez l’ensemble des projets du portefeuille.'
              : isActingAsResourceManager
              ? 'En tant que Resource Manager, vous visualisez l’ensemble des projets du portefeuille en mode consultation (lecture seule).'
              : 'Consultez les projets et mettez à jour ceux sur lesquels vous êtes désigné Chef de projet ou Adjoint.'}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau projet</span>
          </button>
        )}
      </div>

      {/* Information de restriction de profil pour Resource Manager */}
      {isActingAsResourceManager && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Mode consultation :</strong> En tant que Resource Manager, vous visualisez l'ensemble des projets du portefeuille en lecture seule pour apprécier les besoins et la mobilisation des compétences clés. La création, la modification et la suppression de projets sont réservées aux profils habilités.
          </span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 font-bold hover:underline cursor-pointer">
            Fermer
          </button>
        </div>
      )}

      {/* Barre de recherche et de filtres */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Recherche textuelle */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, #ID, chef de projet..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filtre État du cycle de vie */}
          <div className="lg:col-span-3">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les états du cycle de vie</option>
              {projectStates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre Ligne budgétaire */}
          <div className="lg:col-span-3">
            <select
              value={budgetLineFilter}
              onChange={(e) => setBudgetLineFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 truncate"
            >
              <option value="">Toutes les lignes budgétaires</option>
              {budgetLines.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bouton bascule Mes projets uniquement */}
          <div className="lg:col-span-2 flex items-center">
            <button
              type="button"
              onClick={() => setMyProjectsOnly(!myProjectsOnly)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                myProjectsOnly
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Mes projets</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              hasActiveFilters
                ? 'bg-blue-50 border border-blue-200 text-blue-900'
                : 'bg-slate-100 border border-slate-200 text-slate-600'
            }`}
          >
            {hasActiveFilters
              ? `${filteredProjects.length} projet${filteredProjects.length > 1 ? 's' : ''} sur ${projects.length} projet${projects.length > 1 ? 's' : ''} au total`
              : `${projects.length} projet${projects.length > 1 ? 's' : ''} au total`}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStateFilter('');
                setBudgetLineFilter('');
                setMyProjectsOnly(false);
              }}
              className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser les filtres</span>
            </button>
          )}
        </div>
      </div>

      {/* Encart Paramètres des Bonus (répliqué depuis l'onglet Critères - format compact en ligne) */}
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Titre de l'encart à gauche */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-200">
            <Coins className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              Paramètres des bonus
            </span>
            {!canToggleBonus && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Modification réservée au Value Management Officer</span>
              </span>
            )}
          </div>
        </div>

        {/* Les 2 paramètres à droite du titre, sans boîte autour */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 xl:justify-end">
          {/* Paramètre 1 : Bonus actifs */}
          <div className="flex items-start gap-2.5 select-none">
            <input
              type="checkbox"
              id="projects-checkbox-bonus-active"
              checked={bonusConfig.isBonusActive}
              disabled={!canToggleBonus || savingBonus}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleBonusActive();
              }}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
            />
            <div>
              <label
                htmlFor="projects-checkbox-bonus-active"
                className={`text-xs font-bold block leading-tight ${
                  canToggleBonus ? 'cursor-pointer hover:text-teal-700' : 'cursor-default'
                } ${bonusConfig.isBonusActive ? 'text-teal-950' : 'text-slate-800'}`}
              >
                Bonus actifs
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {bonusConfig.isBonusActive ? (
                  <span className="text-teal-900 font-medium">
                    Prend en compte les bonus projet<br />dans le calcul du ROI
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Ne prend pas en compte les bonus<br />dans le calcul du ROI
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Paramètre 2 : Vérification des quotas de bonus */}
          <div className="flex items-start gap-2.5 select-none">
            <input
              type="checkbox"
              id="projects-checkbox-bonus-quotas"
              checked={bonusConfig.checkQuotas}
              disabled={!canToggleBonus || savingBonus}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleCheckQuotas();
              }}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
            />
            <div>
              <label
                htmlFor="projects-checkbox-bonus-quotas"
                className={`text-xs font-bold block leading-tight ${
                  canToggleBonus ? 'cursor-pointer hover:text-indigo-700' : 'cursor-default'
                } ${bonusConfig.checkQuotas ? 'text-indigo-950' : 'text-slate-800'}`}
              >
                Vérification des quotas de bonus
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {bonusConfig.checkQuotas ? (
                  <span className="text-indigo-900 font-medium">
                    Contrôle les quotas et alerte<br />au premier dépassement selon le tri
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Ne vérifie pas les quotas<br />de bonus
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerte dépassement quota de bonus (selon le tri effectué) */}
      {bonusConfig.checkQuotas && bonusQuotaAnalysis.hasAlert && (
        <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs text-amber-900 uppercase tracking-wider">
                  Alerte Quota de Bonus
                </span>
                <span className="text-[11px] font-medium bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                  Tri actif : {sortColumn === 'roi' ? 'ROI' : sortColumn === 'bonus' ? 'Bonus' : sortColumn} ({sortDirection === 'asc' ? 'croissant' : 'décroissant'})
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                Le <strong>premier projet en dépassement</strong> est{' '}
                <span className="font-bold underline decoration-amber-500">
                  « {bonusQuotaAnalysis.firstBreachingProjectName} »
                </span>{' '}
                : {bonusQuotaAnalysis.breachReason}
              </p>
            </div>
          </div>
          <div className="sm:text-right shrink-0 bg-white/80 p-2.5 rounded-lg border border-amber-200">
            <div className="text-[11px] text-amber-800 font-medium">Cumul sur la sélection :</div>
            <div className="text-xs font-mono font-bold text-amber-950">
              {bonusQuotaAnalysis.totalBonusedProjects} projet(s) bonussé(s) • {bonusQuotaAnalysis.totalDistributedBonus} pts
            </div>
          </div>
        </div>
      )}

      {/* Table des projets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 uppercase font-semibold tracking-wider border-b border-slate-200 select-none">
                <tr>
                  {/* ID */}
                  <th
                    scope="col"
                    onClick={() => handleSort('id')}
                    className="py-3 px-4 w-24 text-center cursor-pointer select-none group hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>ID</span>
                      {renderSortIcon('id')}
                    </div>
                  </th>

                  {/* ROI */}
                  <th
                    scope="col"
                    onClick={() => handleSort('roi')}
                    className="py-3 px-4 w-28 text-center cursor-pointer select-none group hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>ROI</span>
                      {renderSortIcon('roi')}
                    </div>
                  </th>

                  {/* Projet (Nom & Description) */}
                  <th
                    scope="col"
                    onClick={() => handleSort('name')}
                    className="py-3 px-4 min-w-[200px] cursor-pointer select-none group hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Projet (Nom &amp; Description)</span>
                      {renderSortIcon('name')}
                    </div>
                  </th>

                  {/* État (Cycle de vie) */}
                  <th
                    scope="col"
                    onClick={() => handleSort('state')}
                    className="py-3 px-4 min-w-[150px] cursor-pointer select-none group hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>État (Cycle de vie)</span>
                      {renderSortIcon('state')}
                    </div>
                  </th>

                  {/* Chef de projet & Adjoint */}
                  <th
                    scope="col"
                    onClick={() => handleSort('pm')}
                    className="py-3 px-4 min-w-[190px] cursor-pointer select-none group hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Chef de projet &amp; Adjoint</span>
                      {renderSortIcon('pm')}
                    </div>
                  </th>

                  {/* Ligne budgétaire */}
                  <th
                    scope="col"
                    onClick={() => handleSort('budgetLine')}
                    className="py-3 px-4 min-w-[160px] cursor-pointer select-none group hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Ligne budgétaire</span>
                      {renderSortIcon('budgetLine')}
                    </div>
                  </th>

                  {/* Bonus */}
                  <th
                    scope="col"
                    onClick={() => handleSort('bonus')}
                    className="py-3 px-4 min-w-[90px] text-center cursor-pointer select-none group hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Bonus</span>
                      {renderSortIcon('bonus')}
                    </div>
                  </th>

                  {/* Actions */}
                  <th scope="col" className="py-3 px-4 w-24 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedProjects.map((p) => {
                  const userCanEdit = canEdit(p);
                  const projectRoi = getProjectEffectiveRoi(p);
                  const breachInfo = bonusQuotaAnalysis.breachingProjectsMap.get(p.id);
                  const isFirstBreach = p.id === bonusQuotaAnalysis.firstBreachingProjectId;
                  const isBreaching = Boolean(breachInfo);
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isFirstBreach
                          ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-500'
                          : isBreaching
                          ? 'bg-amber-50/30 hover:bg-amber-50/60'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Colonne 1 : Identifiant de création unique */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full shadow-2xs">
                          #{p.projectNumber}
                        </span>
                      </td>

                      {/* Colonne 2 : ROI (Valeur / Coût) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {projectRoi !== null ? (
                          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                            {formatRoi(projectRoi)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Colonne 3 : Nom et description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {isFirstBreach && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-300">
                              ⚠️ 1er dépassement quota
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 max-w-sm">
                            {p.description}
                          </p>
                        )}
                      </td>

                      {/* Colonne 3 : État du cycle de vie */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-900 border border-indigo-200">
                          <Tag className="w-3 h-3 text-indigo-600" />
                          <span>{getStateName(p.stateId)}</span>
                        </span>
                      </td>

                      {/* Colonne 4 : Chef de projet & Adjoint */}
                      <td className="py-3 px-4">
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

                      {/* Colonne 5 : Ligne budgétaire */}
                      <td className="py-3 px-4 text-slate-700">
                        <span className="truncate block max-w-[160px]" title={getBudgetLineName(p.budgetLineId)}>
                          {getBudgetLineName(p.budgetLineId)}
                        </span>
                      </td>

                      {/* Colonne 6 : Bonus */}
                      <td className="py-2.5 px-3 text-center font-mono">
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
                                  isFirstBreach
                                    ? 'bg-amber-100 text-amber-950 border-amber-400 focus:ring-2 focus:ring-amber-500'
                                    : isBreaching
                                    ? 'bg-amber-50 text-amber-900 border-amber-300 focus:ring-2 focus:ring-amber-400'
                                    : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
                                }`}
                                title="Saisir manuellement le bonus du projet (Value Management Officer)"
                              />
                              {isBreaching && (
                                <span
                                  className="text-xs shrink-0 cursor-help"
                                  title={
                                    isFirstBreach
                                      ? `🚨 1er dépassement quota : ${breachInfo}`
                                      : `⚠️ Dépassement : ${breachInfo}`
                                  }
                                >
                                  ⚠️
                                </span>
                              )}
                            </div>
                            {isFirstBreach && (
                              <span className="text-[9px] font-sans font-bold text-amber-800 uppercase tracking-tighter mt-0.5">
                                1er dépassement
                              </span>
                            )}
                          </div>
                        ) : (
                          typeof p.bonus === 'number' && p.bonus > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isFirstBreach
                                    ? 'bg-amber-200 text-amber-950 border border-amber-400 shadow-2xs'
                                    : isBreaching
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                                title={
                                  isFirstBreach
                                    ? `🚨 PREMIER PROJET EN DÉPASSEMENT : ${breachInfo}`
                                    : isBreaching
                                    ? `⚠️ Dépassement : ${breachInfo}`
                                    : `Bonus : ${p.bonus} pts`
                                }
                              >
                                {p.bonus}
                                {isBreaching && <span className="ml-1 text-xs">⚠️</span>}
                              </span>
                              {isFirstBreach && (
                                <span className="text-[9px] font-sans font-bold text-amber-800 uppercase tracking-tighter mt-0.5">
                                  1er dépassement
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )
                        )}
                      </td>

                      {/* Colonne 8 : Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              userCanEdit
                                ? 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                            title={userCanEdit ? 'Modifier ce projet' : 'Consulter ce projet (Lecture seule)'}
                          >
                            {userCanEdit ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteCandidate(p)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Supprimer ce projet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
    </div>
  );
};
