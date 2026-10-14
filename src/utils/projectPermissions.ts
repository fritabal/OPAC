import { Project } from '../types/project';
import { AppUser, UserRole } from '../types/user';
import { isSuperAdminEmail } from '../services/userService';

export interface ProjectPermissionContext {
  activeUser: AppUser | null;
  isSuperUser: boolean;
  isValueManagementOfficer: boolean;
  isAdmin?: boolean;
  isResourceManager?: boolean;
  isProjectManager?: boolean;
  effectiveRole?: UserRole;
  showConfidentialProjects?: boolean;
}

/**
 * Détermine si l'utilisateur agit uniquement sous la persona Responsable de ressources
 */
export function isActingAsResourceManager(ctx: ProjectPermissionContext): boolean {
  return (
    ctx.effectiveRole === 'resource manager' ||
    (Boolean(ctx.isResourceManager) &&
      !ctx.isSuperUser &&
      !ctx.isAdmin &&
      !ctx.isProjectManager &&
      !ctx.isValueManagementOfficer)
  );
}

/**
 * Droit d'édition par projet :
 * Seul le chef de projet ou son adjoint ainsi que le Value Management Officer (et le Super User)
 * ont le droit de modifier un projet.
 * Un Responsable de ressources ne peut pas modifier un projet.
 */
export function canEditProject(project: Project, ctx: ProjectPermissionContext): boolean {
  if (isActingAsResourceManager(ctx)) return false;
  if (ctx.isSuperUser || ctx.isValueManagementOfficer) return true;
  if (!ctx.activeUser?.email) return false;
  const userEmail = ctx.activeUser.email.toLowerCase().trim();
  if (isSuperAdminEmail(userEmail)) return true;
  const pmEmail = (project.projectManagerEmail || '').toLowerCase().trim();
  const deputyEmail = (project.deputyEmail || '').toLowerCase().trim();
  return userEmail === pmEmail || userEmail === deputyEmail;
}

/**
 * Droit de visualisation d'un projet confidentiel :
 * - Chef de projet et adjoint ont toujours accès.
 * - Super User et Super Admin ont toujours accès.
 * - En tant que Value Management Officer : masqué par défaut (pour partage d'écran),
 *   sauf si la case "Afficher projets confidentiels" est cochée.
 * - Tout autre utilisateur n'a pas accès.
 */
export function canViewConfidentialProject(
  project: Project,
  ctx: ProjectPermissionContext
): boolean {
  if (!project.isConfidential) return true;
  if (ctx.isValueManagementOfficer) {
    return Boolean(ctx.showConfidentialProjects);
  }
  if (ctx.isSuperUser) return true;
  if (!ctx.activeUser?.email) return false;
  const userEmail = ctx.activeUser.email.toLowerCase().trim();
  if (isSuperAdminEmail(userEmail)) return true;
  const pmEmail = (project.projectManagerEmail || '').toLowerCase().trim();
  const deputyEmail = (project.deputyEmail || '').toLowerCase().trim();
  return userEmail === pmEmail || userEmail === deputyEmail;
}

/**
 * Droit de suppression d'un projet :
 * Seul le chef de projet, son adjoint, le Value Management Officer ou le Super User peuvent supprimer.
 * Requiert également les droits d'édition.
 */
export function canDeleteProject(project: Project, ctx: ProjectPermissionContext): boolean {
  if (isActingAsResourceManager(ctx)) return false;
  if (!canEditProject(project, ctx)) return false;
  if (ctx.isSuperUser || ctx.isValueManagementOfficer) return true;
  if (!ctx.activeUser?.email) return false;
  const userEmail = ctx.activeUser.email.toLowerCase().trim();
  if (isSuperAdminEmail(userEmail)) return true;
  const pmEmail = (project.projectManagerEmail || '').toLowerCase().trim();
  const deputyEmail = (project.deputyEmail || '').toLowerCase().trim();
  return userEmail === pmEmail || userEmail === deputyEmail;
}
