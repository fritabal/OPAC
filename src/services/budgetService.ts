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
import { BudgetLine, BudgetLineFormData } from '../types/budget';
import { BUDGET_PALETTE_32, getFirstAvailableColor } from '../constants/colors';

const COLLECTION_NAME = 'budgetLines';

export function subscribeToBudgetLines(
  onData: (lines: BudgetLine[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const linesQuery = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));

  return onSnapshot(
    linesQuery,
    (snapshot) => {
      const usedColors: string[] = [];
      const lines: BudgetLine[] = snapshot.docs.map((docSnap, idx) => {
        const data = docSnap.data();
        let color = data.color;
        if (!color || typeof color !== 'string') {
          color = BUDGET_PALETTE_32[idx % BUDGET_PALETTE_32.length].hex;
        }
        usedColors.push(color);

        return {
          id: docSnap.id,
          name: data.name || '',
          budgetKe: typeof data.budgetKe === 'number' ? data.budgetKe : 0,
          manager: data.manager || '',
          color,
          isActive: data.isActive !== false,
          order: typeof data.order === 'number' ? data.order : 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      });
      onData(lines);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

export async function addBudgetLine(data: BudgetLineFormData): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: data.name.trim(),
      budgetKe: Number(data.budgetKe) || 0,
      manager: data.manager.trim(),
      color: data.color || BUDGET_PALETTE_32[0].hex,
      isActive: data.isActive !== false,
      order: data.order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}

export async function updateBudgetLine(
  id: string,
  data: Partial<BudgetLineFormData>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.budgetKe !== undefined) updatePayload.budgetKe = Number(data.budgetKe) || 0;
    if (data.manager !== undefined) updatePayload.manager = data.manager.trim();
    if (data.color !== undefined) updatePayload.color = data.color;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.order !== undefined) updatePayload.order = data.order;

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function updateBudgetLineColor(id: string, color: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await updateDoc(docRef, {
      color,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function toggleBudgetLineActive(id: string, isActive: boolean): Promise<void> {
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

export async function deleteBudgetLine(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function reorderBudgetLines(orderedLines: BudgetLine[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    orderedLines.forEach((line, index) => {
      const docRef = doc(db, COLLECTION_NAME, line.id);
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
