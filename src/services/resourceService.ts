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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { Resource, ResourceFormData, cleanObsoleteMonths, getRolling12Months } from '../types/resource';
import { broadcastCollaborationChange } from './collaborationNotificationService';

const COLLECTION_NAME = 'resources';

export function subscribeToResources(
  onData: (resources: Resource[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const resources: Resource[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          fte: typeof data.fte === 'number' ? data.fte : Number(data.fte) || 1.0,
          skillId: data.skillId || '',
          skillName: data.skillName || '',
          resourceManagerId: data.resourceManagerId || '',
          unavailability: (typeof data.unavailability === 'object' && data.unavailability !== null) ? data.unavailability : {},
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      });
      onData(resources);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

export async function addResource(data: ResourceFormData): Promise<string> {
  try {
    const rolling = getRolling12Months();
    const cleanedUnavailability = cleanObsoleteMonths(data.unavailability, rolling);

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: data.name.trim(),
      description: (data.description || '').trim(),
      fte: typeof data.fte === 'number' ? data.fte : Number(data.fte) || 1.0,
      skillId: data.skillId,
      skillName: (data.skillName || '').trim(),
      resourceManagerId: data.resourceManagerId || '',
      unavailability: cleanedUnavailability,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    broadcastCollaborationChange({
      category: 'settings_resources',
      title: 'Ressource ajoutée',
      message: `Un autre utilisateur vient d'ajouter la ressource « ${data.name.trim()} ».`,
    });

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}

export async function updateResource(
  id: string,
  data: Partial<ResourceFormData>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.description !== undefined) updatePayload.description = data.description.trim();
    if (data.fte !== undefined) updatePayload.fte = Number(data.fte);
    if (data.skillId !== undefined) updatePayload.skillId = data.skillId;
    if (data.skillName !== undefined) updatePayload.skillName = data.skillName.trim();
    if (data.resourceManagerId !== undefined) updatePayload.resourceManagerId = data.resourceManagerId;
    if (data.unavailability !== undefined) {
      const rolling = getRolling12Months();
      updatePayload.unavailability = cleanObsoleteMonths(data.unavailability, rolling);
    }

    await updateDoc(docRef, updatePayload);

    broadcastCollaborationChange({
      category: 'settings_resources',
      title: 'Ressource modifiée',
      message: data.name
        ? `Un autre utilisateur vient de modifier la ressource « ${data.name.trim()} ».`
        : `Un autre utilisateur vient de modifier une ressource.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
  }
}

export async function updateResourceUnavailability(
  resourceId: string,
  monthKey: string,
  days: number | null
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, resourceId);
  try {
    const fieldPath = `unavailability.${monthKey}`;
    const cleanDays = days === null || isNaN(days) ? 0 : Math.max(0, days);
    await updateDoc(docRef, {
      [fieldPath]: cleanDays,
      updatedAt: serverTimestamp(),
    });

    broadcastCollaborationChange({
      category: 'settings_resources',
      title: 'Indisponibilité mise à jour',
      message: `Un autre utilisateur vient de mettre à jour le calendrier d'indisponibilité d'une ressource.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
  }
}

export async function deleteResource(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  try {
    await deleteDoc(docRef);

    broadcastCollaborationChange({
      category: 'settings_resources',
      title: 'Ressource supprimée',
      message: `Un autre utilisateur vient de supprimer une ressource.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
  }
}
