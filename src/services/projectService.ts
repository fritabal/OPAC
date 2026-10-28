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
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { Project, ProjectFormData } from '../types/project';
import { broadcastCollaborationChange } from './collaborationNotificationService';

const COLLECTION_NAME = 'projects';
const COUNTER_DOC_PATH = 'counters/projects';

/**
 * Obtient le prochain identifiant entier séquentiel unique pour un nouveau projet.
 * Cet identifiant ne sera JAMAIS réutilisé, même si le projet est supprimé ou archivé.
 */
async function getNextProjectNumber(): Promise<number> {
  const counterRef = doc(db, 'counters', 'projects');

  try {
    return await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentNumber = 0;

      if (counterSnap.exists()) {
        currentNumber = counterSnap.data().lastProjectNumber || 0;
      } else {
        // En cas de premier appel, vérifier s'il existe déjà des projets dans la base
        const projectsSnap = await getDocs(collection(db, COLLECTION_NAME));
        projectsSnap.docs.forEach((d) => {
          const num = d.data().projectNumber;
          if (typeof num === 'number' && num > currentNumber) {
            currentNumber = num;
          }
        });
      }

      const nextNumber = currentNumber + 1;
      transaction.set(counterRef, {
        lastProjectNumber: nextNumber,
        updatedAt: serverTimestamp(),
      });

      return nextNumber;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COUNTER_DOC_PATH);
    throw error;
  }
}

/**
 * Souscription en temps réel aux projets.
 */
