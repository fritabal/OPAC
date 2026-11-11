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

import {
  getSavedActiveLanguageCodes,
  setSavedActiveLanguageCodes,
  DEFAULT_LANGUAGE_CODES,
} from '../i18n/languages';

/**
 * Écoute en temps réel les surcharges de traduction et les langues actives dans Firestore
 */
export function subscribeToTranslationOverrides(
  onData: (overrides: TranslationOverridesMap, activeLanguages?: string[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const docRef = doc(db, SETTINGS_COLLECTION, TRANSLATIONS_DOC_ID);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const overrides: TranslationOverridesMap = data.overrides || {};
        const activeLanguages: string[] = Array.isArray(data.activeLanguages) && data.activeLanguages.length > 0
          ? data.activeLanguages
          : getSavedActiveLanguageCodes();

        try {
          localStorage.setItem(LOCAL_STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
          setSavedActiveLanguageCodes(activeLanguages);
        } catch {
          // ignore
        }
        applyOverridesToI18n(overrides);
        onData(overrides, activeLanguages);
      } else {
        const defaultCodes = getSavedActiveLanguageCodes();
        onData({}, defaultCodes);
      }
    },
    (error) => {
      console.error('Erreur écoute Firestore surcharges traductions:', error);
      onError?.(error);
    }
  );
}

/**
 * Enregistre les surcharges de traduction et les langues actives dans Firestore et dans le cache local
 */
export async function saveTranslationOverrides(
  overrides: TranslationOverridesMap,
  userEmail: string,
  activeLanguages?: string[]
): Promise<void> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, TRANSLATIONS_DOC_ID);
    const languages = activeLanguages || getSavedActiveLanguageCodes();

    const payload: Record<string, any> = {
      overrides,
      activeLanguages: languages,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    };

    await setDoc(docRef, payload, { merge: true });

    // Mettre à jour le cache local
    try {
      localStorage.setItem(LOCAL_STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
      setSavedActiveLanguageCodes(languages);
    } catch {
      // ignore
    }

    // Appliquer directement au moteur i18next
    applyOverridesToI18n(overrides);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SETTINGS_COLLECTION}/${TRANSLATIONS_DOC_ID}`);
    throw error;
  }
}

/**
 * Supprime une langue des langues actives et efface ses surcharges
 */
export async function deleteLanguageFromApp(
  langCode: string,
  currentOverrides: TranslationOverridesMap,
  userEmail: string
): Promise<{ updatedOverrides: TranslationOverridesMap; updatedLanguages: string[] }> {
  const currentLanguages = getSavedActiveLanguageCodes();
  const updatedLanguages = currentLanguages.filter((c) => c.toLowerCase() !== langCode.toLowerCase());
  
  // Garantir au moins le français
  if (!updatedLanguages.includes('fr')) {
    updatedLanguages.unshift('fr');
  }

  const updatedOverrides = { ...currentOverrides };
  delete updatedOverrides[langCode];

  // Si la langue actuelle dans l'interface était celle supprimée, repasser en français
  if (i18n.language === langCode) {
    i18n.changeLanguage('fr');
    try {
      localStorage.setItem('app_language', 'fr');
    } catch {
      // ignore
    }
  }

  await saveTranslationOverrides(updatedOverrides, userEmail, updatedLanguages);
  return { updatedOverrides, updatedLanguages };
}

/**
 * Ajoute une nouvelle langue avec ses clés de traduction initiales
 */
export async function addLanguageToApp(
  langCode: string,
  initialKeyMap: Record<string, string>,
  currentOverrides: TranslationOverridesMap,
  userEmail: string
): Promise<{ updatedOverrides: TranslationOverridesMap; updatedLanguages: string[] }> {
  const currentLanguages = getSavedActiveLanguageCodes();
  const updatedLanguages = Array.from(new Set([...currentLanguages, langCode]));

  const updatedOverrides: TranslationOverridesMap = {
    ...currentOverrides,
    [langCode]: {
      ...(currentOverrides[langCode] || {}),
      ...initialKeyMap,
    },
  };

  // Enregistrer également dans i18next
  for (const [key, val] of Object.entries(initialKeyMap)) {
    i18n.addResource(langCode, 'translation', key, val);
  }
  i18n.emit('languageChanged', i18n.language);

  await saveTranslationOverrides(updatedOverrides, userEmail, updatedLanguages);
  return { updatedOverrides, updatedLanguages };
}

/**
 * Ajoute un lot de plusieurs nouvelles langues avec leurs clés de traduction initiales
 */
export async function addMultipleLanguagesToApp(
  batch: Array<{ langCode: string; initialKeyMap: Record<string, string> }>,
  currentOverrides: TranslationOverridesMap,
  userEmail: string
): Promise<{ updatedOverrides: TranslationOverridesMap; updatedLanguages: string[] }> {
  const currentLanguages = getSavedActiveLanguageCodes();
  const newCodes = batch.map((b) => b.langCode);
  const updatedLanguages = Array.from(new Set([...currentLanguages, ...newCodes]));

  const updatedOverrides: TranslationOverridesMap = { ...currentOverrides };
  for (const item of batch) {
    updatedOverrides[item.langCode] = {
      ...(updatedOverrides[item.langCode] || {}),
      ...item.initialKeyMap,
    };
    for (const [key, val] of Object.entries(item.initialKeyMap)) {
      i18n.addResource(item.langCode, 'translation', key, val);
    }
  }
  i18n.emit('languageChanged', i18n.language);

  await saveTranslationOverrides(updatedOverrides, userEmail, updatedLanguages);
  return { updatedOverrides, updatedLanguages };
}
