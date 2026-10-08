import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  where,
  limit,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { AppUser, AppUserFormData, UserRole } from '../types/user';
import { hashPassword, validatePassword } from '../utils/passwordSecurity';

const COLLECTION_NAME = 'users';
export const SUPER_ADMIN_EMAIL = 'stephane.labati@goood.com';

export function subscribeToUsers(
  onData: (users: AppUser[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const usersQuery = query(collection(db, COLLECTION_NAME), orderBy('email', 'asc'));

  return onSnapshot(
    usersQuery,
    async (snapshot) => {
      // If collection is empty, automatically seed the super user
      if (snapshot.empty) {
        try {
          await addDoc(collection(db, COLLECTION_NAME), {
            email: SUPER_ADMIN_EMAIL,
            displayName: 'Stéphane Labati',
            role: 'super user',
            isSuperAdmin: true,
            mustResetPassword: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        } catch (e) {
          console.error('Erreur bootstrap super user:', e);
        }
      }

      const users: AppUser[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const email = (data.email || '').trim().toLowerCase();
        const isSuper = email === SUPER_ADMIN_EMAIL || data.isSuperAdmin === true;

        // Extraction des rôles multiples avec rétro-compatibilité
        let userRoles: UserRole[] = [];
        if (Array.isArray(data.roles) && data.roles.length > 0) {
          userRoles = data.roles as UserRole[];
        } else if (data.role) {
          userRoles = [data.role as UserRole];
        } else {
          userRoles = isSuper ? ['super user'] : ['chef de projet'];
        }

        if (isSuper && !userRoles.includes('super user')) {
          userRoles.unshift('super user');
        }

        // If it's the super user but still marked without super user, update in firestore
        if (isSuper && (!data.roles || !data.roles.includes('super user'))) {
          updateDoc(doc(db, COLLECTION_NAME, docSnap.id), {
            roles: userRoles,
            role: 'super user',
          }).catch(() => {});
        }

        const isActive = isSuper
          ? true
          : data.isActive !== undefined
          ? data.isActive === true
          : Boolean(data.passwordHash) && data.mustResetPassword !== true;

        return {
          id: docSnap.id,
          email: data.email || '',
          displayName: data.displayName || data.email?.split('@')[0] || 'Utilisateur',
          roles: userRoles,
          role: userRoles[0] || (isSuper ? 'super user' : 'chef de projet'),
          isSuperAdmin: isSuper,
          isActive,
          activationToken: data.activationToken || undefined,
          activationTokenExpiresAt: data.activationTokenExpiresAt || undefined,
          mustResetPassword: isSuper ? false : data.mustResetPassword === true || !data.passwordHash,
          passwordHash: data.passwordHash || undefined,
          passwordResetAt: data.passwordResetAt?.toDate?.()?.toISOString() || data.passwordResetAt,
          passwordLastChangedAt:
            data.passwordLastChangedAt?.toDate?.()?.toISOString() || data.passwordLastChangedAt,
          resetToken: data.resetToken || undefined,
          resetTokenExpiresAt: data.resetTokenExpiresAt || undefined,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      });

      // Ensure super user is present if not yet synced
      if (!users.some((u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
        users.unshift({
          id: 'bootstrap-superadmin',
          email: SUPER_ADMIN_EMAIL,
          displayName: 'Stéphane Labati (Concepteur / Super User)',
          roles: ['super user'],
          role: 'super user',
          isSuperAdmin: true,
          isActive: true,
          mustResetPassword: false,
        });
      }

      onData(users);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

export async function addAuthorizedUser(data: AppUserFormData): Promise<{
  id: string;
  activationToken: string | null;
  email: string;
  displayName: string;
  roles: UserRole[];
}> {
  const cleanEmail = data.email.trim().toLowerCase();
  try {
    const q = query(collection(db, COLLECTION_NAME), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`Un utilisateur avec l'adresse « ${cleanEmail} » existe déjà.`);
    }

    const isSuper = cleanEmail === SUPER_ADMIN_EMAIL;
    const userRoles: UserRole[] =
      data.roles && data.roles.length > 0
        ? data.roles
        : data.role
        ? [data.role]
        : ['chef de projet'];

    if (isSuper && !userRoles.includes('super user')) {
      userRoles.unshift('super user');
    }

    const activationToken = isSuper
      ? null
      : `act_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    const activationTokenExpiresAt = isSuper
      ? null
      : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const trimmedDisplayName = data.displayName.trim() || cleanEmail.split('@')[0];

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      email: cleanEmail,
      displayName: trimmedDisplayName,
      roles: userRoles,
      role: userRoles[0],
      isSuperAdmin: isSuper,
      isActive: isSuper ? true : false, // Inactif tant que l'utilisateur n'a pas activé son compte et défini son mot de passe
      mustResetPassword: true,
      activationToken,
      activationTokenExpiresAt,
      passwordHash: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      activationToken,
      email: cleanEmail,
      displayName: trimmedDisplayName,
      roles: userRoles,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('existe déjà')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    throw error;
  }
}

/**
 * Renvoie un lien d'activation de compte et de définition du mot de passe
 */
export async function resendAccountActivationEmail(
  userId: string,
  email: string
): Promise<{ activationToken: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const activationToken = `act_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
  const activationTokenExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const docRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(docRef, {
    activationToken,
    activationTokenExpiresAt,
    isActive: false,
    mustResetPassword: true,
    updatedAt: serverTimestamp(),
  });

  return { activationToken };
}

/**
 * Réinitialisation du mot de passe par l'administrateur ou le super user :
 * Efface le mot de passe actuel de l'utilisateur et génère un jeton de réinitialisation.
 */
export async function resetUserPasswordByAdmin(userId: string): Promise<{ resetToken: string }> {
  const docRef = doc(db, COLLECTION_NAME, userId);
  const resetToken = `rst_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
  const resetTokenExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  try {
    await updateDoc(docRef, {
      passwordHash: null,
      mustResetPassword: true,
      resetToken,
      resetTokenExpiresAt,
      passwordResetAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { resetToken };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${userId}`);
    throw error;
  }
}

/**
 * Définition d'un nouveau mot de passe avec validation stricte (20 car., maj, min, chiffre, spécial)
 * Active le compte (isActive = true) si celui-ci était inactif.
 */
export async function setUserNewPassword(
  userId: string,
  email: string,
  newPassword: string
): Promise<void> {
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    throw new Error(validation.errors[0] || 'Le mot de passe ne respecte pas les critères de sécurité.');
  }

  const hash = await hashPassword(newPassword, email);
  const docRef = doc(db, COLLECTION_NAME, userId);

  try {
    await updateDoc(docRef, {
      passwordHash: hash,
      isActive: true, // Le compte est activé dès la définition du mot de passe !
      mustResetPassword: false,
      resetToken: null,
      resetTokenExpiresAt: null,
      activationToken: null,
      activationTokenExpiresAt: null,
      passwordLastChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${userId}`);
  }
}

/**
 * Demande de lien de réinitialisation de mot de passe par email.
 * Envoie un email officiel via Firebase Auth et stocke un token sécurisé pour le lien direct.
 */
export async function requestPasswordResetLink(email: string): Promise<{
  user: AppUser;
  resetToken: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const q = query(
    collection(db, COLLECTION_NAME),
    where('email', '==', cleanEmail),
    limit(1)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error("Aucun compte utilisateur n'est associé à cette adresse email.");
  }

  const userDoc = snap.docs[0];
  const userData = userDoc.data();
  const userRoles: UserRole[] =
    userData.roles && Array.isArray(userData.roles) && userData.roles.length > 0
      ? (userData.roles as UserRole[])
      : userData.role
      ? [userData.role as UserRole]
      : ['chef de projet'];

  const user: AppUser = {
    id: userDoc.id,
    email: cleanEmail,
    displayName: userData.displayName || cleanEmail.split('@')[0],
    roles: userRoles,
    role: userRoles[0],
    isSuperAdmin: userData.isSuperAdmin,
    mustResetPassword: userData.mustResetPassword,
  };

  const resetToken = `rst_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 heure

  await updateDoc(doc(db, COLLECTION_NAME, userDoc.id), {
    resetToken,
    resetTokenExpiresAt: expiresAt,
    mustResetPassword: true,
    updatedAt: serverTimestamp(),
  });

  // Tenter également l'envoi via Firebase Auth si configuré
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (authError) {
    // Si l'utilisateur n'est pas encore enregistré dans Firebase Auth direct,
    // le token généré ci-dessus garantit le fonctionnement du lien de réinitialisation sécurisé
    console.warn('Firebase sendPasswordResetEmail note:', authError);
  }

  return { user, resetToken };
}

export async function updateUserRoles(userId: string, newRoles: UserRole[]): Promise<void> {
  if (!newRoles || newRoles.length === 0) {
    throw new Error('Un utilisateur doit posséder au moins un rôle.');
  }
  const docRef = doc(db, COLLECTION_NAME, userId);
  try {
    await updateDoc(docRef, {
      roles: newRoles,
      role: newRoles[0],
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${userId}`);
  }
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
  return updateUserRoles(userId, [newRole]);
}

export async function setUserActiveStatus(
  userId: string,
  email: string,
  isActive: boolean
): Promise<void> {
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && !isActive) {
    throw new Error("Le Super User / Concepteur de l'application ne peut pas être désactivé.");
  }
  const docRef = doc(db, COLLECTION_NAME, userId);
  try {
    await updateDoc(docRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${userId}`);
  }
}

export async function updateUser(
  userId: string,
  data: Partial<AppUserFormData>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, userId);
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (data.displayName !== undefined) payload.displayName = data.displayName.trim();
    if (data.roles !== undefined && data.roles.length > 0) {
      payload.roles = data.roles;
      payload.role = data.roles[0];
    } else if (data.role !== undefined) {
      payload.role = data.role;
      payload.roles = [data.role];
    }
    if (data.email !== undefined) payload.email = data.email.trim().toLowerCase();
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${userId}`);
  }
}

export async function deleteAuthorizedUser(userId: string, email: string): Promise<void> {
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error("Le Super User / Concepteur de l'application ne peut pas être supprimé.");
  }
  const docRef = doc(db, COLLECTION_NAME, userId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${userId}`);
  }
}
