import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, signInWithPopup, signOut, testConnection } from '../lib/firebase';
import { AppUser, UserRole } from '../types/user';
import { subscribeToUsers, SUPER_ADMIN_EMAIL, isSuperAdminEmail } from '../services/userService';
import { changeAppLanguage, SupportedLanguage } from '../i18n';

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

const SESSION_EMAIL_KEY = 'opac_session_email';
const CONCEPTION_MODE_KEY = 'opac_conception_mode';
const EXPLICIT_LOGOUT_KEY = 'opac_explicit_logout';

/**
 * Détecte si l'application s'exécute dans l'environnement de conception / développement (Google AI Studio Build, dev server Vite, aperçu Cloud Run sandbox)
 * vs dans l'environnement de production publié (ex: https://opac-v1-1.ai.studio).
 */
export const isConceptionEnvironment = (): boolean => {
  try {
    const host = window.location.hostname.toLowerCase();

    // 1. Si l'URL correspond au domaine de publication officiel AI Studio, nous sommes en production publiée -> forcer la mire de login !
    if (host === 'opac-v1-1.ai.studio' || host.endsWith('.ai.studio')) {
      return false;
    }

    // 2. Mode développement Vite (HMR / Vite dev server)
    if (import.meta.env.DEV) {
      return true;
    }

    // 3. Localhost ou IP locale
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
      return true;
    }

    // 4. Domaines d'aperçu / bac à sable Google Cloud Run dédiés aux sessions de conception AI Studio
    if (host.includes('ais-dev-') || host.includes('ais-pre-') || host.endsWith('.run.app')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  activeUser: null,
  realUser: null,
  impersonatedUser: null,
  isImpersonating: false,
  canImpersonate: false,
  impersonateUser: () => {},
  stopImpersonation: () => {},
  allUsers: [],
  loading: true,
  dbConnected: false,
  isAuthenticated: false,
  isConceptionMode: false,
  enterConceptionMode: () => {},
  exitConceptionMode: () => {},
  loginAsUser: () => {},
  isSuperUser: false,
  assumedRole: null,
  effectiveRole: 'chef de projet',
  effectiveRoles: ['chef de projet'],
  activeUserRoles: [],
  assumeRole: () => {},
  isAdmin: false,
  isProjectManager: false,
  isResourceManager: false,
  isValueManagementOfficer: false,
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

  // En mode création (développement AI Studio), connexion automatique par défaut pour le compte de conception,
  // sauf si l'utilisateur a explicitement demandé à se déconnecter dans cet onglet.
  // En mode publié (production), l'application démarre déconnectée pour afficher la mire de connexion.
  const [isConceptionMode, setIsConceptionMode] = useState<boolean>(() => {
    try {
      if (!isConceptionEnvironment()) {
        return false;
      }
      if (sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === 'true') {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      if (sessionStorage.getItem(SESSION_EMAIL_KEY)) {
        return true;
      }
      if (isConceptionEnvironment() && sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) !== 'true') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

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
        // 1. Si l'utilisateur est déjà connecté dans l'état React actuel, mettre à jour ses données
        if (prev) {
          const updated = users.find(
            (u) => u.id === prev.id || u.email.toLowerCase() === prev.email.toLowerCase()
          );
          if (updated) {
            if (
              updated.preferredLanguage &&
              (updated.preferredLanguage === 'fr' ||
                updated.preferredLanguage === 'en' ||
                updated.preferredLanguage === 'it' ||
                updated.preferredLanguage === 'de')
            ) {
              changeAppLanguage(updated.preferredLanguage as SupportedLanguage);
            }
            return updated;
          }
        }

        // 2. Si l'utilisateur est authentifié avec Firebase Auth (connexion Google), respecter son compte
        if (auth.currentUser?.email) {
          const match = users.find(
            (u) => u.email.toLowerCase() === auth.currentUser?.email?.toLowerCase()
          );
          if (match && match.isActive !== false) {
            setIsAuthenticated(true);
            return match;
          }
        }

        // 3. Vérifier si une session active est stockée dans sessionStorage pour cet onglet
        try {
          const sessionEmail = sessionStorage.getItem(SESSION_EMAIL_KEY);
          if (sessionEmail) {
            const match = users.find(
              (u) => u.email.toLowerCase() === sessionEmail.toLowerCase()
            );
            if (match && match.isActive !== false) {
              setIsAuthenticated(true);
              setIsConceptionMode(isSuperAdminEmail(match.email));
              return match;
            }
          }

          const savedConception = sessionStorage.getItem(CONCEPTION_MODE_KEY) === 'true';
          if (savedConception) {
            const superUser = users.find((u) => isSuperAdminEmail(u.email));
            if (superUser) {
              setIsAuthenticated(true);
              setIsConceptionMode(true);
              return superUser;
            }
          }
        } catch {
          // ignore
        }

        // 4. En mode création (développement / sandbox AI Studio), auto-connexion avec le compte de conception (stephane.labati@goood.com)
        // dès lors qu'il possède bien le rôle super user et n'a pas fait de déconnexion explicite dans cet onglet.
        if (isConceptionEnvironment()) {
          try {
            const explicitLogout = sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === 'true';
            if (!explicitLogout) {
              const designerUser = users.find((u) => isSuperAdminEmail(u.email));
              const hasSuperUserRole =
                designerUser &&
                (designerUser.roles?.includes('super user') ||
                  designerUser.role === 'super user' ||
                  designerUser.isSuperAdmin === true);

              if (designerUser && hasSuperUserRole && designerUser.isActive !== false) {
                setIsAuthenticated(true);
                setIsConceptionMode(true);
                sessionStorage.setItem(SESSION_EMAIL_KEY, designerUser.email.toLowerCase());
                sessionStorage.setItem(CONCEPTION_MODE_KEY, 'true');
                if (
                  designerUser.preferredLanguage &&
                  (designerUser.preferredLanguage === 'fr' ||
                    designerUser.preferredLanguage === 'en' ||
                    designerUser.preferredLanguage === 'it' ||
                    designerUser.preferredLanguage === 'de')
                ) {
                  changeAppLanguage(designerUser.preferredLanguage as SupportedLanguage);
                }
                return designerUser;
              }
            }
          } catch {
            // ignore
          }
        }

        // 5. Par défaut (ex: environnement de production publié opac-v1-1.ai.studio ou déconnexion explicite) : afficher la mire de login !
        setIsAuthenticated(false);
        setIsConceptionMode(false);
        return null;
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
    try {
      sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    } catch {
      // ignore
    }
    const superUser = allUsers.find(
      (u) =>
        isSuperAdminEmail(u.email) &&
        (u.roles?.includes('super user') || u.role === 'super user' || u.isSuperAdmin === true)
    ) || allUsers.find((u) => isSuperAdminEmail(u.email));
    if (superUser) {
      setRealUser(superUser);
      try {
        sessionStorage.setItem(SESSION_EMAIL_KEY, superUser.email.toLowerCase());
        sessionStorage.setItem(CONCEPTION_MODE_KEY, 'true');
      } catch {
        // ignore
      }
      if (
        superUser.preferredLanguage &&
        (superUser.preferredLanguage === 'fr' ||
          superUser.preferredLanguage === 'en' ||
          superUser.preferredLanguage === 'it' ||
          superUser.preferredLanguage === 'de')
      ) {
        changeAppLanguage(superUser.preferredLanguage as SupportedLanguage);
      }
    }
    setImpersonatedUser(null);
    setIsConceptionMode(true);
    setIsAuthenticated(true);
    setAssumedRole(null);
  };

  const exitConceptionMode = () => {
    try {
      sessionStorage.removeItem(SESSION_EMAIL_KEY);
      sessionStorage.removeItem(CONCEPTION_MODE_KEY);
      sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, 'true');
    } catch {
      // ignore
    }
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
    const isSuper = isSuperAdminEmail(user.email);
    setIsConceptionMode(isSuper);
    setAssumedRole(null);
    try {
      sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
      sessionStorage.setItem(SESSION_EMAIL_KEY, user.email.toLowerCase());
      if (isSuper) {
        sessionStorage.setItem(CONCEPTION_MODE_KEY, 'true');
      } else {
        sessionStorage.removeItem(CONCEPTION_MODE_KEY);
      }
    } catch {
      // ignore
    }
    if (
      user.preferredLanguage &&
      (user.preferredLanguage === 'fr' ||
        user.preferredLanguage === 'en' ||
        user.preferredLanguage === 'it' ||
        user.preferredLanguage === 'de')
    ) {
      changeAppLanguage(user.preferredLanguage as SupportedLanguage);
    }
  };

  const handleSignOut = async () => {
    try {
      sessionStorage.removeItem(SESSION_EMAIL_KEY);
      sessionStorage.removeItem(CONCEPTION_MODE_KEY);
      sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, 'true');
    } catch {
      // ignore
    }
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
    isSuperAdminEmail(realUser?.email) ||
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
    if (targetUser.preferredLanguage && (targetUser.preferredLanguage === 'fr' || targetUser.preferredLanguage === 'en' || targetUser.preferredLanguage === 'it')) {
      changeAppLanguage(targetUser.preferredLanguage as SupportedLanguage);
    }
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
