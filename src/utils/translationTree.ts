import { fr } from '../i18n/locales/fr';
import { en } from '../i18n/locales/en';
import { it } from '../i18n/locales/it';
import { de } from '../i18n/locales/de';
import { TranslationTreeNode, TranslationSectionNode, TranslationLeafNode } from '../types/translation';

const LOCALES: Record<string, Record<string, any>> = {
  fr,
  en,
  it,
  de,
};

export function getValueByPath(obj: any, path: string): string {
  if (!obj || !path) return '';
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return '';
    }
    curr = curr[part];
  }
  return typeof curr === 'string' ? curr : '';
}

/**
 * Construit l'arbre complet des traductions de l'application
 * sous forme de sections hiérarchiques et de feuilles de traduction.
 */
export function buildTranslationTree(): {
  rootSections: TranslationSectionNode[];
  allLeaves: TranslationLeafNode[];
  leafCount: number;
} {
  const allLeaves: TranslationLeafNode[] = [];

  function buildSubtree(
    sourceObj: Record<string, any>,
    currentPath = '',
    depth = 0
  ): (TranslationSectionNode | TranslationLeafNode)[] {
    const nodes: (TranslationSectionNode | TranslationLeafNode)[] = [];
    const keys = Object.keys(sourceObj || {});

    for (const key of keys) {
      const fullPath = currentPath ? `${currentPath}.${key}` : key;
      const val = sourceObj[key];

      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        // C'est une section (objet imbriqué)
        const children = buildSubtree(val, fullPath, depth + 1);
        const totalLeaves = children.reduce((sum, c) => {
          return sum + (c.type === 'section' ? c.totalLeaves : 1);
        }, 0);

        if (children.length > 0) {
          nodes.push({
            type: 'section',
            id: fullPath,
            key,
            parentKey: currentPath,
            depth,
            children,
            totalLeaves,
          });
        }
      } else {
        // C'est une feuille (libellé)
        const defaults: Record<string, string> = {
          fr: getValueByPath(LOCALES.fr, fullPath),
          en: getValueByPath(LOCALES.en, fullPath),
          it: getValueByPath(LOCALES.it, fullPath),
          de: getValueByPath(LOCALES.de, fullPath),
        };

        const leaf: TranslationLeafNode = {
          type: 'leaf',
          id: fullPath,
          key,
          parentKey: currentPath,
          depth,
          defaults,
        };

        nodes.push(leaf);
        allLeaves.push(leaf);
      }
    }

    return nodes;
  }

  // Racine de l'arbre basée sur le fichier source français (qui contient l'intégralité du modèle)
  const treeNodes = buildSubtree(fr, '', 0);

  // Filtrer pour ne conserver que les sections à la racine
  const rootSections: TranslationSectionNode[] = [];
  for (const node of treeNodes) {
    if (node.type === 'section') {
      rootSections.push(node);
    } else {
      // Cas rare d'une feuille isolée à la racine : la placer dans une section "général"
      const defaultRoot = rootSections.find((s) => s.id === 'general');
      if (defaultRoot) {
        defaultRoot.children.push(node);
        defaultRoot.totalLeaves += 1;
      } else {
        rootSections.push({
          type: 'section',
          id: 'general',
          key: 'general',
          parentKey: '',
          depth: 0,
          children: [node],
          totalLeaves: 1,
        });
      }
    }
  }

  return {
    rootSections,
    allLeaves,
    leafCount: allLeaves.length,
  };
}
