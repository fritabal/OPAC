import React from 'react';
import { Pencil, Eye, Lock, Trash2, LineChart, Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Project } from '../types/project';
import {
  ProjectPermissionContext,
  canEditProject,
  canViewConfidentialProject,
  canDeleteProject,
  isUserProjectManagerOfProject,
} from '../utils/projectPermissions';
import { isSuperAdminEmail } from '../services/userService';

interface ProjectActionButtonProps {
  project: Project;
  permissionContext: ProjectPermissionContext;
  onOpenProject: (project: Project, isReadOnly: boolean) => void;
  onOpenHistory?: (project: Project) => void;
  onOpenStaffingPlan?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  showDelete?: boolean;
}

export const ProjectActionButton: React.FC<ProjectActionButtonProps> = ({
  project,
  permissionContext,
  onOpenProject,
  onOpenHistory,
  onOpenStaffingPlan,
  onDeleteProject,
  showDelete = false,
}) => {
  const { t } = useTranslation();
  const isConfidentialHidden =
    Boolean(project.isConfidential) && !canViewConfidentialProject(project, permissionContext);
  const userCanEdit = canEditProject(project, permissionContext);
  const userCanDelete = showDelete && canDeleteProject(project, permissionContext);

  const isPM = isUserProjectManagerOfProject(project, permissionContext.activeUser);
  const isVMO = Boolean(
    permissionContext.isValueManagementOfficer ||
      permissionContext.effectiveRole === 'value management officer'
  );
  const isSU = Boolean(
    permissionContext.isSuperUser ||
      (!permissionContext.effectiveRole &&
        permissionContext.activeUser?.email &&
        isSuperAdminEmail(permissionContext.activeUser.email))
  );
  const canOpenStaffingPlan = !isConfidentialHidden && Boolean(isPM || isVMO || isSU);

  if (isConfidentialHidden) {
    return (
      <div className="flex items-center justify-end gap-1 pr-1 w-full">
        <span
          className="w-[24px] h-[24px] flex items-center justify-center text-slate-400 select-none cursor-not-allowed rounded-md shrink-0"
          title={t('projects.tooltips.confidential_locked', 'Projet confidentiel — Visualisation et modification interdites')}
        >
          <Lock className="w-3.5 h-3.5 text-slate-400" />
        </span>
        {onOpenHistory && <div className="w-[24px] h-[24px] shrink-0" aria-hidden="true" />}
        {canOpenStaffingPlan && onOpenStaffingPlan && <div className="w-[24px] h-[24px] shrink-0" aria-hidden="true" />}
        {showDelete && <div className="w-[24px] h-[24px] shrink-0" aria-hidden="true" />}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1 pr-1 w-full">
      {/* 1. Pictogramme Gauge (si accessible) */}
      {canOpenStaffingPlan && onOpenStaffingPlan && (
        <button
          type="button"
          onClick={() => onOpenStaffingPlan(project)}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-md transition-colors cursor-pointer text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
          title={t('capacity.staffing_plan.button_tooltip', 'Plan de staffing prévisionnel et Reste à Terminaison (RAT)')}
          aria-label={t('capacity.staffing_plan.button_tooltip', 'Plan de staffing prévisionnel et Reste à Terminaison (RAT)')}
        >
          <Gauge className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 2. Crayon ou Œil */}
      {userCanEdit ? (
        <button
          type="button"
          onClick={() => onOpenProject(project, false)}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-md transition-colors cursor-pointer text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
          title={t('projects.tooltips.edit_project', 'Modifier ce projet')}
          aria-label={t('projects.tooltips.edit_project', 'Modifier ce projet')}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onOpenProject(project, true)}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-md transition-colors cursor-pointer text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
          title={t('projects.tooltips.view_project', 'Consulter ce projet (Lecture seule)')}
          aria-label={t('projects.tooltips.view_project', 'Consulter ce projet (Lecture seule)')}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 3. À droite : pictogramme d'accès à l'historique */}
      {onOpenHistory && (
        <button
          type="button"
          onClick={() => onOpenHistory(project)}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-md transition-colors cursor-pointer text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
          title={t('capacity.history.button_tooltip', 'Historique des demandes capacitaires')}
          aria-label={t('capacity.history.button_tooltip', 'Historique des demandes capacitaires')}
        >
          <LineChart className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 4. Suppression (si activée) */}
      {userCanDelete && onDeleteProject ? (
        <button
          type="button"
          onClick={() => onDeleteProject(project)}
          className="w-[24px] h-[24px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer shrink-0"
          title={t('projects.actions.delete', 'Supprimer ce projet')}
          aria-label={t('projects.actions.delete', 'Supprimer ce projet')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : showDelete ? (
        <div className="w-[24px] h-[24px] shrink-0" aria-hidden="true" />
      ) : null}
    </div>
  );
};
