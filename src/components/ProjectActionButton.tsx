import React from 'react';
import { Pencil, Eye, Lock, Trash2 } from 'lucide-react';
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
  const isConfidentialHidden =
    Boolean(project.isConfidential) && !canViewConfidentialProject(project, permissionContext);
  const userCanEdit = canEditProject(project, permissionContext);
  const userCanDelete = showDelete && canDeleteProject(project, permissionContext);

  if (isConfidentialHidden) {
    return (
      <span
        className="p-1.5 text-slate-400 select-none cursor-not-allowed inline-flex items-center rounded-md"
        title="Projet confidentiel — Visualisation et modification interdites"
      >
        <Lock className="w-3.5 h-3.5 text-slate-400" />
      </span>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      {userCanEdit ? (
        <button
          type="button"
          onClick={() => onOpenProject(project, false)}
          className="p-1.5 rounded-md transition-colors cursor-pointer text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
          title="Modifier ce projet"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onOpenProject(project, true)}
          className="p-1.5 rounded-md transition-colors cursor-pointer text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          title="Consulter ce projet (Lecture seule)"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}

      {userCanDelete && onDeleteProject && (
        <button
          type="button"
          onClick={() => onDeleteProject(project)}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
          title="Supprimer ce projet"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
