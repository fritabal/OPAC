import React from 'react';
import { Pencil, Eye, Lock, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Project } from '../types/project';
import {
  ProjectPermissionContext,
  canEditProject,
  canViewConfidentialProject,
  canDeleteProject,
} from '../utils/projectPermissions';

interface ProjectActionButtonProps {
  project: Project;
  permissionContext: ProjectPermissionContext;
  onOpenProject: (project: Project, isReadOnly: boolean) => void;
  onDeleteProject?: (project: Project) => void;
  showDelete?: boolean;
}

export const ProjectActionButton: React.FC<ProjectActionButtonProps> = ({
  project,
  permissionContext,
  onOpenProject,
  onDeleteProject,
  showDelete = false,
}) => {
  const { t } = useTranslation();
  const isConfidentialHidden =
    Boolean(project.isConfidential) && !canViewConfidentialProject(project, permissionContext);
  const userCanEdit = canEditProject(project, permissionContext);
  const userCanDelete = showDelete && canDeleteProject(project, permissionContext);

  if (isConfidentialHidden) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span
          className="w-[26px] h-[26px] flex items-center justify-center text-slate-400 select-none cursor-not-allowed rounded-md"
          title={t('projects.tooltips.confidential_locked', 'Projet confidentiel — Visualisation et modification interdites')}
        >
          <Lock className="w-3.5 h-3.5 text-slate-400" />
        </span>
        {showDelete && <div className="w-[26px] h-[26px] shrink-0" aria-hidden="true" />}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {userCanEdit ? (
        <button
          type="button"
          onClick={() => onOpenProject(project, false)}
          className="w-[26px] h-[26px] flex items-center justify-center rounded-md transition-colors cursor-pointer text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
          title={t('projects.tooltips.edit_project', 'Modifier ce projet')}
          aria-label={t('projects.tooltips.edit_project', 'Modifier ce projet')}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onOpenProject(project, true)}
          className="w-[26px] h-[26px] flex items-center justify-center rounded-md transition-colors cursor-pointer text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          title={t('projects.tooltips.view_project', 'Consulter ce projet (Lecture seule)')}
          aria-label={t('projects.tooltips.view_project', 'Consulter ce projet (Lecture seule)')}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}

      {userCanDelete && onDeleteProject ? (
        <button
          type="button"
          onClick={() => onDeleteProject(project)}
          className="w-[26px] h-[26px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
          title={t('projects.actions.delete', 'Supprimer ce projet')}
          aria-label={t('projects.actions.delete', 'Supprimer ce projet')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : showDelete ? (
        <div className="w-[26px] h-[26px] shrink-0" aria-hidden="true" />
      ) : null}
    </div>
  );
};
