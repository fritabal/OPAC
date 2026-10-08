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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { Criterion, CriterionFormData, CriterionWeight, CRITERION_WEIGHTS } from '../types/criteria';

const COLLECTION_NAME = 'criteria';

export function subscribeToCriteria(
  onData: (criteria: Criterion[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const criteriaQuery = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));

  return onSnapshot(
    criteriaQuery,
    (snapshot) => {
      const criteria: Criterion[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const validWeight: CriterionWeight =
          typeof data.weight === 'number' && (CRITERION_WEIGHTS as readonly number[]).includes(data.weight)
            ? (data.weight as CriterionWeight)
            : 1;

        return {
          id: docSnap.id,
          name: data.name || '',
          type: data.type || 'VALEUR',
          weight: validWeight,
          isActive: data.isActive !== false,
          levels:
            Array.isArray(data.levels) && data.levels.length === 6
              ? (data.levels as [string, string, string, string, string, string])
              : ['', '', '', '', '', ''],
          order: typeof data.order === 'number' ? data.order : 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      });
      onData(criteria);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

export async function addCriterion(data: CriterionFormData): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: data.name.trim(),
      type: data.type,
      weight: data.weight,
      isActive: data.isActive !== false,
      levels: data.levels.map((lvl) => lvl.trim()),
      order: data.order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}

export async function updateCriterion(id: string, data: Partial<CriterionFormData>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.type !== undefined) updatePayload.type = data.type;
    if (data.weight !== undefined) updatePayload.weight = data.weight;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.levels !== undefined) updatePayload.levels = data.levels.map((lvl) => lvl.trim());
    if (data.order !== undefined) updatePayload.order = data.order;

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function toggleCriterionActive(id: string, isActive: boolean): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await updateDoc(docRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteCriterion(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function reorderCriteria(orderedCriteria: Criterion[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    orderedCriteria.forEach((crit, index) => {
      const docRef = doc(db, COLLECTION_NAME, crit.id);
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
