import { TranslationLeafNode } from '../types/translation';
import { getPretranslatedDictionary } from './pretranslatedStore';

export interface TranslationProgress {
  current: number;
  total: number;
  percentage: number;
  currentKey?: string;
}

export interface TranslationResult {
  success: boolean;
  translations?: Record<string, string>;
  error?: string;
  isOffline?: boolean;
}

/**
 * Traduit un texte unitaire via Google Translate API
 */
export async function translateTextOnline(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  if (!text || text.trim() === '') return text;
  
  // Conserver les variables i18n comme {{name}}
  const placeholders: string[] = [];
  const sanitized = text.replace(/\{\{[^}]+\}\}/g, (match) => {
    placeholders.push(match);
    return `__PH_${placeholders.length - 1}__`;
  });

  const langCode = targetLang === 'zh' ? 'zh-CN' : targetLang === 'pt-BR' ? 'pt' : targetLang;
  const slCode = sourceLang === 'zh' ? 'zh-CN' : sourceLang === 'pt-BR' ? 'pt' : (sourceLang || 'auto');

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    slCode
  )}&tl=${encodeURIComponent(langCode)}&dt=t&q=${encodeURIComponent(sanitized)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`Google Translate API HTTP ${response.status}`);
  }

  const json = await response.json();
  if (Array.isArray(json) && Array.isArray(json[0])) {
    let translated = json[0].map((item: any) => item[0]).join('');
    // Restaurer les placeholders
    placeholders.forEach((ph, i) => {
      translated = translated.replace(new RegExp(`__PH_${i}__`, 'g'), ph);
    });
    return translated || text;
  }

  return text;
}

const BATCH_DELIMITER = ' ||| ';

/**
 * Traduit un groupe de textes en une seule requête HTTP (regroupement par délimiteur)
 * Réduit drastiquement le nombre d'appels API (10-15 requêtes au total au lieu de ~190)
 * et évite le blocage par limitation de débit (HTTP 429).
 */
async function translateBatchOnline(
  texts: string[],
  targetLang: string,
  retries = 2
): Promise<string[]> {
  if (texts.length === 0) return [];

  // Remplacement temporaire des balises {{variable}}
  const allPlaceholders: string[][] = [];
  const sanitizedTexts = texts.map((text, idx) => {
    const phList: string[] = [];
    const sanitized = (text || '').replace(/\{\{[^}]+\}\}/g, (match) => {
      phList.push(match);
      return `__PH_${phList.length - 1}__`;
    });
    allPlaceholders[idx] = phList;
    return sanitized;
  });

  const joinedText = sanitizedTexts.join(BATCH_DELIMITER);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${encodeURIComponent(
    targetLang
  )}&dt=t&q=${encodeURIComponent(joinedText)}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      // En cas de rate limiting HTTP 429, temporiser avec backoff exponentiel
      if (response.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Google Translate API HTTP ${response.status}`);
      }

      const json = await response.json();
      if (Array.isArray(json) && Array.isArray(json[0])) {
        const fullTranslation = json[0].map((item: any) => item[0]).join('');
        const splitParts = fullTranslation.split(/\s*\|\|\|\s*/);

        // Si le découpage correspond exactement au nombre de textes attendu
        if (splitParts.length === texts.length) {
          return splitParts.map((raw, idx) => {
            let res = raw.trim();
            const phs = allPlaceholders[idx] || [];
            phs.forEach((ph, pIdx) => {
              res = res.replace(new RegExp(`__PH_${pIdx}__`, 'g'), ph);
            });
            return res || texts[idx];
          });
        }
      }
      break;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  // Fallback si le découpage par lot ne correspond pas : traduction unitaire avec petit délai
  const fallbackResults: string[] = [];
  for (const text of texts) {
    try {
      const single = await translateTextOnline(text, targetLang);
      fallbackResults.push(single);
    } catch {
      fallbackResults.push(text);
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  return fallbackResults;
}

/**
 * Lance le processus complet de traduction pour l'ensemble des clés de l'application
 */
export async function translateAllKeys(
  targetLangCode: string,
  leaves: TranslationLeafNode[],
  onProgress?: (progress: TranslationProgress) => void
): Promise<TranslationResult> {
  const total = leaves.length;

  // 1. Priorité absolue : Dictionnaire pré-traduit embarqué (100% autonome, zéro réseau, insensible aux blocages)
  const pretranslated = getPretranslatedDictionary(targetLangCode);
  if (pretranslated && Object.keys(pretranslated).length > 0) {
    onProgress?.({
      current: Math.round(total * 0.35),
      total,
      percentage: 35,
    });
    await new Promise((r) => setTimeout(r, 80));
    onProgress?.({
      current: Math.round(total * 0.8),
      total,
      percentage: 80,
    });
    await new Promise((r) => setTimeout(r, 80));
    onProgress?.({
      current: total,
      total,
      percentage: 100,
    });

    return {
      success: true,
      translations: pretranslated,
    };
  }

  const translations: Record<string, string> = {};

  // 2. Vérification de la connectivité réseau (si pas de pré-traduction disponible)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      isOffline: true,
      error: "Pas d'accès à Internet. Impossible de contacter le service Google Traduction.",
    };
  }

  // 2. Tester d'abord un texte simple pour s'assurer que l'API Google Traduction est joignable
  try {
    const testTranslation = await translateTextOnline('Bonjour', targetLangCode);
    if (!testTranslation) {
      throw new Error('Réponse vide du service de traduction.');
    }
  } catch (err: any) {
    console.warn('Accès à Google Traduction indisponible:', err);
    return {
      success: false,
      isOffline: !navigator.onLine,
      error: "Impossible d'accéder au service de traduction (Google Traduction indisponible ou restrictions réseau).",
    };
  }

  // 3. Traduction de l'ensemble des clés par lots de 12 à 15 textes regroupés
  // Permet de ne faire que ~15 requêtes au total au lieu de 190 par langue !
  const batchSize = 12;
  for (let i = 0; i < total; i += batchSize) {
    const batch = leaves.slice(i, i + batchSize);
    const sourceTexts = batch.map(
      (leaf) => leaf.defaults['fr'] || leaf.defaults['en'] || leaf.key
    );

    try {
      const translatedBatch = await translateBatchOnline(sourceTexts, targetLangCode);
      batch.forEach((leaf, idx) => {
        translations[leaf.id] = translatedBatch[idx] || sourceTexts[idx];
      });
    } catch {
      // En cas d'erreur ponctuelle sur le lot, conserver le texte source
      batch.forEach((leaf, idx) => {
        translations[leaf.id] = sourceTexts[idx];
      });
    }

    const currentCount = Math.min(i + batch.length, total);
    onProgress?.({
      current: currentCount,
      total,
      percentage: Math.round((currentCount / total) * 100),
      currentKey: batch[batch.length - 1]?.id,
    });

    // Pause de 120ms entre les lots pour respecter les quotas et fluidifier l'animation
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return {
    success: true,
    translations,
  };
}

/**
 * Prépare les traductions par défaut à partir du français (ou anglais)
 * Utilisé en cas d'indisponibilité du service de traduction ou de travail hors-ligne
 */
export function buildFallbackTranslationsFromSource(
  leaves: TranslationLeafNode[]
): Record<string, string> {
  const fallback: Record<string, string> = {};
  for (const leaf of leaves) {
    fallback[leaf.id] = leaf.defaults['fr'] || leaf.defaults['en'] || leaf.key;
  }
  return fallback;
}
