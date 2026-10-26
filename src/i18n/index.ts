import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fr } from './locales/fr';
import { en } from './locales/en';
import { it } from './locales/it';
import { de } from './locales/de';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷', abbr: 'FR' },
  { code: 'en', label: 'English', flag: '🇬🇧', abbr: 'EN' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', abbr: 'IT' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', abbr: 'DE' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

// Récupération de la langue sauvegardée dans localStorage ou par défaut 'fr'
const getSavedLanguage = (): SupportedLanguage => {
  try {
    const saved = localStorage.getItem('app_language');
    if (saved === 'fr' || saved === 'en' || saved === 'it' || saved === 'de') {
      return saved;
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

export const changeAppLanguage = (lang: SupportedLanguage) => {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem('app_language', lang);
  } catch (err) {
    console.warn('Impossible de sauvegarder la langue dans localStorage:', err);
  }
};

export default i18n;
