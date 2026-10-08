import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, signInWithPopup, signOut, testConnection } from '../lib/firebase';
import { AppUser, UserRole } from '../types/user';
import { subscribeToUsers, SUPER_ADMIN_EMAIL } from '../services/userService';

interface AuthContextType {
  firebaseUser: User | null;
  activeUser: AppUser | null;
  realUser: AppUser | null;
  impersonatedUser: AppUser | null;
  isImpersonating: boolean;
  canImpersonate: boolean;
  impersonateUser: (user: AppUser) => void;
  stopImpersonation: () => void;
  allUsers: AppUser[];
  loading: boolean;
  dbConnected: boolean;

  // Mode conception pour le Super User vs Authentification standard par mot de passe
  isAuthenticated: boolean;
  isConceptionMode: boolean;
  enterConceptionMode: () => void;
  exitConceptionMode: () => void;
  loginAsUser: (user: AppUser) => void;

  // Rôle endossé / simulation
  isSuperUser: boolean;
  assumedRole: UserRole | null;
  effectiveRole: UserRole;
  effectiveRoles: UserRole[];
  activeUserRoles: UserRole[];
  assumeRole: (role: UserRole | null) => void;

  // Droits effectifs calculés selon le rôle endossé ou réel
  isAdmin: boolean;
  isProjectManager: boolean;
  isResourceManager: boolean;
  isValueManagementOfficer: boolean;

  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchActiveUser: (user: AppUser) => void;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  activeUser: null,
  realUser: null,
  impersonatedUser: null,
  isImpersonating: false,
  canImpersonate: true,
  impersonateUser: () => {},
  stopImpersonation: () => {},
  allUsers: [],
  loading: true,
  dbConnected: false,
  isAuthenticated: true,
  isConceptionMode: true,
  enterConceptionMode: () => {},
  exitConceptionMode: () => {},
  loginAsUser: () => {},
  isSuperUser: true,
  assumedRole: null,
  effectiveRole: 'super user',
  effectiveRoles: ['super user'],
  activeUserRoles: ['super user'],
  assumeRole: () => {},
  isAdmin: true,
  isProjectManager: true,
  isResourceManager: true,
  isValueManagementOfficer: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
  switchActiveUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [realUser, setRealUser] = useState<AppUser | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<AppUser | null>(null);
  const [assumedRole, setAssumedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);

  // Par défaut, le Super User en mode conception a un accès direct sans mot de passe
  const [isConceptionMode, setIsConceptionMode] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  // L'utilisateur actif est l'utilisateur usurpé si impersonation active, sinon l'utilisateur réel
  const activeUser = impersonatedUser || realUser;
  const isImpersonating = Boolean(impersonatedUser);

