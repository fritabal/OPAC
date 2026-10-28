import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppUser } from '../types/user';

export type NotificationCategory =
  | 'project_prioritization'
  | 'project_staffing'
  | 'project_general'
  | 'project_created'
  | 'project_deleted'
  | 'settings_criteria'
  | 'settings_budget'
  | 'settings_lifecycle'
  | 'settings_bonus'
  | 'settings_skills'
  | 'settings_resources'
  | 'settings_custom_params';

export interface CollaborationNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  actorEmail?: string;
  actorName?: string;
  projectName?: string;
  projectId?: string;
  timestamp: number;
  sessionId: string;
}

// Identifiant unique de session généré aléatoirement pour chaque onglet / fenêtre de navigateur
export const CLIENT_SESSION_ID: string =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

// Horodatage d'initialisation de la session locale (en ms)
const SESSION_START_TIME: number = Date.now();

// Référence vers l'utilisateur actif actuel dans la session locale
let currentActiveUser: AppUser | null = null;

export function setCollaborationCurrentUser(user: AppUser | null) {
  currentActiveUser = user;
}

export function getCollaborationCurrentUser(): AppUser | null {
  return currentActiveUser;
}

/**
 * Publie un événement de modification collaborative sur Firestore.
 * Tous les AUTRES utilisateurs connectés recevront une notification popup instantanée.
 */
export async function broadcastCollaborationChange(params: {
  category: NotificationCategory;
  message: string;
  title?: string;
  projectName?: string;
  projectId?: string;
  actorEmail?: string;
  actorName?: string;
}): Promise<void> {
  try {
    const actorEmail =
      params.actorEmail ||
      currentActiveUser?.email ||
      '';

    const actorName =
      params.actorName ||
      currentActiveUser?.displayName ||
      (actorEmail ? actorEmail.split('@')[0] : 'Un utilisateur');

    const payload = {
      category: params.category,
      title: params.title || 'Mise à jour collaborative',
      message: params.message,
      actorEmail,
      actorName,
      projectName: params.projectName || null,
      projectId: params.projectId || null,
      timestamp: Date.now(),
      sessionId: CLIENT_SESSION_ID,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'activity_events'), payload);
  } catch (error) {
    // Ne jamais bloquer l'action utilisateur en cas d'erreur de journalisation
    console.warn('Erreur lors de la diffusion de la notification collaborative:', error);
  }
}

/**
 * Souscrit aux notifications collaboratives en temps réel émises par d'autres utilisateurs.
 * Ignore systématiquement les actions effectuées dans le même onglet (même sessionId).
 */
export function subscribeToCollaborationNotifications(
  onNotification: (notification: CollaborationNotification) => void
): () => void {
  const shownNotificationIds = new Set<string>();

  const q = query(
    collection(db, 'activity_events'),
    orderBy('timestamp', 'desc'),
    limit(15)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          if (shownNotificationIds.has(docId)) {
            return;
          }
          shownNotificationIds.add(docId);

          const data = change.doc.data();
          const eventSessionId = data.sessionId;
          const eventTimestamp = typeof data.timestamp === 'number' ? data.timestamp : 0;

          // Règle 1 : Ne JAMAIS notifier l'utilisateur qui a lui-même initié l'action dans cette session
          if (eventSessionId === CLIENT_SESSION_ID) {
            return;
          }

          // Règle 2 : Ne notifier que pour les événements survenus après ou immédiatement lors de l'ouverture (tolérance de 2s)
          if (eventTimestamp < SESSION_START_TIME - 2000) {
            return;
          }

          const notification: CollaborationNotification = {
            id: docId,
            category: data.category || 'project_general',
            title: data.title || 'Mise à jour en direct',
            message: data.message || 'Une modification a été effectuée par un autre utilisateur.',
            actorEmail: data.actorEmail || undefined,
            actorName: data.actorName || undefined,
            projectName: data.projectName || undefined,
            projectId: data.projectId || undefined,
            timestamp: eventTimestamp,
            sessionId: eventSessionId,
          };

          onNotification(notification);
        }
      });
    },
    (error) => {
      console.warn('Erreur écoute des notifications collaboratives:', error);
    }
  );
}
