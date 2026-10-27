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
 * Vérifie si l'utilisateur possède le rôle Chef de projet (soit actif, soit simulé, soit parmi ses rôles).
 */
export function hasProjectManagerRole(ctx: ProjectPermissionContext): boolean {
  if (ctx.isSuperUser) return true;
  if (ctx.isProjectManager) return true;
  if (ctx.effectiveRole === 'chef de projet') return true;
  const userRoles =
    ctx.activeUser?.roles && ctx.activeUser.roles.length > 0
      ? ctx.activeUser.roles
      : ctx.activeUser?.role
      ? [ctx.activeUser.role]
      : [];
  return userRoles.includes('chef de projet') || userRoles.includes('super user');
}

/**
 * Vérifie si l'utilisateur connecté est le chef de projet désigné ou l'adjoint sur ce projet.
 */
export function isUserProjectManagerOfProject(project: Project, user: AppUser | null): boolean {
  if (!user) return false;
  const userEmail = (user.email || '').toLowerCase().trim();
  const userId = (user.id || '').toLowerCase().trim();
  const pmEmail = (project.projectManagerEmail || '').toLowerCase().trim();
  const deputyEmail = (project.deputyEmail || '').toLowerCase().trim();

  return Boolean(
    (userEmail && (userEmail === pmEmail || userEmail === deputyEmail)) ||
    (userId && (userId === pmEmail || userId === deputyEmail))
  );
}

/**
 * Détermine si l'utilisateur agit EXCLUSIVEMENT sous la persona Responsable de ressources
 * (donc sans rôle Chef de projet, Administrateur, VMO ou Super User).
 */
export function isActingAsResourceManager(ctx: ProjectPermissionContext): boolean {
  // Si le Super User endosse explicitement le rôle Responsable de ressources dans la barre d'endossement
  if (
    ctx.effectiveRole === 'resource manager' &&
    !ctx.isProjectManager &&
    !ctx.isAdmin &&
    !ctx.isValueManagementOfficer &&
    !ctx.isSuperUser
  ) {
    return true;
  }

  // Si l'utilisateur est Responsable de ressources sans avoir le rôle Chef de projet, Administrateur, VMO ou Super User
  return Boolean(
    ctx.isResourceManager &&
      !ctx.isProjectManager &&
      !ctx.isSuperUser &&
      !ctx.isAdmin &&
      !ctx.isValueManagementOfficer
  );
}

/**
 * Droit d'édition par projet :
 * - Le Super User (hors simulation de rôle restreint) a plein accès.
 * - Le Value Management Officer a le droit de modifier tous les projets.
 * - Tout utilisateur ayant le rôle de Chef de projet ET qui est le Chef de projet (ou adjoint) de ce projet
 *   DOIT pouvoir disposer du crayon et ouvrir la fenêtre de modification du projet.
 * - En revanche, un utilisateur qui n'a pas le rôle de Chef de projet sur ce projet (ou qui consulte le projet d'un tiers)
 *   ne dispose que du mode consultation (icône œil / lecture seule).
 */
export function canEditProject(project: Project, ctx: ProjectPermissionContext): boolean {
  // 1. Super User sans rôle endossé restrictif : accès total en écriture
  if (ctx.isSuperUser) return true;

  // 2. Value Management Officer : modification autorisée sur tous les projets
  if (ctx.isValueManagementOfficer) return true;

  // 3. Quand l'utilisateur a un rôle de Chef de projet ET est le Chef de projet (ou adjoint) de ce projet :
  // Droit absolu de modifier ce projet avec le crayon !
  const isPM = hasProjectManagerRole(ctx);
  const isOwnerPM = isUserProjectManagerOfProject(project, ctx.activeUser);
  if (isPM && isOwnerPM) {
    return true;
  }

  // 4. Si l'utilisateur agit exclusivement comme Responsable de ressources : pas de modification
  if (isActingAsResourceManager(ctx)) return false;

  // 5. Compte Super Admin en mode standard (sans rôle endossé)
  if (!ctx.effectiveRole && ctx.activeUser?.email && isSuperAdminEmail(ctx.activeUser.email)) {
    return true;
  }

  return false;
}

/**
 * Droit de visualisation d'un projet confidentiel :
 * - Chef de projet et adjoint désignés sur le projet ont toujours accès.
 * - Super User a toujours accès.
 * - En tant que Value Management Officer : masqué par défaut (pour partage d'écran),
 *   sauf si la case "Afficher projets confidentiels" est cochée.
 * - Tout autre utilisateur n'a pas accès.
 */
export function canViewConfidentialProject(
  project: Project,
  ctx: ProjectPermissionContext
): boolean {
  if (!project.isConfidential) return true;
  if (ctx.isSuperUser) return true;
  if (ctx.isValueManagementOfficer) {
    return Boolean(ctx.showConfidentialProjects);
  }
  if (isUserProjectManagerOfProject(project, ctx.activeUser)) {
    return true;
  }
  if (!ctx.effectiveRole && ctx.activeUser?.email && isSuperAdminEmail(ctx.activeUser.email)) {
    return true;
  }
  return false;
}

/**
 * Droit de suppression d'un projet :
 * Seul le chef de projet désigné (ayant le rôle chef de projet), le Value Management Officer ou le Super User peuvent supprimer.
 */
export function canDeleteProject(project: Project, ctx: ProjectPermissionContext): boolean {
  if (isActingAsResourceManager(ctx)) return false;
  if (ctx.isSuperUser || ctx.isValueManagementOfficer) return true;
  if (!canEditProject(project, ctx)) return false;
  const isPM = hasProjectManagerRole(ctx);
  const isOwnerPM = isUserProjectManagerOfProject(project, ctx.activeUser);
  return isPM && isOwnerPM;
}
