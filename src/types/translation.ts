export interface TranslationLeafNode {
  type: 'leaf';
  id: string; // Full dot path, e.g. "projects.columns.roi"
  key: string; // Last segment, e.g. "roi"
  parentKey: string; // Parent path, e.g. "projects.columns"
  depth: number;
  defaults: Record<string, string>; // { fr: "...", en: "...", it: "...", de: "..." }
}

export interface TranslationSectionNode {
  type: 'section';
  id: string; // Section dot path, e.g. "projects.columns"
  key: string; // Last segment, e.g. "columns"
  parentKey: string;
  depth: number;
  children: (TranslationSectionNode | TranslationLeafNode)[];
  totalLeaves: number;
}

export type TranslationTreeNode = TranslationSectionNode | TranslationLeafNode;

export type TranslationOverridesMap = Record<string, Record<string, string>>; // lang -> { [key]: value }

export interface ZoomModalState {
  isOpen: boolean;
  leaf: TranslationLeafNode | null;
  langCode: string;
  langLabel: string;
  currentValue: string;
  defaultValue: string;
}
