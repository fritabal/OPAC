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
import { KeySkill, KeySkillFormData, SkillBudgetAllocation } from '../types/skill';

const COLLECTION_NAME = 'keySkills';

export function subscribeToKeySkills(
  onData: (skills: KeySkill[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const skillsQuery = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));

  return onSnapshot(
    skillsQuery,
    (snapshot) => {
      const skills: KeySkill[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const rawAllocations = Array.isArray(data.budgetAllocations) ? data.budgetAllocations : [];
        const budgetAllocations: SkillBudgetAllocation[] = rawAllocations.map((a: any) => ({
          budgetLineId: a.budgetLineId || '',
          budgetLineName: a.budgetLineName || '',
          percentage: typeof a.percentage === 'number' ? a.percentage : Number(a.percentage) || 0,
        }));

        return {
          id: docSnap.id,
          name: data.name || '',
          resourceManagerId: data.resourceManagerId || '',
          resourceManagerName: data.resourceManagerName || '',
          description: data.description || '',
          isCapped: Boolean(data.isCapped),
          budgetAllocations,
          order: typeof data.order === 'number' ? data.order : 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      });
      onData(skills);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

export async function addKeySkill(data: KeySkillFormData): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: data.name.trim(),
      resourceManagerId: data.resourceManagerId,
      resourceManagerName: data.resourceManagerName.trim(),
      description: data.description ? data.description.trim() : '',
      isCapped: Boolean(data.isCapped),
      budgetAllocations: data.budgetAllocations.map((a) => ({
        budgetLineId: a.budgetLineId,
        budgetLineName: a.budgetLineName.trim(),
        percentage: Number(a.percentage) || 0,
      })),
      order: data.order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}

export async function updateKeySkill(
  id: string,
  data: Partial<KeySkillFormData>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.resourceManagerId !== undefined) updatePayload.resourceManagerId = data.resourceManagerId;
    if (data.resourceManagerName !== undefined) updatePayload.resourceManagerName = data.resourceManagerName.trim();
    if (data.description !== undefined) updatePayload.description = data.description.trim();
    if (data.isCapped !== undefined) updatePayload.isCapped = Boolean(data.isCapped);
    if (data.budgetAllocations !== undefined) {
      updatePayload.budgetAllocations = data.budgetAllocations.map((a) => ({
        budgetLineId: a.budgetLineId,
        budgetLineName: a.budgetLineName.trim(),
        percentage: Number(a.percentage) || 0,
      }));
    }
    if (data.order !== undefined) updatePayload.order = data.order;

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteKeySkill(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function reorderKeySkills(orderedSkills: KeySkill[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    orderedSkills.forEach((skill, index) => {
      const docRef = doc(db, COLLECTION_NAME, skill.id);
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