  useEffect(() => {
    testConnection().then((connected) => {
      setDbConnected(connected);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });

    const unsubscribeUsers = subscribeToUsers((users) => {
      setAllUsers(users);

      setRealUser((prev) => {
        if (prev) {
          const updated = users.find(
            (u) => u.id === prev.id || u.email.toLowerCase() === prev.email.toLowerCase()
          );
          if (updated) return updated;
        }

        if (auth.currentUser?.email) {
          const match = users.find(
            (u) => u.email.toLowerCase() === auth.currentUser?.email?.toLowerCase()
          );
          if (match) return match;
        }

        const superUser = users.find(
          (u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
        );
        if (superUser) return superUser;

        return (
          users[0] || {
            id: 'default-superuser',
            email: SUPER_ADMIN_EMAIL,
            displayName: 'Stéphane Labati',
            role: 'super user',
            isSuperAdmin: true,
            mustResetPassword: false,
          }
        );
      });

      // Synchroniser également l'utilisateur usurpé si ses données changent
      setImpersonatedUser((prev) => {
        if (!prev) return null;
        return (
          users.find(
            (u) => u.id === prev.id || u.email.toLowerCase() === prev.email.toLowerCase()
          ) || prev
        );
      });

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Erreur de connexion:', error);
      throw error;
    }
  };

  const enterConceptionMode = () => {
    const superUser = allUsers.find(
      (u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
    );
    if (superUser) {
      setRealUser(superUser);
    }
    setImpersonatedUser(null);
    setIsConceptionMode(true);
    setIsAuthenticated(true);
    setAssumedRole(null);
  };

  const exitConceptionMode = () => {
    setIsConceptionMode(false);
    setIsAuthenticated(false);
    setRealUser(null);
    setImpersonatedUser(null);
    setAssumedRole(null);
  };

  const loginAsUser = (user: AppUser) => {
    setRealUser(user);
    setImpersonatedUser(null);
    setIsAuthenticated(true);
    setIsConceptionMode(user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
    setAssumedRole(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur de déconnexion Firebase:', error);
    } finally {
      setIsAuthenticated(false);
      setIsConceptionMode(false);
      setRealUser(null);
      setImpersonatedUser(null);
      setAssumedRole(null);
    }
  };

  // Détermine si l'utilisateur réel qui s'est connecté est le Super User
  const realUserRoles: UserRole[] =
    realUser?.roles && realUser.roles.length > 0
      ? realUser.roles
      : realUser?.role
      ? [realUser.role]
      : ['super user'];

  const canImpersonate =
    realUser?.isSuperAdmin === true ||
    realUser?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
    realUserRoles.includes('super user');

  // Privilège Super User : se connecter à la place de n'importe quel autre utilisateur
  const impersonateUser = (targetUser: AppUser) => {
    if (!canImpersonate) {
      console.warn("Privilège refusé : seul le Super User peut se connecter à la place d'un autre utilisateur.");
      return;
    }
    setImpersonatedUser(targetUser);
    setAssumedRole(null);
    setIsAuthenticated(true);
  };

  const stopImpersonation = () => {
    setImpersonatedUser(null);
    setAssumedRole(null);
  };

  const switchActiveUser = (user: AppUser) => {
    if (canImpersonate) {
      impersonateUser(user);
    } else {
      console.warn("Action non autorisée.");
    }
  };

  const assumeRole = (role: UserRole | null) => {
    setAssumedRole(role);
  };

  // Récupération de la liste des rôles de l'utilisateur actif actuel
  const activeUserRoles: UserRole[] =
    activeUser?.roles && activeUser.roles.length > 0
      ? activeUser.roles
      : activeUser?.role
      ? [activeUser.role]
      : ['super user'];

  // Le Super User conserve son statut même pendant une usurpation pour pouvoir gérer la plateforme
  const isSuperUser = canImpersonate;

  // Rôle(s) effectif(s) pour l'affichage et les restrictions de navigation :
  // Si en mode usurpation, on reflète EXACTEMENT les permissions du compte cible !
  const effectiveRoles: UserRole[] = isImpersonating
    ? activeUserRoles
    : isSuperUser && assumedRole
    ? [assumedRole]
    : isSuperUser
    ? ['super user', 'administrateur', 'chef de projet', 'resource manager', 'value management officer']
    : activeUserRoles;

  const effectiveRole: UserRole = isImpersonating
    ? activeUserRoles[0] || 'chef de projet'
    : isSuperUser && assumedRole
    ? assumedRole
    : activeUserRoles[0] || 'super user';

  // Si l'utilisateur possède le rôle (direct ou simulé), les droits correspondants sont activés
  const isAdmin =
    effectiveRoles.includes('super user') || effectiveRoles.includes('administrateur');
  const isProjectManager =
    effectiveRoles.includes('super user') || effectiveRoles.includes('chef de projet');
  const isResourceManager =
    effectiveRoles.includes('super user') || effectiveRoles.includes('resource manager');
  const isValueManagementOfficer =
    effectiveRoles.includes('super user') || effectiveRoles.includes('value management officer');

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        activeUser,
        realUser,
        impersonatedUser,
        isImpersonating,
        canImpersonate,
        impersonateUser,
        stopImpersonation,
        allUsers,
        loading,
        dbConnected,
        isAuthenticated,
        isConceptionMode,
        enterConceptionMode,
        exitConceptionMode,
        loginAsUser,
        isSuperUser,
        assumedRole,
        effectiveRole,
        effectiveRoles,
        activeUserRoles,
        assumeRole,
        isAdmin,
        isProjectManager,
        isResourceManager,
        isValueManagementOfficer,
        signInWithGoogle: handleSignIn,
        logout: handleSignOut,
        switchActiveUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
