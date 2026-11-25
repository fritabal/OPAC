/**
 * Catalogue et gestion dynamique des langues de l'application
 */

import { getEnvStorageKey } from '../lib/firebase';

export interface LanguageItem {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
  abbr: string;
}

export const AVAILABLE_LANGUAGES_CATALOG: LanguageItem[] = [
  // 4 langues natives principales
  { code: 'fr', label: 'Français', nativeLabel: 'Français', flag: '🇫🇷', abbr: 'FR' },
  { code: 'en', label: 'Anglais', nativeLabel: 'English', flag: '🇬🇧', abbr: 'EN' },
  { code: 'it', label: 'Italien', nativeLabel: 'Italiano', flag: '🇮🇹', abbr: 'IT' },
  { code: 'de', label: 'Allemand', nativeLabel: 'Deutsch', flag: '🇩🇪', abbr: 'DE' },

  // Langues européennes et internationales complémentaires
  { code: 'es', label: 'Espagnol', nativeLabel: 'Español', flag: '🇪🇸', abbr: 'ES' },
  { code: 'pt', label: 'Portugais', nativeLabel: 'Português', flag: '🇵🇹', abbr: 'PT' },
  { code: 'nl', label: 'Néerlandais', nativeLabel: 'Nederlands', flag: '🇳🇱', abbr: 'NL' },
  { code: 'pl', label: 'Polonais', nativeLabel: 'Polski', flag: '🇵🇱', abbr: 'PL' },
  { code: 'ru', label: 'Russe', nativeLabel: 'Русский', flag: '🇷🇺', abbr: 'RU' },
  { code: 'zh', label: 'Chinois (simplifié)', nativeLabel: '简体中文', flag: '🇨🇳', abbr: 'ZH' },
  { code: 'ja', label: 'Japonais', nativeLabel: '日本語', flag: '🇯🇵', abbr: 'JA' },
  { code: 'ar', label: 'Arabe', nativeLabel: 'العربية', flag: '🇸🇦', abbr: 'AR' },
  { code: 'tr', label: 'Turc', nativeLabel: 'Türkçe', flag: '🇹🇷', abbr: 'TR' },
  { code: 'sv', label: 'Suédois', nativeLabel: 'Svenska', flag: '🇸🇪', abbr: 'SV' },
  { code: 'da', label: 'Danois', nativeLabel: 'Dansk', flag: '🇩🇰', abbr: 'DA' },
  { code: 'no', label: 'Norvégien', nativeLabel: 'Norsk', flag: '🇳🇴', abbr: 'NO' },
  { code: 'fi', label: 'Finnois', nativeLabel: 'Suomi', flag: '🇫🇮', abbr: 'FI' },
  { code: 'el', label: 'Grec', nativeLabel: 'Ελληνικά', flag: '🇬🇷', abbr: 'EL' },
  { code: 'cs', label: 'Tchèque', nativeLabel: 'Čeština', flag: '🇨🇿', abbr: 'CS' },
  { code: 'ro', label: 'Roumain', nativeLabel: 'Română', flag: '🇷🇴', abbr: 'RO' },
  { code: 'hu', label: 'Hongrois', nativeLabel: 'Magyar', flag: '🇭🇺', abbr: 'HU' },
  { code: 'pt-BR', label: 'Portugais (Brésil)', nativeLabel: 'Português (Brasil)', flag: '🇧🇷', abbr: 'BR' },
  { code: 'ko', label: 'Coréen', nativeLabel: '한국어', flag: '🇰🇷', abbr: 'KO' },
  { code: 'uk', label: 'Ukrainien', nativeLabel: 'Українська', flag: '🇺🇦', abbr: 'UA' },
];

export const DEFAULT_LANGUAGE_CODES = ['fr', 'en', 'it', 'de'];
export const LOCAL_STORAGE_ACTIVE_LANGUAGES_KEY = getEnvStorageKey('opac_active_languages');
export const LANGUAGES_CHANGED_EVENT = 'opac_active_languages_changed';

/**
 * Récupère les codes des langues actives sauvegardées dans le localStorage
 */
export function getSavedActiveLanguageCodes(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIVE_LANGUAGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Toujours s'assurer que 'fr' est présent
        if (!parsed.includes('fr')) {
          parsed.unshift('fr');
        }
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return [...DEFAULT_LANGUAGE_CODES];
}

/**
 * Sauvegarde les codes des langues actives dans le localStorage et émet un événement
 */
export function setSavedActiveLanguageCodes(codes: string[]): void {
  try {
    const cleanCodes = Array.from(new Set(codes));
    if (!cleanCodes.includes('fr')) {
      cleanCodes.unshift('fr');
    }
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_LANGUAGES_KEY, JSON.stringify(cleanCodes));
    window.dispatchEvent(new CustomEvent(LANGUAGES_CHANGED_EVENT, { detail: cleanCodes }));
  } catch (err) {
    console.warn('Impossible de sauvegarder les langues actives dans localStorage:', err);
  }
}

/**
 * Récupère la liste ordonnée des objets LanguageItem pour les langues actives
 */
export function getActiveLanguageItems(activeCodes?: string[]): LanguageItem[] {
  const codes = activeCodes || getSavedActiveLanguageCodes();
  const items: LanguageItem[] = [];

  for (const code of codes) {
    const found = AVAILABLE_LANGUAGES_CATALOG.find(
      (l) => l.code.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      items.push(found);
    } else {
      // Langue personnalisée non répertoriée
      items.push({
        code,
        label: code.toUpperCase(),
        nativeLabel: code.toUpperCase(),
        flag: '🌐',
        abbr: code.slice(0, 2).toUpperCase(),
      });
    }
  }

  return items;
}

/**
 * Récupère les langues du catalogue qui ne sont pas encore actives
 */
export function getAvailableLanguagesToAdd(activeCodes?: string[]): LanguageItem[] {
  const activeSet = new Set((activeCodes || getSavedActiveLanguageCodes()).map((c) => c.toLowerCase()));
  return AVAILABLE_LANGUAGES_CATALOG.filter((l) => !activeSet.has(l.code.toLowerCase()));
}

/**
 * Récupère le nom traduit d'une langue dans la langue active de l'interface
 */
export function getLocalizedLanguageName(
  code: string,
  t?: any
): string {
  const normalizedKey = code.toLowerCase().replace('-', '_');
  const catalogItem = AVAILABLE_LANGUAGES_CATALOG.find(
    (l) => l.code.toLowerCase() === code.toLowerCase()
  );
  if (typeof t === 'function') {
    return String(t(`languages.${normalizedKey}`, catalogItem?.label || code.toUpperCase()));
  }
  return catalogItem?.label || code.toUpperCase();
}
