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
import { CustomProjectParam, CustomProjectParamFormData } from '../types/customParam';

const COLLECTION_NAME = 'projectCustomParams';

/**
 * Souscription en temps réel aux paramètres personnalisés des projets, triés par ordre séquentiel.
 */
export function subscribeToCustomParams(
  onData: (params: CustomProjectParam[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const params: CustomProjectParam[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          type: data.type || 'texte court',
          order: typeof data.order === 'number' ? data.order : 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      });
      onData(params);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

/**
 * Vérifie si un nom de paramètre existe déjà (clé unique, insensible à la casse),
 * en ignorant éventuellement un paramètre par son ID (pour les modifications).
 */
export async function checkCustomParamNameExists(name: string, excludeId?: string): Promise<boolean> {
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
 * Ajoute un paramètre personnalisé avec vérification d'unicité et contrainte de longueur.
 */
export async function addCustomParam(formData: CustomProjectParamFormData): Promise<string> {
  const trimmedName = formData.name.trim();
  if (!trimmedName) {
    throw new Error('Le nom du paramètre personnalisé est obligatoire.');
  }
  if (trimmedName.length > 30) {
    throw new Error('Le nom du paramètre ne peut pas dépasser 30 caractères.');
  }

  const trimmedDesc = formData.description ? formData.description.trim() : '';
  if (trimmedDesc.length > 100) {
    throw new Error('La description du paramètre ne peut pas dépasser 100 caractères.');
  }

  const exists = await checkCustomParamNameExists(trimmedName);
  if (exists) {
    throw new Error(`Un paramètre nommé « ${trimmedName} » existe déjà. Le nom doit être unique.`);
  }

  try {
    // Récupérer le plus grand ordre actuel pour l'insérer en fin de liste
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    let nextOrder = 0;
    snap.docs.forEach((d) => {
      const o = d.data().order;
      if (typeof o === 'number' && o >= nextOrder) {
        nextOrder = o + 1;
      }
    });

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: trimmedName,
      description: trimmedDesc,
      type: formData.type,
      order: nextOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    throw error;
  }
}

/**
 * Met à jour un paramètre personnalisé.
 */
export async function updateCustomParam(
  id: string,
  formData: Partial<CustomProjectParamFormData>
): Promise<void> {
  if (formData.name !== undefined) {
    const trimmed = formData.name.trim();
    if (!trimmed) {
      throw new Error('Le nom du paramètre personnalisé ne peut pas être vide.');
    }
    if (trimmed.length > 30) {
      throw new Error('Le nom du paramètre ne peut pas dépasser 30 caractères.');
    }
    const exists = await checkCustomParamNameExists(trimmed, id);
    if (exists) {
      throw new Error(`Un paramètre nommé « ${trimmed} » existe déjà. Le nom doit être unique.`);
    }
  }

  if (formData.description !== undefined && formData.description.length > 100) {
    throw new Error('La description ne peut pas dépasser 100 caractères.');
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    if (formData.name !== undefined) payload.name = formData.name.trim();
    if (formData.description !== undefined) payload.description = formData.description.trim();
    if (formData.type !== undefined) payload.type = formData.type;
    if (formData.order !== undefined) payload.order = formData.order;

    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    throw error;
  }
}

/**
 * Supprime un paramètre personnalisé.
 */
export async function deleteCustomParam(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    throw error;
  }
}

/**
 * Réordonne les paramètres (déplacement haut / bas).
 */
export async function moveCustomParam(params: CustomProjectParam[], index: number, direction: 'up' | 'down'): Promise<void> {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= params.length) return;

  const currentParam = params[index];
  const targetParam = params[targetIndex];

  try {
    const batch = writeBatch(db);
    const currentRef = doc(db, COLLECTION_NAME, currentParam.id);
    const targetRef = doc(db, COLLECTION_NAME, targetParam.id);

    batch.update(currentRef, { order: targetParam.order, updatedAt: serverTimestamp() });
    batch.update(targetRef, { order: currentParam.order, updatedAt: serverTimestamp() });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
}
