/**
 * Magasin des dictionnaires de traduction pré-générés
 * Permet l'installation instantanée (0 appel réseau, aucun blocage d'IP ni rate limiting).
 */

// Chargement automatique eager de tous les dictionnaires JSON pré-traduits du dossier
const pretranslatedModules = import.meta.glob<Record<string, string>>(
  '../i18n/pretranslated/*.json',
  { eager: true, import: 'default' }
);

/**
 * Récupère le dictionnaire pré-traduit pour un code de langue donné si disponible
 */
export function getPretranslatedDictionary(langCode: string): Record<string, string> | null {
  if (!langCode) return null;
  const normalized = langCode.toLowerCase().replace('_', '-');

  // Recherche parmi les fichiers chargés
  for (const [filePath, content] of Object.entries(pretranslatedModules)) {
    const filename = filePath.split('/').pop()?.replace('.json', '').toLowerCase();
    if (
      filename === normalized ||
      filename === normalized.replace('-', '_') ||
      filename === normalized.split('-')[0]
    ) {
      if (content && typeof content === 'object' && Object.keys(content).length > 0) {
        return content;
      }
    }
  }

  return null;
}

/**
 * Indique si une langue dispose d'un dictionnaire pré-traduit prêt à l'emploi
 */
export function hasPretranslatedDictionary(langCode: string): boolean {
  return getPretranslatedDictionary(langCode) !== null;
}
