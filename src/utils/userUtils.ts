import { AppUser, UserRole } from '../types/user';

/**
 * Extrait les initiales d'un utilisateur (ex: Stéphane Labati -> SL)
 */
export function getUserInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
}

/**
 * Retourne la liste des rôles effectifs d'un utilisateur (avec fallback)
 */
export function getUserRoles(u?: AppUser | null): UserRole[] {
  if (!u) return [];
  if (u.roles && Array.isArray(u.roles) && u.roles.length > 0) {
    return u.roles;
  }
  if (u.role) return [u.role];
  return ['chef de projet'];
}

/**
 * Vérifie si l'utilisateur possède un rôle donné
 */
export function userHasRole(u: AppUser | undefined | null, role: UserRole): boolean {
  if (!u) return false;
  return getUserRoles(u).includes(role);
}

/**
 * Normalise une chaîne pour une recherche insensible à la casse, aux accents et caractères spéciaux
 */
export const normalizeForSearch = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[ß]/g, 'ss')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐ]/g, 'd')
    .replace(/[ðÐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Résout le nom d'affichage d'un utilisateur à partir de sa clé (email en priorité, ou id pour rétrocompatibilité)
 * et de la liste globale des utilisateurs. Si l'utilisateur n'est pas trouvé, renvoie le fallback fourni ou la clé.
 */
export function resolveUserDisplayName(
  keyOrEmail: string | undefined | null,
  users: AppUser[],
  fallbackName?: string
): string {
  if (!keyOrEmail || !keyOrEmail.trim()) {
    return fallbackName || '';
  }
  const cleanKey = keyOrEmail.trim().toLowerCase();
  
  // Recherche 1 : par email (prioritaire car l'email est la clé unique métier)
  const userByEmail = users.find((u) => (u.email || '').trim().toLowerCase() === cleanKey);
  if (userByEmail && userByEmail.displayName) {
    return userByEmail.displayName;
  }

  // Recherche 2 : par id de document (rétrocompatibilité avec les anciens enregistrements)
  const userById = users.find((u) => u.id === keyOrEmail.trim());
  if (userById && userById.displayName) {
    return userById.displayName;
  }

  // Fallback : nom stocké précédemment ou clé brute
  return fallbackName || keyOrEmail;
}