export function subscribeToProjects(
  onData: (projects: Project[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION_NAME), orderBy('projectNumber', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const projects: Project[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          projectNumber: typeof data.projectNumber === 'number' ? data.projectNumber : 0,
          name: data.name || '',
          stateId: data.stateId || '',
          stateName: data.stateName || '',
          description: data.description || '',
          createdByEmail: data.createdByEmail || '',
          projectManagerEmail: data.projectManagerEmail || '',
          deputyEmail: data.deputyEmail || null,
          isConfidential: Boolean(data.isConfidential),
          budgetLineId: data.budgetLineId || '',
          estimatedBudget: typeof data.estimatedBudget === 'number' ? data.estimatedBudget : 0,
          criteriaValues: data.criteriaValues || {},
          bonus: typeof data.bonus === 'number' ? data.bonus : null,
          roi: typeof data.roi === 'number' ? data.roi : null,
          customParamValues: data.customParamValues || {},
          capacityUpdatedMonth: data.capacityUpdatedMonth || null,
          capacityDaysPerSkill: data.capacityDaysPerSkill || {},
          isStaffed: data.isStaffed !== undefined ? Boolean(data.isStaffed) : undefined,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      });
      onData(projects);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

/**
 * Crée un nouveau projet avec génération transactionnelle de l'identifiant séquentiel unique.
 */
export async function createProject(formData: ProjectFormData): Promise<Project> {
  const trimmedName = formData.name.trim();
  if (!trimmedName) {
    throw new Error('Le nom court du projet est obligatoire.');
  }
  if (trimmedName.length > 30) {
    throw new Error('Le nom court du projet ne peut pas dépasser 30 caractères.');
  }
  if (!formData.stateId) {
    throw new Error('L’état du projet est obligatoire.');
  }
  if (!formData.projectManagerEmail) {
    throw new Error('L’email du chef de projet est obligatoire.');
  }
  if (!formData.budgetLineId) {
    throw new Error('La ligne budgétaire associée au projet est obligatoire.');
  }
  if (formData.description && formData.description.length > 3000) {
    throw new Error('La description détaillée ne peut pas dépasser 3000 caractères.');
  }

  try {
    const projectNumber = await getNextProjectNumber();

    const payload = {
      projectNumber,
      name: trimmedName,
      stateId: formData.stateId,
      stateName: formData.stateName || '',
      description: formData.description ? formData.description.trim() : '',
      createdByEmail: formData.createdByEmail.trim().toLowerCase(),
      projectManagerEmail: formData.projectManagerEmail.trim().toLowerCase(),
      deputyEmail: formData.deputyEmail ? formData.deputyEmail.trim().toLowerCase() : null,
      isConfidential: Boolean(formData.isConfidential),
      budgetLineId: formData.budgetLineId,
      estimatedBudget: Number(formData.estimatedBudget) || 0,
      criteriaValues: formData.criteriaValues || {},
      bonus: typeof formData.bonus === 'number' ? formData.bonus : null,
      roi: typeof formData.roi === 'number' ? formData.roi : null,
      customParamValues: formData.customParamValues || {},
      capacityUpdatedMonth: formData.capacityUpdatedMonth || null,
      capacityDaysPerSkill: formData.capacityDaysPerSkill || {},
      isStaffed: formData.isStaffed !== undefined ? Boolean(formData.isStaffed) : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Nettoyage strict de toutes les propriétés indéfinies pour empêcher toute erreur addDoc Firestore
    const cleanPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        cleanPayload[key] = value;
      }
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanPayload);

    // Diffusion de la notification aux autres utilisateurs connectés
    broadcastCollaborationChange({
      category: 'project_created',
      title: 'Nouveau projet créé',
      message: `Un autre utilisateur vient de créer le projet « ${trimmedName} » (#${projectNumber}).`,
      projectName: trimmedName,
      projectId: docRef.id,
    });

    return {
      id: docRef.id,
      ...formData,
      projectNumber,
      name: trimmedName,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    throw error;
  }
}

/**
 * Met à jour un projet existant (sans modifier projectNumber ni createdByEmail).
 */
export async function updateProject(id: string, formData: Partial<ProjectFormData>): Promise<void> {
  if (formData.name !== undefined) {
    const trimmed = formData.name.trim();
    if (!trimmed) {
      throw new Error('Le nom court du projet ne peut pas être vide.');
    }
    if (trimmed.length > 30) {
      throw new Error('Le nom court du projet ne peut pas dépasser 30 caractères.');
    }
  }

  if (formData.description !== undefined && formData.description.length > 3000) {
    throw new Error('La description détaillée ne peut pas dépasser 3000 caractères.');
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (formData.name !== undefined) payload.name = formData.name.trim();
    if (formData.stateId !== undefined) payload.stateId = formData.stateId;
    if (formData.stateName !== undefined) payload.stateName = formData.stateName;
    if (formData.description !== undefined) payload.description = formData.description.trim();
    if (formData.projectManagerEmail !== undefined) {
      payload.projectManagerEmail = formData.projectManagerEmail.trim().toLowerCase();
    }
    if (formData.deputyEmail !== undefined) {
      payload.deputyEmail = formData.deputyEmail ? formData.deputyEmail.trim().toLowerCase() : null;
    }
    if (formData.isConfidential !== undefined) {
      payload.isConfidential = Boolean(formData.isConfidential);
    }
    if (formData.budgetLineId !== undefined) payload.budgetLineId = formData.budgetLineId;
    if (formData.estimatedBudget !== undefined) payload.estimatedBudget = Number(formData.estimatedBudget) || 0;
    if (formData.criteriaValues !== undefined) payload.criteriaValues = formData.criteriaValues;
    if (formData.bonus !== undefined) {
      payload.bonus = typeof formData.bonus === 'number' ? formData.bonus : null;
    }
    if (formData.roi !== undefined) {
      payload.roi = typeof formData.roi === 'number' ? formData.roi : null;
    }
    if (formData.customParamValues !== undefined) payload.customParamValues = formData.customParamValues;
    if (formData.capacityUpdatedMonth !== undefined) payload.capacityUpdatedMonth = formData.capacityUpdatedMonth;
    if (formData.capacityDaysPerSkill !== undefined) payload.capacityDaysPerSkill = formData.capacityDaysPerSkill;
    if (formData.isStaffed !== undefined) payload.isStaffed = Boolean(formData.isStaffed);

    const cleanPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        cleanPayload[key] = value;
      }
    }

    await updateDoc(docRef, cleanPayload);

    // Notification spécifique selon la nature de la mise à jour
    const targetProjectName = formData.name ? formData.name.trim() : '';
    if (formData.criteriaValues !== undefined || formData.bonus !== undefined) {
      broadcastCollaborationChange({
        category: 'project_prioritization',
        title: 'Critères de priorité réévalués',
        message: targetProjectName
          ? `Un autre utilisateur vient de réévaluer les critères de priorité du projet « ${targetProjectName} ».`
          : `Un autre utilisateur vient de réévaluer les critères de priorité d'un projet.`,
        projectName: targetProjectName,
        projectId: id,
      });
    } else if (
      formData.capacityDaysPerSkill !== undefined ||
      formData.isStaffed !== undefined ||
      formData.capacityUpdatedMonth !== undefined
    ) {
      broadcastCollaborationChange({
        category: 'project_staffing',
        title: 'Demandes de staffing modifiées',
        message: targetProjectName
          ? `Un autre utilisateur vient de mettre à jour les demandes de staffing du projet « ${targetProjectName} ».`
          : `Un autre utilisateur vient de mettre à jour les demandes de staffing d'un projet.`,
        projectName: targetProjectName,
        projectId: id,
      });
    } else {
      broadcastCollaborationChange({
        category: 'project_general',
        title: 'Projet mis à jour',
        message: targetProjectName
          ? `Un autre utilisateur vient de mettre à jour les informations du projet « ${targetProjectName} ».`
          : `Un autre utilisateur vient de mettre à jour les informations d'un projet.`,
        projectName: targetProjectName,
        projectId: id,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    throw error;
  }
}

/**
 * Met à jour rapidement le statut de staffing d'un projet.
 */
export async function updateProjectStaffing(
  id: string,
  isStaffed: boolean,
  projectName?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isStaffed: Boolean(isStaffed),
      updatedAt: serverTimestamp(),
    });

    broadcastCollaborationChange({
      category: 'project_staffing',
      title: 'Statut de staffing modifié',
      message: projectName
        ? `Un autre utilisateur vient de modifier le statut de staffing du projet « ${projectName} » (${
            isStaffed ? 'marqué comme staffé' : 'décoché'
          }).`
        : `Un autre utilisateur vient de modifier le statut de staffing d'un projet (${
            isStaffed ? 'marqué comme staffé' : 'décoché'
          }).`,
      projectName,
      projectId: id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    throw error;
  }
}

/**
 * Met à jour rapidement les données capacitaires d'un projet.
 */
export async function updateProjectCapacity(
  id: string,
  capacityUpdatedMonth: string | null | undefined,
  capacityDaysPerSkill: Record<string, number | null> | undefined,
  projectName?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    if (capacityUpdatedMonth !== undefined) {
      payload.capacityUpdatedMonth = capacityUpdatedMonth;
    }
    if (capacityDaysPerSkill !== undefined) {
      payload.capacityDaysPerSkill = capacityDaysPerSkill;
    }
    await updateDoc(docRef, payload);

    broadcastCollaborationChange({
      category: 'project_staffing',
      title: 'Demandes capacitaires mises à jour',
      message: projectName
        ? `Un autre utilisateur vient de mettre à jour les demandes capacitaires du projet « ${projectName} ».`
        : `Un autre utilisateur vient de mettre à jour les demandes capacitaires d'un projet.`,
      projectName,
      projectId: id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    throw error;
  }
}

/**
 * Supprime un projet.
 */
export async function deleteProject(id: string, projectName?: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));

    broadcastCollaborationChange({
      category: 'project_deleted',
      title: 'Projet supprimé',
      message: projectName
        ? `Un autre utilisateur vient de supprimer le projet « ${projectName} ».`
        : `Un autre utilisateur vient de supprimer un projet.`,
      projectName,
      projectId: id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    throw error;
  }
}
