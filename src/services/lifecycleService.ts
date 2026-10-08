import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { ProjectState, ProjectStateFormData } from '../types/lifecycle';

const COLLECTION_NAME = 'projectStates';

/**
 * Souscription en temps réel aux états du cycle de vie des projets, triés par ordre séquentiel.
 */
export function subscribeToProjectStates(
  onData: (states: ProjectState[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const states: ProjectState[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          needsStaffing: Boolean(data.needsStaffing),
          needsPrioritization: Boolean(data.needsPrioritization),
          order: typeof data.order === 'number' ? data.order : 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      });
      onData(states);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

/**
 * Vérifie si un nom d'état existe déjà (insensible à la casse),
 * en ignorant éventuellement un état par son ID (pour les modifications).
 */
export async function checkStateNameExists(name: string, excludeId?: string): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    const clean = name.trim().toLowerCase();
    return snap.docs.some((d) => {
      if (excludeId && d.id === excludeId) return false;
      const dName = (d.data().name || '').trim().toLowerCase();
      return dName === clean;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    return false;
  }
}

/**
 * Ajout d'un nouvel état dans le cycle de vie des projets.
 * Vérifie l'unicité de la clé "nom".
 */
export async function addProjectState(data: ProjectStateFormData): Promise<string> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Le nom de l'état est obligatoire.");
  }

  const alreadyExists = await checkStateNameExists(trimmedName);
  if (alreadyExists) {
    throw new Error(`Un état avec le nom « ${trimmedName} » existe déjà. Le nom doit être unique.`);
  }

  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: trimmedName,
      description: (data.description || '').trim(),
      needsStaffing: Boolean(data.needsStaffing),
      needsPrioritization: Boolean(data.needsPrioritization),
      order: data.order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}

/**
 * Modification d'un état existant.
 * Vérifie l'unicité du nom s'il est modifié.
 */
export async function updateProjectState(
  id: string,
  data: Partial<ProjectStateFormData>
): Promise<void> {
  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Le nom de l'état ne peut pas être vide.");
    }
    const alreadyExists = await checkStateNameExists(trimmedName, id);
    if (alreadyExists) {
      throw new Error(`Un autre état porte déjà le nom « ${trimmedName} ». Le nom doit être unique.`);
    }
  }

  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description.trim();
    if (data.needsStaffing !== undefined) payload.needsStaffing = Boolean(data.needsStaffing);
    if (data.needsPrioritization !== undefined)
      payload.needsPrioritization = Boolean(data.needsPrioritization);
    if (data.order !== undefined) payload.order = data.order;

    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

/**
 * Bascule directe de l'attribut "à staffer".
 */
export async function toggleStateStaffing(id: string, needsStaffing: boolean): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await updateDoc(docRef, {
      needsStaffing,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

/**
 * Bascule directe de l'attribut "à prioriser".
 */
export async function toggleStatePrioritization(
  id: string,
  needsPrioritization: boolean
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await updateDoc(docRef, {
      needsPrioritization,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

/**
 * Suppression d'un état.
 */
export async function deleteProjectState(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}

/**
 * Réordonnancement des états du cycle de vie.
 */
export async function reorderProjectStates(states: ProjectState[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    states.forEach((s, index) => {
      const docRef = doc(db, COLLECTION_NAME, s.id);
      batch.update(docRef, {
        order: index,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
  }
}

/**
 * Initialisation d'un cycle de vie par défaut pour tester immédiatement.
 */
export async function seedDefaultProjectLifecycle(): Promise<void> {
  const defaultStates: Omit<ProjectStateFormData, 'order'>[] = [
    {
      name: 'Idée / Opportunité',
      description: 'Nouvelle proposition de projet ou besoin émergent en attente de qualification initiale.',
      needsStaffing: false,
      needsPrioritization: false,
    },
    {
      name: 'Étude & Cadrage',
      description: 'Analyse de faisabilité, estimation des coûts, ROI et critères de valeur pour arbitrage.',
      needsStaffing: false,
      needsPrioritization: true, // À prioriser
    },
    {
      name: 'Arbitré / À staffer',
      description: 'Projet validé lors du comité de priorisation, en attente d’allocation des compétences clés.',
      needsStaffing: true, // À staffer
      needsPrioritization: true, // À prioriser
    },
    {
      name: 'En cours de réalisation',
      description: 'Équipe constituée et ressources allouées, développement et livraison active.',
      needsStaffing: true, // À staffer
      needsPrioritization: false,
    },
    {
      name: 'Déployé / Terminé',
      description: 'Livrables validés en production, bilan post-projet et clôture.',
      needsStaffing: false,
      needsPrioritization: false,
    },
    {
      name: 'Abandonné / Reporté',
      description: 'Projet non retenu lors des arbitrages ou gelé pour des raisons stratégiques.',
      needsStaffing: false,
      needsPrioritization: false,
    },
  ];

  try {
    const batch = writeBatch(db);
    defaultStates.forEach((st, i) => {
      const newDocRef = doc(collection(db, COLLECTION_NAME));
      batch.set(newDocRef, {
        name: st.name,
        description: st.description,
        needsStaffing: st.needsStaffing,
        needsPrioritization: st.needsPrioritization,
        order: i,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}
