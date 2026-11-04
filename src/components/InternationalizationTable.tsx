import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  X,
  Save,
  RotateCcw,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';
import { LanguageFlag } from './Flags';
import {
  TranslationOverridesMap,
  TranslationTreeNode,
  TranslationSectionNode,
  TranslationLeafNode,
  ZoomModalState,
} from '../types/translation';
import { buildTranslationTree } from '../utils/translationTree';
import {
  subscribeToTranslationOverrides,
  saveTranslationOverrides,
  getCachedTranslationOverrides,
} from '../services/translationService';
import {
  getSaveButtonStateClass,
  PRIMARY_ACTION_MODAL_BUTTON_CLASS,
  MODAL_CANCEL_BUTTON_CLASS,
  TAB_TITLE_CLASS,
  TABLE_FROZEN_DIVIDER_CLASS,
  TABLE_HEADER_DOUBLE_BOTTOM_CLASS,
} from '../constants/ui';
import { Tooltip } from './Tooltip';

const STORAGE_KEY_EXPANDED = 'opac_i18n_expanded_sections';

interface InternationalizationTableProps {
  isAdmin: boolean;
  currentUserEmail?: string;
}

export const InternationalizationTable: React.FC<InternationalizationTableProps> = ({
  isAdmin,
  currentUserEmail = '',
}) => {
  const { t } = useTranslation();

  // Arbre des traductions de base
  const { rootSections, allLeaves, leafCount } = useMemo(() => buildTranslationTree(), []);

  // Surcharges sauvegardées dans Firestore
  const [savedOverrides, setSavedOverrides] = useState<TranslationOverridesMap>(() =>
    getCachedTranslationOverrides()
  );

  // Modifications en cours d'édition (non encore enregistrées)
  const [editedOverrides, setEditedOverrides] = useState<TranslationOverridesMap>(() =>
    getCachedTranslationOverrides()
  );

  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchedLeafIds, setMatchedLeafIds] = useState<Set<string> | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // État de dépliage des sections (mémorisé dans localStorage)
  // Par défaut à l'ouverture initiale : TOUTES les sections sont fermées (Set vide)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXPANDED);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          return new Set<string>(arr);
        }
      }
    } catch {
      // fallback
    }
    return new Set<string>();
  });

  // Sauvegarde de l'état de dépliage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(Array.from(expandedSections)));
    } catch {
      // ignore
    }
  }, [expandedSections]);

  // Synchronisation en temps réel avec Firestore
  useEffect(() => {
    const unsub = subscribeToTranslationOverrides((data) => {
      setSavedOverrides(data);
      // Ne pas écraser les éditions locales en cours s'il y en a, sinon synchroniser
      setEditedOverrides((current) => {
        const hasPendingChanges = Object.keys(current).some((lang) => {
          const langMap = current[lang] || {};
          const savedLangMap = data[lang] || {};
          return Object.keys(langMap).some((k) => langMap[k] !== savedLangMap[k]);
        });
        return hasPendingChanges ? current : data;
      });
    });
    return () => unsub();
  }, []);

  // Modal zoom pour édition confortable d'un texte long
  const [zoomModal, setZoomModal] = useState<ZoomModalState>({
    isOpen: false,
    leaf: null,
    langCode: 'fr',
    langLabel: 'Français',
    currentValue: '',
    defaultValue: '',
  });

  const zoomTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus automatique lors de l'ouverture du modal zoom
  useEffect(() => {
    if (zoomModal.isOpen) {
      setTimeout(() => {
        zoomTextareaRef.current?.focus();
      }, 50);
    }
  }, [zoomModal.isOpen]);

  // Basculer l'état déplié/plié d'une section unitairement
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Pictogramme pour tout replier en une seule opération
  const handleCollapseAll = () => {
    setExpandedSections(new Set<string>());
  };

  // Pictogramme pour tout déplier
  const handleExpandAll = () => {
    const allSectionIds = new Set<string>();
    function collect(nodes: (TranslationSectionNode | TranslationLeafNode)[]) {
      for (const n of nodes) {
        if (n.type === 'section') {
          allSectionIds.add(n.id);
          collect(n.children);
        }
      }
    }
    collect(rootSections);
    setExpandedSections(allSectionIds);
  };

  // Récupérer la valeur actuelle d'une feuille pour une langue donnée
  const getLeafValue = (leaf: TranslationLeafNode, langCode: string): string => {
    if (editedOverrides[langCode]?.[leaf.id] !== undefined) {
      return editedOverrides[langCode][leaf.id];
    }
    if (savedOverrides[langCode]?.[leaf.id] !== undefined) {
      return savedOverrides[langCode][leaf.id];
    }
    return leaf.defaults[langCode] || '';
  };

  // Vérifier si une cellule a des modifications non enregistrées par rapport aux données sauvegardées
  const isCellDirty = (leaf: TranslationLeafNode, langCode: string): boolean => {
    const editedVal = editedOverrides[langCode]?.[leaf.id];
    if (editedVal === undefined) return false;
    const savedVal = savedOverrides[langCode]?.[leaf.id] ?? leaf.defaults[langCode] ?? '';
    return editedVal !== savedVal;
  };

  // Gestionnaire de saisie directe dans la cellule
  const handleCellChange = (leafId: string, langCode: string, newValue: string) => {
    setEditedOverrides((prev) => {
      const currentLangMap = prev[langCode] || {};
      return {
        ...prev,
        [langCode]: {
          ...currentLangMap,
          [leafId]: newValue,
        },
      };
    });
  };

  // Ouvrir le modal zoom lors d'un double-clic sur la cellule
  const handleOpenZoomModal = (leaf: TranslationLeafNode, langCode: string) => {
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    setZoomModal({
      isOpen: true,
      leaf,
      langCode,
      langLabel: langObj?.label || langCode.toUpperCase(),
      currentValue: getLeafValue(leaf, langCode),
      defaultValue: leaf.defaults[langCode] || '',
    });
  };

  // Valider les modifications du modal zoom
  const handleApplyZoomModal = () => {
    if (zoomModal.leaf) {
      handleCellChange(zoomModal.leaf.id, zoomModal.langCode, zoomModal.currentValue);
    }
    setZoomModal((prev) => ({ ...prev, isOpen: false, leaf: null }));
  };

  // Rétablir la valeur par défaut dans le modal zoom
  const handleResetToDefaultInZoom = () => {
    setZoomModal((prev) => ({
      ...prev,
      currentValue: prev.defaultValue,
    }));
  };

  // Calcul du nombre de modifications non enregistrées
  const { unsavedCount, hasUnsavedChanges } = useMemo(() => {
    let count = 0;
    for (const lang of SUPPORTED_LANGUAGES) {
      const editedMap = editedOverrides[lang.code] || {};
      const savedMap = savedOverrides[lang.code] || {};
      const allKeys = new Set([...Object.keys(editedMap), ...Object.keys(savedMap)]);
      for (const k of allKeys) {
        const editedVal = editedMap[k];
        const savedVal = savedMap[k];
        if (editedVal !== savedVal && (editedVal !== undefined || savedVal !== undefined)) {
          count++;
        }
      }
    }
    return {
      unsavedCount: count,
      hasUnsavedChanges: count > 0,
    };
  }, [editedOverrides, savedOverrides]);

  // Annuler toutes les modifications locales
  const handleRevertChanges = () => {
    setEditedOverrides(savedOverrides);
  };

  // Enregistrer les modifications dans Firestore
  const handleSave = async () => {
    if (!isAdmin || !hasUnsavedChanges || isSaving) return;
    try {
      setIsSaving(true);
      await saveTranslationOverrides(editedOverrides, currentUserEmail);
      setSavedOverrides(editedOverrides);
    } catch (err: any) {
      console.error('Erreur sauvegarde traductions:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Copier la clé dans le presse-papier
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Exécution de la recherche (au clic sur la loupe ou appui sur Entrée)
  const handleExecuteSearch = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setMatchedLeafIds(null);
      return;
    }

    const matches = new Set<string>();
    for (const leaf of allLeaves) {
      const matchKey = leaf.id.toLowerCase().includes(q);
      let matchValue = false;
      for (const lang of SUPPORTED_LANGUAGES) {
        const val = getLeafValue(leaf, lang.code).toLowerCase();
        if (val.includes(q)) {
          matchValue = true;
          break;
        }
      }

      if (matchKey || matchValue) {
        matches.add(leaf.id);
      }
    }
    setMatchedLeafIds(matches);
  };

  // Réinitialisation de la recherche (au clic sur la croix)
  const handleResetSearch = () => {
    setSearchQuery('');
    setMatchedLeafIds(null);
  };

  // Si recherche active, les sections ancêtres des résultats sont auto-dépliées
  const activeExpandedSections = useMemo(() => {
    if (!matchedLeafIds) return expandedSections;
    const autoExpanded = new Set<string>(expandedSections);
    for (const leafId of matchedLeafIds) {
      const parts = leafId.split('.');
      let prefix = '';
      for (let i = 0; i < parts.length - 1; i++) {
        prefix = prefix ? `${prefix}.${parts[i]}` : parts[i];
        autoExpanded.add(prefix);
      }
    }
    return autoExpanded;
  }, [expandedSections, matchedLeafIds]);

  // Fonction récursive de rendu de l'arbre
  const renderTreeNodes = (
    nodes: (TranslationSectionNode | TranslationLeafNode)[]
  ): React.ReactNode => {
    return nodes.map((node) => {
      if (node.type === 'section') {
        const isExpanded = activeExpandedSections.has(node.id);

        // Si recherche active et aucun enfant ne correspond, masquer la section
        if (matchedLeafIds) {
          const hasMatchingDescendant = Array.from(matchedLeafIds).some((id) =>
            id.startsWith(`${node.id}.`)
          );
          if (!hasMatchingDescendant) return null;
        }

        return (
          <React.Fragment key={`section-${node.id}`}>
            {/* Ligne d'en-tête de section (gris plus clair que la ligne d'en-tête bg-slate-100) */}
            <tr
              onClick={() => toggleSection(node.id)}
              className="group cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/70 transition-colors border-y border-slate-200/60"
            >
              {/* Colonne 1 figée à gauche avec double filet vertical */}
              <td
                className={`sticky left-0 z-10 bg-slate-50/95 group-hover:bg-slate-100/90 py-2 px-3 transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${TABLE_FROZEN_DIVIDER_CLASS}`}
                style={{ paddingLeft: `${node.depth * 20 + 12}px` }}
              >
                <div className="flex items-center gap-2">
                  <span className="p-0.5 rounded hover:bg-slate-200/80 text-slate-700 transition-colors shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-800" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    )}
                  </span>
                  <span className="font-bold text-xs text-slate-900 font-mono tracking-tight">
                    {node.key}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-slate-200/80 text-slate-700 border border-slate-300/80">
                    {node.totalLeaves}{' '}
                    {node.totalLeaves > 1
                      ? t('settings.internationalization.key_other', 'clés')
                      : t('settings.internationalization.key_one', 'clé')}
                  </span>
                </div>
              </td>

              {/* Reste des colonnes avec séparateurs verticaux visibles */}
              {SUPPORTED_LANGUAGES.map((lang, idx) => (
                <td
                  key={lang.code}
                  className="py-2 px-3 text-xs text-slate-500 italic border-r border-slate-200/60"
                >
                  {idx === 0 && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {node.id}
                    </span>
                  )}
                </td>
              ))}
            </tr>

            {/* Enfants dépliés */}
            {isExpanded && renderTreeNodes(node.children)}
          </React.Fragment>
        );
      }

      // Nœud feuille (ligne d'une clé de traduction)
      const leaf = node as TranslationLeafNode;

      // Si recherche active et la feuille ne correspond pas, masquer
      if (matchedLeafIds && !matchedLeafIds.has(leaf.id)) {
        return null;
      }

      return (
        <tr
          key={`leaf-${leaf.id}`}
          className="group hover:bg-slate-50/80 transition-colors border-b border-slate-100"
        >
          {/* Colonne 1 : Clé (figée à gauche, non modifiable avec double filet vertical) */}
          <td
            className={`sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 py-2 px-3 align-top transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] w-[320px] min-w-[320px] max-w-[320px] ${TABLE_FROZEN_DIVIDER_CLASS}`}
            style={{ paddingLeft: `${leaf.depth * 20 + 16}px` }}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs text-slate-800 font-mono break-all">
                  {leaf.key}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyKey(leaf.id);
                  }}
                  title={t('settings.internationalization.copy_key_tooltip', 'Copier la clé complète')}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors shrink-0 cursor-pointer"
                >
                  {copiedKey === leaf.id ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-mono break-all leading-tight select-all">
                {leaf.id}
              </span>
            </div>
          </td>

          {/* Colonnes par langue : modifiables en direct, double-clic pour zoom */}
          {SUPPORTED_LANGUAGES.map((lang) => {
            const currentVal = getLeafValue(leaf, lang.code);
            const isModified = isCellDirty(leaf, lang.code);

            return (
              <td
                key={`${leaf.id}-${lang.code}`}
                onDoubleClick={() => isAdmin && handleOpenZoomModal(leaf, lang.code)}
                className="py-1.5 px-2 border-r border-slate-200 align-top w-[300px] min-w-[280px] max-w-[380px] relative group/cell"
              >
                <div className="relative">
                  <textarea
                    rows={2}
                    disabled={!isAdmin}
                    value={currentVal}
                    onChange={(e) => handleCellChange(leaf.id, lang.code, e.target.value)}
                    title={
                      isAdmin
                        ? 'Saisie directe (Double-clic pour ouvrir la fenêtre d’édition agrandie)'
                        : 'Consultation seule (modification réservée à l’administrateur)'
                    }
                    placeholder={`[${lang.label}] Non traduit`}
                    className={`w-full text-xs p-2 rounded-lg border resize-none h-[48px] overflow-y-auto leading-relaxed transition-all focus:outline-none [scrollbar-width:thin] ${
                      !isAdmin
                        ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed'
                        : isModified
                        ? 'bg-amber-50/30 text-amber-950 font-medium border-amber-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037]'
                    }`}
                  />

                  {/* Bouton loupe / zoom au survol pour ouvrir la mini-fenêtre */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenZoomModal(leaf, lang.code);
                      }}
                      title="Agrandir pour modifier confortablement (ou double-cliquer)"
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/90 border border-slate-200 shadow-2xs text-slate-400 hover:text-slate-800 hover:bg-slate-100 opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer z-10"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  )}

                  {/* Pastille indiquant une valeur personnalisée */}
                  {isModified && (
                    <span
                      title="Texte personnalisé"
                      className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 shadow-xs pointer-events-none"
                    />
                  )}
                </div>
              </td>
            );
          })}
        </tr>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-12.5rem)] min-h-[520px] bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Barre d'outils supérieure */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 z-20">
        <div>
          <h2 className={`${TAB_TITLE_CLASS} text-[#4e342e] flex items-center gap-2`}>
            <Globe className="w-5 h-5 text-[#5d4037] shrink-0" />
            <span>{t('settings.internationalization.title', 'Internationalisation & Traductions')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            {t(
              'settings.internationalization.subtitle',
              'Personnalisez les textes de l’interface dans les différentes langues. Vos modifications s’appliquent en temps réel à l’ensemble des utilisateurs.'
            )}
          </p>
        </div>

        {/* Commandes et recherche */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Recherche */}
          <div className="flex items-center gap-1.5">
            <div className="relative min-w-[220px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteSearch();
                  }
                }}
                placeholder={t('settings.internationalization.search_placeholder', 'Rechercher une clé ou un texte...')}
                className="w-full px-3 py-1.5 pr-8 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5d4037] shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleResetSearch}
                  title="Réinitialiser"
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Pictogramme de la loupe à droite de la zone de saisie avec bulle d'information */}
            <Tooltip
              title="Recherche"
              content="Saisir la chaîne de caractères recherchée puis cliquer sur la loupe. Cliquer à nouveau pour relancer la recherche. Réinitialiser  en cliquant sur la croix."
            >
              <button
                type="button"
                onClick={handleExecuteSearch}
                aria-label="Lancer la recherche"
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                <Search className="w-4 h-4 text-slate-600" />
              </button>
            </Tooltip>
          </div>

          {/* Pictogramme Tout replier */}
          <button
            type="button"
            onClick={handleCollapseAll}
            title={t('settings.internationalization.collapse_all', 'Tout replier en une seule opération')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <ChevronsDownUp className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">{t('settings.internationalization.collapse_all', 'Tout replier')}</span>
          </button>

          {/* Pictogramme Tout déplier */}
          <button
            type="button"
            onClick={handleExpandAll}
            title={t('settings.internationalization.expand_all', 'Tout déplier')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <ChevronsUpDown className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">{t('settings.internationalization.expand_all', 'Tout déplier')}</span>
          </button>

          {/* Badge total des clés */}
          <span className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold shrink-0">
            {leafCount}{' '}
            {leafCount > 1
              ? t('settings.internationalization.key_other', 'clés')
              : t('settings.internationalization.key_one', 'clé')}
          </span>
        </div>
      </div>

      {/* Zone du tableau scrollable avec ascenseurs vertical et horizontal */}
      <div className="flex-1 min-h-0 overflow-auto [scrollbar-width:thin]">
        <table className="w-full border-collapse text-left min-w-[1200px]">
          {/* En-tête du tableau figée en haut */}
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
            <tr>
              {/* Colonne 1 : Clé (figée à gauche avec double filet vertical et double filet horizontal) */}
              <th
                scope="col"
                className={`sticky left-0 z-30 bg-slate-100 py-3 px-3 text-xs font-bold text-slate-800 uppercase tracking-wider w-[320px] min-w-[320px] max-w-[320px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${TABLE_FROZEN_DIVIDER_CLASS} ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS}`}
              >
                <span>{t('settings.internationalization.col_key', 'Clé de traduction')}</span>
              </th>

              {/* Colonnes langues avec Drapeau + Nom et double filet horizontal */}
              {SUPPORTED_LANGUAGES.map((lang) => (
                <th
                  key={lang.code}
                  scope="col"
                  className={`py-3 px-3 text-xs font-bold text-slate-800 border-r border-slate-200 w-[300px] min-w-[280px] max-w-[380px] ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS}`}
                >
                  <div className="flex items-center gap-2">
                    <LanguageFlag code={lang.code} className="w-5 h-3.5 shadow-2xs" />
                    <span>{lang.label}</span>
                    <span className="text-[10px] font-bold font-mono text-slate-400">
                      ({lang.abbr})
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Corps de l'arbre */}
          <tbody className="divide-y divide-slate-100 text-xs">
            {renderTreeNodes(rootSections)}
          </tbody>
        </table>
      </div>

      {/* Bandeau inférieur toujours visible */}
      <div className="p-3.5 bg-slate-100 border-t border-slate-200 shrink-0 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          {hasUnsavedChanges ? (
            <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {unsavedCount}{' '}
                {unsavedCount > 1
                  ? t('settings.internationalization.unsaved_changes_other', 'modifications non enregistrées')
                  : t('settings.internationalization.unsaved_changes_one', 'modification non enregistrée')}
              </span>
            </span>
          ) : (
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('settings.internationalization.all_saved', 'Toutes les traductions sont à jour')}</span>
            </span>
          )}

          <span className="hidden md:inline text-[11px] text-slate-400 italic">
            • {t('settings.internationalization.double_click_hint', 'Double-cliquez sur une cellule pour agrandir et éditer')}
          </span>
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center gap-2 shrink-0">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleRevertChanges}
              disabled={isSaving}
              className={`${MODAL_CANCEL_BUTTON_CLASS} inline-flex items-center gap-1.5`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('settings.internationalization.cancel_button', 'Annuler')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving || !isAdmin}
            className={`px-4 py-2 text-xs font-semibold inline-flex items-center gap-2 ${getSaveButtonStateClass(
              hasUnsavedChanges && isAdmin,
              isSaving
            )}`}
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? t('settings.internationalization.saving', 'Enregistrement...')
                : t('settings.internationalization.save_button', 'Enregistrer les modifications')}
            </span>
          </button>
        </div>
      </div>

      {/* Mini fenêtre modale d'édition agrandie (au double-clic) */}
      {zoomModal.isOpen && zoomModal.leaf && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* En-tête */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/10 text-white">
                  <LanguageFlag code={zoomModal.langCode} className="w-6 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>{t('settings.internationalization.zoom_modal.title', 'Modification de la traduction')}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-slate-200 font-normal">
                      {zoomModal.langLabel}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5 break-all">
                    {zoomModal.leaf.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setZoomModal((prev) => ({ ...prev, isOpen: false, leaf: null }))}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corps */}
            <div className="p-5 space-y-4">
              {/* Texte par défaut d'origine pour comparaison */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('settings.internationalization.zoom_modal.original_text', 'Texte par défaut d’origine :')}
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-mono max-h-24 overflow-y-auto leading-relaxed select-all">
                  {zoomModal.defaultValue || <span className="italic text-slate-400">(Aucun texte par défaut)</span>}
                </div>
              </div>

              {/* Champ de saisie agrandi */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Votre traduction personnalisée :
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {zoomModal.currentValue.length} caractères
                  </span>
                </div>
                <textarea
                  ref={zoomTextareaRef}
                  rows={6}
                  value={zoomModal.currentValue}
                  onChange={(e) =>
                    setZoomModal((prev) => ({
                      ...prev,
                      currentValue: e.target.value,
                    }))
                  }
                  placeholder="Saisissez la traduction..."
                  className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 leading-relaxed font-normal text-slate-900 shadow-inner"
                />
              </div>
            </div>

            {/* Pied de page du modal zoom */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleResetToDefaultInZoom}
                className="text-xs text-slate-600 hover:text-slate-900 font-semibold underline cursor-pointer"
              >
                {t('settings.internationalization.zoom_modal.restore_default', 'Rétablir la valeur par défaut')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomModal((prev) => ({ ...prev, isOpen: false, leaf: null }))}
                  className={MODAL_CANCEL_BUTTON_CLASS}
                >
                  {t('settings.internationalization.zoom_modal.cancel', 'Annuler')}
                </button>
                <button
                  type="button"
                  onClick={handleApplyZoomModal}
                  className={PRIMARY_ACTION_MODAL_BUTTON_CLASS}
                >
                  {t('settings.internationalization.zoom_modal.apply', 'Valider')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
