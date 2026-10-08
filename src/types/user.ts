export type UserRole =
  | 'super user'
  | 'administrateur'
  | 'chef de projet'
  | 'resource manager'
  | 'value management officer';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  roles: UserRole[]; // Rôles cumulés
  role?: UserRole; // Rétro-compatibilité
  createdAt?: string;
  updatedAt?: string;
  isSuperAdmin?: boolean;

  // Statut d'activation du compte
  isActive?: boolean;
  activationToken?: string;
  activationTokenExpiresAt?: string;

  // Gestion du mot de passe
  mustResetPassword?: boolean;
  passwordHash?: string;
  passwordResetAt?: string;
  passwordLastChangedAt?: string;
  resetToken?: string;
  resetTokenExpiresAt?: string;
}

export type AppUserFormData = Omit<AppUser, 'id' | 'createdAt' | 'updatedAt' | 'isSuperAdmin'>;

export const ROLE_LABELS: Record<UserRole, string> = {
  'super user': 'Super User',
  administrateur: 'Administrateur',
  'chef de projet': 'Chef de projet',
  'resource manager': 'Resource Manager',
  'value management officer': 'Value Management Officer',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  'super user':
    'Concepteur & Super Utilisateur : dispose de tous les droits et peut endosser n’importe quel rôle pour tester et piloter l’application.',
  administrateur:
    'Accès complet : paramètres globaux, critères de priorisation, lignes budgétaires, utilisateurs.',
  'chef de projet':
    'Accès projets : saisie descriptive, valeur et coût, besoins en ressources jusqu’à terminaison.',
  'resource manager':
    'Accès compétences : compétences clés de son périmètre, indisponibilités des ressources.',
  'value management officer':
    'Pilotage de la valeur : arbitrage des critères de valeur, priorisation stratégique et suivi du ROI des projets.',
};
