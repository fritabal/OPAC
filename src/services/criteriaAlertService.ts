import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { CriteriaAlertConfig, DEFAULT_CRITERIA_ALERT_CONFIG } from '../types/criteriaAlert';
import { broadcastCollaborationChange } from './collaborationNotificationService';

export const SETTINGS_COLLECTION = 'settings';
export const CRITERIA_ALERT_DOC_ID = 'criteria_alert_config';
export const LOCAL_STORAGE_KEY = 'opac_criteria_alert_config';

/**
 * Récupère la configuration depuis le cache local pour un affichage instantané
 */
export function getCachedCriteriaAlertConfig(): CriteriaAlertConfig {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CRITERIA_ALERT_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_CRITERIA_ALERT_CONFIG;
}

/**
 * Écoute en temps réel la configuration des alertes d'étagement dans Firestore
 */
export function subscribeToCriteriaAlertConfig(
  onData: (config: CriteriaAlertConfig) => void,
  onError?: (error: unknown) => void
): () => void {
  const docRef = doc(db, SETTINGS_COLLECTION, CRITERIA_ALERT_DOC_ID);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const config: CriteriaAlertConfig = {
          singleLevelThreshold:
            typeof data.singleLevelThreshold === 'number'
              ? data.singleLevelThreshold
              : DEFAULT_CRITERIA_ALERT_CONFIG.singleLevelThreshold,
          cumulatedThreshold:
            typeof data.cumulatedThreshold === 'number'
              ? data.cumulatedThreshold
              : DEFAULT_CRITERIA_ALERT_CONFIG.cumulatedThreshold,
          levelCountPercentThreshold:
            typeof data.levelCountPercentThreshold === 'number'
              ? data.levelCountPercentThreshold
              : DEFAULT_CRITERIA_ALERT_CONFIG.levelCountPercentThreshold,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          updatedBy: data.updatedBy || '',
        };

        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
        } catch {
          // ignore
        }

        onData(config);
      } else {
        onData(DEFAULT_CRITERIA_ALERT_CONFIG);
      }
    },
    (error) => {
      console.warn('Erreur écoute configuration alertes critères Firestore:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${CRITERIA_ALERT_DOC_ID}`);
      onData(getCachedCriteriaAlertConfig());
    }
  );
}

/**
 * Sauvegarde la configuration des alertes de mauvais étagement des critères dans Firestore
 */
export async function saveCriteriaAlertConfig(
  config: Partial<CriteriaAlertConfig>,
  userEmail: string = ''
): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, CRITERIA_ALERT_DOC_ID);

  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    };

    if (config.singleLevelThreshold !== undefined) {
      payload.singleLevelThreshold = Math.max(1, Math.min(100, Math.round(config.singleLevelThreshold)));
    }
    if (config.cumulatedThreshold !== undefined) {
      payload.cumulatedThreshold = Math.max(1, Math.min(100, Math.round(config.cumulatedThreshold)));
    }
    if (config.levelCountPercentThreshold !== undefined) {
      payload.levelCountPercentThreshold = Math.max(1, Math.min(100, Math.round(config.levelCountPercentThreshold)));
    }

    await setDoc(docRef, payload, { merge: true });

    broadcastCollaborationChange({
      category: 'settings_criteria',
      title: "Paramètres d'alerte des critères modifiés",
      message: "Un administrateur vient de mettre à jour les seuils d'alerte de mauvais étagement des critères.",
      actorEmail: userEmail,
    });

    // Mise à jour du cache local
    const current = getCachedCriteriaAlertConfig();
    const updated = {
      ...current,
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COLLECTION}/${CRITERIA_ALERT_DOC_ID}`);
    throw error;
  }
}
