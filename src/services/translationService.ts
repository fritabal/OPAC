import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { TranslationOverridesMap } from '../types/translation';
import i18n from '../i18n';

export const SETTINGS_COLLECTION = 'settings';
export const TRANSLATIONS_DOC_ID = 'translations';
export const LOCAL_STORAGE_OVERRIDES_KEY = 'opac_i18n_overrides';

/**
 * Récupère les surcharges de traductions depuis le cache localStorage
 */
export function getCachedTranslationOverrides(): TranslationOverridesMap {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OVERRIDES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return {};
}

/**
 * Applique immédiatement les surcharges au moteur i18next
 */
export function applyOverridesToI18n(overrides: TranslationOverridesMap): void {
  if (!overrides || typeof overrides !== 'object') return;
  let appliedAny = false;

  for (const [lang, keyMap] of Object.entries(overrides)) {
    if (!keyMap || typeof keyMap !== 'object') continue;
    for (const [key, value] of Object.entries(keyMap)) {
      if (typeof value === 'string') {
        i18n.addResource(lang, 'translation', key, value);
        appliedAny = true;
      }
    }
  }

  // Notifier i18next d'un changement de ressource pour rafraîchir les vues en temps réel
  if (appliedAny) {
    i18n.emit('languageChanged', i18n.language);
  }
}

/**
 * Écoute en temps réel les surcharges de traduction dans Firestore
 */
export function subscribeToTranslationOverrides(
  onData: (overrides: TranslationOverridesMap) => void,
  onError?: (error: unknown) => void
): () => void {
  const docRef = doc(db, SETTINGS_COLLECTION, TRANSLATIONS_DOC_ID);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const overrides: TranslationOverridesMap = data.overrides || {};
        try {
          localStorage.setItem(LOCAL_STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
        } catch {
          // ignore
        }
        applyOverridesToI18n(overrides);
        onData(overrides);
      } else {
        onData({});
      }
    },
    (error) => {
      console.error('Erreur écoute Firestore surcharges traductions:', error);
      onError?.(error);
    }
  );
}

/**
 * Enregistre les surcharges de traduction dans Firestore et dans le cache local
 */
export async function saveTranslationOverrides(
  overrides: TranslationOverridesMap,
  userEmail: string
): Promise<void> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, TRANSLATIONS_DOC_ID);

    await setDoc(
      docRef,
      {
        overrides,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      },
      { merge: true }
    );

    // Mettre à jour le cache local
    try {
      localStorage.setItem(LOCAL_STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch {
      // ignore
    }

    // Appliquer directement au moteur i18next
    applyOverridesToI18n(overrides);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SETTINGS_COLLECTION}/${TRANSLATIONS_DOC_ID}`);
  }
}
