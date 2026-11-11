import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fr } from './locales/fr';
import { en } from './locales/en';
import { it } from './locales/it';
import { de } from './locales/de';

import {
  LanguageItem,
  getActiveLanguageItems,
  getSavedActiveLanguageCodes,
} from './languages';

export {
  AVAILABLE_LANGUAGES_CATALOG,
  DEFAULT_LANGUAGE_CODES,
  LOCAL_STORAGE_ACTIVE_LANGUAGES_KEY,
  LANGUAGES_CHANGED_EVENT,
  getActiveLanguageItems,
  getSavedActiveLanguageCodes,
  setSavedActiveLanguageCodes,
  getAvailableLanguagesToAdd,
  getLocalizedLanguageName,
} from './languages';
export type { LanguageItem } from './languages';

export const SUPPORTED_LANGUAGES: readonly LanguageItem[] = getActiveLanguageItems();

export type SupportedLanguage = string;

// Récupération de la langue sauvegardée dans localStorage ou par défaut 'fr'
const getSavedLanguage = (): SupportedLanguage => {
  try {
    const saved = localStorage.getItem('app_language');
    if (saved && typeof saved === 'string') {
      const activeCodes = getSavedActiveLanguageCodes();
      if (activeCodes.includes(saved)) {
        return saved;
      }
    }
  } catch {
    // Si localStorage non disponible
  }
  return 'fr';
};

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    it: { translation: it },
    de: { translation: de },
  },
  lng: getSavedLanguage(),
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false, // React gère déjà le XSS
  },
});

// Application immédiate des surcharges de traductions enregistrées dans localStorage
try {
  const cachedRaw = localStorage.getItem('opac_i18n_overrides');
  if (cachedRaw) {
    const cachedOverrides = JSON.parse(cachedRaw);
    if (cachedOverrides && typeof cachedOverrides === 'object') {
      for (const [lang, keyMap] of Object.entries(cachedOverrides)) {
        if (keyMap && typeof keyMap === 'object') {
          for (const [k, v] of Object.entries(keyMap as Record<string, string>)) {
            if (typeof v === 'string') {
              i18n.addResource(lang, 'translation', k, v);
            }
          }
        }
      }
    }
  }
} catch {
  // ignore
}

export const changeAppLanguage = (lang: SupportedLanguage) => {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem('app_language', lang);
  } catch (err) {
    console.warn('Impossible de sauvegarder la langue dans localStorage:', err);
  }
};

export default i18n;
