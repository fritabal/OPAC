/**
 * Utilitaires pour la gestion et l'internationalisation des dates et périodes capacitaires
 * Prise en charge des langues : Français (fr), Anglais (en), Italien (it), Allemand (de)
 */

export type SupportedLanguage = 'fr' | 'en' | 'it' | 'de';

export const SHORT_MONTHS: Record<SupportedLanguage, string[]> = {
  fr: ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  it: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
  de: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
};

export const LONG_MONTHS: Record<SupportedLanguage, string[]> = {
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
};

/**
 * Normalise le code langue vers l'une des 4 langues supportées
 */
export function normalizeLanguage(lang?: string | null): SupportedLanguage {
  if (!lang) return 'fr';
  const prefix = lang.toLowerCase().slice(0, 2);
  if (prefix === 'en') return 'en';
  if (prefix === 'it') return 'it';
  if (prefix === 'de') return 'de';
  return 'fr';
}

/**
 * Table de correspondance pour le parsing de chaînes textuelles héritées de mois
 * (ex: "Nov. 2026", "Novembre 2026", "Dez 2026", etc.)
 */
const MONTH_NAME_TO_INDEX: Record<string, number> = {
  // Français
  'janv': 1, 'janv.': 1, 'janvier': 1,
  'fevr': 2, 'fevr.': 2, 'févr': 2, 'févr.': 2, 'fevrier': 2, 'février': 2,
  'mars': 3,
  'avr': 4, 'avr.': 4, 'avril': 4,
  'mai': 5,
  'juin': 6,
  'juil': 7, 'juil.': 7, 'juillet': 7,
  'aout': 8, 'août': 8,
  'sept': 9, 'sept.': 9, 'septembre': 9,
  'oct': 10, 'oct.': 10, 'octobre': 10,
  'nov': 11, 'nov.': 11, 'novembre': 11,
  'dec': 12, 'dec.': 12, 'déc': 12, 'déc.': 12, 'decembre': 12, 'décembre': 12,

  // Anglais
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'september': 9,
  'october': 10,
  'november': 11,
  'december': 12,

  // Italien
  'gen': 1, 'gennaio': 1,
  'febbraio': 2,
  'marzo': 3,
  'aprile': 4,
  'maggio': 5,
  'giu': 6, 'giugno': 6,
  'lug': 7, 'luglio': 7,
  'ago': 8, 'agosto': 8,
  'settembre': 9,
  'ott': 10, 'ottobre': 10,
  'dic': 12, 'dicembre': 12,

  // Allemand
  'januar': 1,
  'februar': 2,
  'märz': 3, 'maerz': 3,
  'juni': 6,
  'juli': 7,
  'okt': 10, 'oktober': 10,
  'dez': 12, 'dez.': 12, 'dezember': 12,
};

/**
 * Analyse n'importe quel format de période stocké ou saisi :
 * - ISO "YYYY-MM" (ex: "2026-11")
 * - "MM-YYYY" (ex: "11-2026")
 * - Chaîne avec nom de mois (ex: "Nov. 2026", "Novembre 2026", "Nov 2026", "Dez. 2026")
 *
 * Retourne { year, month, key: "YYYY-MM" } ou null.
 */
export function parsePeriod(val?: string | null): { year: number; month: number; key: string } | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === '???') return null;

  // 1. Format ISO "YYYY-MM" (ex: 2026-11)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return {
        year,
        month,
        key: `${year}-${String(month).padStart(2, '0')}`,
      };
    }
  }

  // 2. Format "MM-YYYY" (ex: 11-2026)
  const mmYyyyMatch = trimmed.match(/^(\d{1,2})-(\d{4})$/);
  if (mmYyyyMatch) {
    const month = parseInt(mmYyyyMatch[1], 10);
    const year = parseInt(mmYyyyMatch[2], 10);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return {
        year,
        month,
        key: `${year}-${String(month).padStart(2, '0')}`,
      };
    }
  }

  // 3. Format textuel avec nom de mois (ex: "Nov. 2026", "Novembre 2026", "Nov 2026")
  const yearMatch = trimmed.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const monthWord = trimmed
      .replace(yearMatch[1], '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}.]/gu, ''); // conserve lettres et point

    // Correspondance directe ou préfixe
    let monthIndex = MONTH_NAME_TO_INDEX[monthWord];
    if (!monthIndex) {
      const cleanWord = monthWord.replace('.', '');
      monthIndex = MONTH_NAME_TO_INDEX[cleanWord];
    }
    if (!monthIndex) {
      // Recherche préfixe 3 lettres
      const prefix3 = monthWord.slice(0, 3);
      monthIndex = MONTH_NAME_TO_INDEX[prefix3];
    }

    if (monthIndex && monthIndex >= 1 && monthIndex <= 12) {
      return {
        year,
        month: monthIndex,
        key: `${year}-${String(monthIndex).padStart(2, '0')}`,
      };
    }
  }

  return null;
}

/**
 * Normalise une clé de période pour le stockage Firestore au format language-independent "YYYY-MM"
 * Exemple : "11-2026" -> "2026-11", "Nov. 2026" -> "2026-11", "2026-11" -> "2026-11"
 */
export function normalizePeriodKey(val?: string | null): string | null {
  const parsed = parsePeriod(val);
  return parsed ? parsed.key : null;
}

/**
 * Formate une période (YYYY-MM, MM-YYYY ou texte hérité) à la volée dans la langue active (fr, en, it, de).
 *
 * Exemples pour la période 2026-11 :
 * - format='short' :
 *   - fr: "Nov. 2026"
 *   - en: "Nov 2026"
 *   - it: "Nov 2026"
 *   - de: "Nov. 2026"
 * - format='long' :
 *   - fr: "Novembre 2026"
 *   - en: "November 2026"
 *   - it: "Novembre 2026"
 *   - de: "November 2026"
 */
export function formatPeriodLocale(
  val?: string | null,
  lang?: string,
  options?: { format?: 'short' | 'long'; fallback?: string }
): string {
  const parsed = parsePeriod(val);
  if (!parsed) {
    return options?.fallback !== undefined ? options.fallback : (val || '???');
  }

  const normalizedLang = normalizeLanguage(lang);
  const formatType = options?.format || 'short';
  const monthList = formatType === 'long' ? LONG_MONTHS[normalizedLang] : SHORT_MONTHS[normalizedLang];
  const monthName = monthList[parsed.month - 1] || '';

  return `${monthName} ${parsed.year}`;
}

/**
 * Calcule la prochaine période (mois suivant M+1 à partir de baseDate)
 * et retourne à la fois la clé normalisée ISO "YYYY-MM" et les libellés traduits.
 */
export function getNextPeriodInfo(baseDate: Date = new Date(), lang?: string) {
  const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  const year = nextDate.getFullYear();
  const month = nextDate.getMonth() + 1;
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const shortLabel = formatPeriodLocale(key, lang, { format: 'short' });
  const longLabel = formatPeriodLocale(key, lang, { format: 'long' });

  return {
    key,
    year,
    month,
    shortLabel,
    longLabel,
  };
}
