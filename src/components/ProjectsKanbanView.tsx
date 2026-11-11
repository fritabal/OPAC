import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../types/project';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { ProjectKanbanCard } from './ProjectKanbanCard';
import { ProjectPermissionContext } from '../utils/projectPermissions';
import { GitFork, Briefcase } from 'lucide-react';

interface ProjectsKanbanViewProps {
  projects: Project[];
  states: ProjectState[];
  budgetLines?: BudgetLine[];
  selectedStateIds: string[];
  projectRoiRanks: Map<string, number>;
  getProjectEffectiveRoi: (project: Project) => number | null;
  isProjectStatePrioritized: (stateId: string) => boolean;
  permissionContext: ProjectPermissionContext;
  onOpenProject: (project: Project) => void;
  onMoveProjectState?: (project: Project, targetStateId: string) => Promise<void>;
  updatingStateProjectId?: string | null;
  loading?: boolean;
}

export const ProjectsKanbanView: React.FC<ProjectsKanbanViewProps> = ({
  projects,
  states,
  budgetLines = [],
  selectedStateIds,
  projectRoiRanks,
  getProjectEffectiveRoi,
  isProjectStatePrioritized,
  permissionContext,
  onOpenProject,
  onMoveProjectState,
  updatingStateProjectId,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [activeDropStateId, setActiveDropStateId] = useState<string | null>(null);

  // Helper : vérifie si le projet est staffé (son état a pour attribut "à staffer", ou case cochée)
  const isProjectStaffed = (p: Project): boolean => {
    const s = states.find((st) => st.id === p.stateId);
    const stateNeedsStaffing = Boolean(s?.needsStaffing);
    if (!stateNeedsStaffing) {
      return p.isStaffed === true;
    }
    return p.isStaffed !== false;
  };

  // Filtrer les colonnes d'états selon le filtre d'états sélectionnés
  // et les ordonner par l'ordre séquentiel du cycle de vie
  const displayedStates = useMemo(() => {
    const list = states.filter((s) => selectedStateIds.includes(s.id));
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [states, selectedStateIds]);

  // Regrouper et trier les projets par état
  // Règle de tri dans chacune des colonnes :
  // Ordre croissant de priorité (i.e. décroissant de ROI dans chacune des colonnes, comme dans l'onglet capacitaire)
  const projectsByState = useMemo(() => {
    const map = new Map<string, Project[]>();

    // Initialiser les listes pour tous les états affichés
    displayedStates.forEach((state) => {
      map.set(state.id, []);
    });

    // Répartir les projets filtrés dans leurs colonnes d'états
    projects.forEach((project) => {
      if (project.stateId && map.has(project.stateId)) {
        map.get(project.stateId)!.push(project);
      }
    });

    // Trier les projets dans chaque colonne selon la priorité / ROI décroissant :
    // 1) Si l'état est à prioriser : les projets avec ROI calculé sont triés par priorité croissante (ROI décroissant),
    //    puis par numéro de projet en cas d'égalité, puis ceux sans ROI
    // 2) Si l'état n'est pas à prioriser : tri par ROI décroissant, puis par numéro de projet
    map.forEach((projectList) => {
      projectList.sort((a, b) => {
        const roiA = getProjectEffectiveRoi(a);
        const roiB = getProjectEffectiveRoi(b);

        if (roiA === null && roiB === null) {
          return (a.projectNumber || 0) - (b.projectNumber || 0);
        }
        if (roiA === null) return 1;
        if (roiB === null) return -1;

        const diff = roiB - roiA; // Décroissant de ROI = croissant de priorité
        if (diff !== 0) return diff;

        return (a.projectNumber || 0) - (b.projectNumber || 0);
      });
    });

    return map;
  }, [projects, displayedStates, getProjectEffectiveRoi]);

  const handleCardDragStart = (_e: React.DragEvent<HTMLDivElement>, project: Project) => {
    setDraggedProject(project);
  };

  const handleCardDragEnd = () => {
    setDraggedProject(null);
    setActiveDropStateId(null);
  };

  const handleDragOverColumn = (e: React.DragEvent<HTMLDivElement>, stateId: string) => {
    // Si aucun projet en cours de déplacement ou si le projet est déjà dans cet état
    if (!draggedProject || draggedProject.stateId === stateId) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropStateId !== stateId) {
      setActiveDropStateId(stateId);
    }
  };

  const handleDragLeaveColumn = (e: React.DragEvent<HTMLDivElement>, stateId: string) => {
    // Éviter le clignotement si on survole les enfants
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    if (activeDropStateId === stateId) {
      setActiveDropStateId(null);
    }
  };

  const handleDropColumn = async (e: React.DragEvent<HTMLDivElement>, targetStateId: string) => {
    e.preventDefault();
    setActiveDropStateId(null);

    let targetProjectId = draggedProject?.id;
    if (!targetProjectId) {
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (raw) {
          const parsed = JSON.parse(raw);
          targetProjectId = parsed.projectId;
        } else {
          targetProjectId = e.dataTransfer.getData('text/plain');
        }
      } catch {
        targetProjectId = e.dataTransfer.getData('text/plain');
      }
    }

    if (!targetProjectId) return;
    const proj = projects.find((p) => p.id === targetProjectId) || draggedProject;
    if (!proj) return;

    if (proj.stateId === targetStateId) return;

    setDraggedProject(null);

    if (onMoveProjectState) {
      await onMoveProjectState(proj, targetStateId);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-[300px] flex items-center justify-center p-12 text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
        {t('projects.loading', 'Chargement des projets...')}
      </div>
    );
  }

  if (displayedStates.length === 0) {
    return (
      <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <GitFork className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 mb-1">
          {t('projects.kanban_no_states', 'Aucun état sélectionné')}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {t(
            'projects.kanban_no_states_desc',
            'Sélectionnez au moins un état dans le filtre des états pour afficher les colonnes du Kanban.'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
      <div className="h-full flex gap-3 min-w-max pb-2">
        {displayedStates.map((state) => {
          const stateProjects = projectsByState.get(state.id) || [];
          const isPrioritized = Boolean(state.needsPrioritization);
          const isDropTarget = activeDropStateId === state.id;
          const isSourceColumn = draggedProject?.stateId === state.id;

          return (
            <div
              key={state.id}
              onDragOver={(e) => handleDragOverColumn(e, state.id)}
              onDragLeave={(e) => handleDragLeaveColumn(e, state.id)}
              onDrop={(e) => handleDropColumn(e, state.id)}
              className={`flex flex-col shrink-0 w-72 sm:w-80 h-full max-h-full rounded-xl border transition-all duration-150 overflow-hidden ${
                isDropTarget
                  ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                  : isSourceColumn
                  ? 'bg-slate-50/50 border-slate-300'
                  : 'bg-slate-50/80 border-slate-200'
              }`}
            >
              {/* En-tête de colonne avec nom de l'état à gauche et nombre de projets avec mot "projets" à droite */}
              <div className="p-2.5 bg-slate-100/90 border-b border-slate-200/80 flex items-center justify-between gap-2 select-none shrink-0">
                <span className="text-xs font-bold text-slate-800 truncate">
                  {state.name}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap shrink-0">
                  {t('projects.kanban_project_count', {
                    count: stateProjects.length,
                    word:
                      stateProjects.length > 1
                        ? t('common.words.project_other')
                        : t('common.words.project_one'),
                  })}
                </span>
              </div>

              {/* Corps de la colonne défilant verticalement avec les cartes de projets */}
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 [scrollbar-width:thin]">
                {stateProjects.length === 0 ? (
                  <div
                    className={`h-28 flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 border-dashed transition-colors ${
                      isDropTarget
                        ? 'border-indigo-400 bg-indigo-100/40 text-indigo-700 font-semibold'
                        : 'border-transparent text-slate-400'
                    }`}
                  >
                    <Briefcase className="w-5 h-5 mb-1.5 opacity-40" />
                    <span className="text-[11px] italic">
                      {isDropTarget
                        ? t('projects.kanban_drop_here', 'Déposer ici')
                        : t('projects.kanban_empty_column', 'Aucun projet')}
                    </span>
                  </div>
                ) : (
                  <>
                    {stateProjects.map((project) => (
                      <ProjectKanbanCard
                        key={project.id}
                        project={project}
                        budgetLine={budgetLines.find((b) => b.id === project.budgetLineId)}
                        isStaffed={isProjectStaffed(project)}
                        priorityRank={projectRoiRanks.get(project.id)}
                        roi={getProjectEffectiveRoi(project)}
                        isPrioritizedState={isPrioritized}
                        permissionContext={permissionContext}
                        onOpenProject={onOpenProject}
                        onDragStart={handleCardDragStart}
                        onDragEnd={handleCardDragEnd}
                        isUpdatingState={updatingStateProjectId === project.id}
                      />
                    ))}
                    {isDropTarget && (
                      <div className="p-2 text-center rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-100/30 text-indigo-700 text-xs font-medium animate-pulse">
                        {t('projects.kanban_drop_here', 'Déposer ici')}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
