import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { BonusConfig, DEFAULT_BONUS_CONFIG } from '../types/bonus';

export const SETTINGS_COLLECTION = 'settings';
export const BONUS_DOC_ID = 'prioritization_bonus';
export const LOCAL_STORAGE_KEY = 'opac_bonus_config';

/**
 * Récupère la configuration depuis le cache local pour affichage instantané
 */
export function getCachedBonusConfig(): BonusConfig {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_BONUS_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_BONUS_CONFIG;
}

/**
 * Écoute en temps réel la configuration des bonus dans Firestore
 */
export function subscribeToBonusConfig(
  onData: (config: BonusConfig) => void,
  onError?: (error: unknown) => void
): () => void {
  const docRef = doc(db, SETTINGS_COLLECTION, BONUS_DOC_ID);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const config: BonusConfig = {
          isBonusActive: typeof data.isBonusActive === 'boolean' ? data.isBonusActive : DEFAULT_BONUS_CONFIG.isBonusActive,
          checkQuotas: typeof data.checkQuotas === 'boolean' ? data.checkQuotas : DEFAULT_BONUS_CONFIG.checkQuotas,
          maxBonusedProjects:
            typeof data.maxBonusedProjects === 'number'
              ? data.maxBonusedProjects
              : DEFAULT_BONUS_CONFIG.maxBonusedProjects,
          maxBonusPointsPerProject:
            typeof data.maxBonusPointsPerProject === 'number'
              ? data.maxBonusPointsPerProject
              : DEFAULT_BONUS_CONFIG.maxBonusPointsPerProject,
          maxTotalBonusPoints:
            typeof data.maxTotalBonusPoints === 'number'
              ? data.maxTotalBonusPoints
              : DEFAULT_BONUS_CONFIG.maxTotalBonusPoints,
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
        // Le document n'existe pas encore : on renvoie la configuration par défaut
        onData(DEFAULT_BONUS_CONFIG);
      }
    },
    (error) => {
      console.warn('Erreur écoute configuration bonus Firestore:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${BONUS_DOC_ID}`);
      onData(getCachedBonusConfig());
    }
  );
}

/**
 * Sauvegarde la configuration des bonus dans Firestore
 */
export async function saveBonusConfig(
  config: Partial<BonusConfig>,
  userEmail: string = ''
): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, BONUS_DOC_ID);

  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    };

    if (config.isBonusActive !== undefined) payload.isBonusActive = config.isBonusActive;
    if (config.checkQuotas !== undefined) payload.checkQuotas = config.checkQuotas;
    if (config.maxBonusedProjects !== undefined) payload.maxBonusedProjects = config.maxBonusedProjects;
    if (config.maxBonusPointsPerProject !== undefined) payload.maxBonusPointsPerProject = config.maxBonusPointsPerProject;
    if (config.maxTotalBonusPoints !== undefined) payload.maxTotalBonusPoints = config.maxTotalBonusPoints;

    await setDoc(docRef, payload, { merge: true });

    // Mise à jour du cache local
    const current = getCachedBonusConfig();
    const updated = { ...current, ...config, updatedAt: new Date().toISOString(), updatedBy: userEmail };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COLLECTION}/${BONUS_DOC_ID}`);
  }
}
