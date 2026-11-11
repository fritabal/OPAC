import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../types/project';
import { BudgetLine } from '../types/budget';
import { Lock, GripVertical } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { TOOLTIP_MAX_WIDTH_CLASS } from '../constants/ui';
import { formatRoi } from '../utils/roiCalculator';
import { hexToRgba } from '../constants/colors';
import {
  ProjectPermissionContext,
  canViewConfidentialProject,
  canEditProject,
} from '../utils/projectPermissions';

interface ProjectKanbanCardProps {
  project: Project;
  budgetLine?: BudgetLine;
  isStaffed?: boolean;
  priorityRank?: number;
  roi: number | null;
  isPrioritizedState: boolean;
  permissionContext: ProjectPermissionContext;
  onOpenProject: (project: Project) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, project: Project) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  isUpdatingState?: boolean;
}

export const ProjectKanbanCard: React.FC<ProjectKanbanCardProps> = ({
  project,
  budgetLine,
  isStaffed = true,
  priorityRank,
  roi,
  isPrioritizedState,
  permissionContext,
  onOpenProject,
  onDragStart,
  onDragEnd,
  isUpdatingState = false,
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const isConfidentialHidden =
    Boolean(project.isConfidential) && !canViewConfidentialProject(project, permissionContext);
  const userCanEdit = canEditProject(project, permissionContext);
  const isDraggable = userCanEdit && !isConfidentialHidden && !isUpdatingState;

  // Couleur de la ligne budgétaire pleine pour toutes les cartes (staffées ou non)
  const rawLineColor = budgetLine?.color || '#94a3b8';
  const cardBg = isConfidentialHidden ? '#f1f5f9' : hexToRgba(rawLineColor, 0.42);
  const cardBorder = isConfidentialHidden ? '#cbd5e1' : hexToRgba(rawLineColor, 0.65);

  const handleClick = () => {
    if (isDragging) return;
    if (isConfidentialHidden) return;
    onOpenProject(project);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.setData('application/json', JSON.stringify({ projectId: project.id, currentStateId: project.stateId }));
    e.dataTransfer.setData('text/plain', project.id);
    e.dataTransfer.effectAllowed = 'move';

    if (onDragStart) {
      onDragStart(e, project);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
      }}
      className={`group relative rounded-lg p-2.5 border transition-all duration-150 select-none shadow-2xs ${
        isDragging
          ? 'opacity-40 border-indigo-400 shadow-md scale-95 cursor-grabbing'
          : isConfidentialHidden
          ? 'opacity-85 cursor-default'
          : isDraggable
          ? 'hover:shadow-sm cursor-grab active:cursor-grabbing hover:brightness-95'
          : 'hover:shadow-sm cursor-pointer hover:brightness-95'
      } ${isUpdatingState ? 'pointer-events-none opacity-60 animate-pulse' : ''}`}
    >
      {/* Ligne d'en-tête de la carte : Poignée de déplacement (si éditable) + Numéro du projet à gauche, Priorité / ROI à droite */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1 min-w-0 shrink-0">
          {isDraggable && (
            <span
              className="text-slate-400 group-hover:text-slate-600 transition-colors cursor-grab active:cursor-grabbing -ml-0.5"
              title={t('projects.kanban_drag_tooltip', 'Glisser-déposer pour changer d’état')}
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="font-mono font-bold text-[11px] bg-slate-900 text-white px-1.5 py-0.5 rounded-full shadow-2xs shrink-0">
            #{project.projectNumber}
          </span>
        </div>

        {/* Priorité globale & ROI */}
        <div className="flex items-center gap-1 shrink-0">
          {roi !== null ? (
            isPrioritizedState && priorityRank !== undefined ? (
              <div className="inline-flex items-center gap-1">
                <span
                  className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-white/90 text-indigo-700 border border-indigo-200 shadow-2xs text-center"
                  title={t('projects.tooltips.priority_badge', { rank: priorityRank })}
                >
                  {priorityRank}
                </span>
                <span className="font-mono text-[10px] text-slate-600 font-medium">
                  ({formatRoi(roi)})
                </span>
              </div>
            ) : (
              <span className="font-mono text-[10px] text-slate-600 font-medium">
                ({formatRoi(roi)})
              </span>
            )
          ) : (
            <span className="text-slate-400 text-xs font-mono">-</span>
          )}
        </div>
      </div>

      {/* Contenu : Nom du projet OU badge CONFIDENTIEL rouge sur fond rose */}
      {isConfidentialHidden ? (
        <div className="flex items-center gap-1.5 py-0.5">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-rose-100 text-red-600 border border-red-300 px-2 py-0.5 rounded shadow-2xs select-none"
            title={t('projects.tooltips.confidential_badge', 'Projet confidentiel')}
          >
            <Lock className="w-3 h-3 text-red-600 shrink-0" />
            <span>CONFIDENTIEL</span>
          </span>
        </div>
      ) : (
        <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
          {project.isConfidential && (
            <Lock className="w-3 h-3 text-rose-500 inline mr-1 -mt-0.5 shrink-0" />
          )}
          {project.description && project.description.trim() ? (
            <Tooltip
              title={project.name}
              content={project.description.trim()}
              placement="right"
              maxWidthClass={TOOLTIP_MAX_WIDTH_CLASS}
            >
              <span className="hover:underline">{project.name}</span>
            </Tooltip>
          ) : (
            <span>{project.name}</span>
          )}
        </div>
      )}

      {/* Ligne inférieure : Ligne budgétaire à gauche + Boîte STAFFÉ (rose) / NON STAFFÉ (gris) à droite */}
      <div className="mt-2 pt-1.5 border-t border-black/5 flex items-center justify-between gap-1.5 min-h-[22px]">
        {/* Ligne budgétaire (ou CONFIDENTIEL si masqué) */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-[62%] truncate">
          {isConfidentialHidden ? (
            <span
              className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-100 text-red-600 border border-red-300 px-1.5 py-0.5 rounded shadow-2xs select-none"
              title="Ligne budgétaire confidentielle masquée"
            >
              <Lock className="w-2.5 h-2.5 text-red-600 shrink-0" />
              <span>CONFIDENTIEL</span>
            </span>
          ) : budgetLine ? (
            <div className="flex items-center gap-1.5 truncate" title={budgetLine.name}>
              <span
                className="w-2 h-2 rounded-full shrink-0 border border-white/60 shadow-2xs"
                style={{ backgroundColor: rawLineColor }}
              />
              <span className="text-[10px] text-slate-700 font-medium truncate">
                {budgetLine.name}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 italic truncate">
              {t('reports.matrix.no_budget_line', 'Sans ligne')}
            </span>
          )}
        </div>

        {/* Boîte STAFFÉ sur fond rose ou NON STAFFÉ sur fond gris alignée à droite */}
        <div className="shrink-0 ml-auto">
          {isStaffed ? (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs whitespace-nowrap uppercase tracking-wider"
              title={t('projects.kanban_staffed_tooltip', 'Projet staffé : pris en compte dans le capacitaire')}
            >
              {t('projects.kanban_staffed_badge', 'STAFFÉ')}
            </span>
          ) : (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs whitespace-nowrap uppercase tracking-wider"
              title={t('projects.kanban_unstaffed_tooltip', 'Projet non staffé : exclu du capacitaire')}
            >
              {t('projects.kanban_unstaffed_badge', 'NON STAFFÉ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
