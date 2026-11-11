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
  Plus,
  Trash2,
  Languages,
  Loader2,
} from 'lucide-react';
import {
  getActiveLanguageItems,
  getSavedActiveLanguageCodes,
  getLocalizedLanguageName,
  LanguageItem,
  LANGUAGES_CHANGED_EVENT,
} from '../i18n';
import { LanguageFlag } from './Flags';
import {
  TranslationOverridesMap,
  TranslationTreeNode,
  TranslationSectionNode,
  TranslationLeafNode,
  ZoomModalState,
  ZoomModalRow,
} from '../types/translation';
import { buildTranslationTree } from '../utils/translationTree';
import {
  subscribeToTranslationOverrides,
  saveTranslationOverrides,
  getCachedTranslationOverrides,
  deleteLanguageFromApp,
  addLanguageToApp,
  addMultipleLanguagesToApp,
} from '../services/translationService';
import {
  translateAllKeys,
  translateTextOnline,
  buildFallbackTranslationsFromSource,
  TranslationProgress,
} from '../services/autoTranslateService';
import { AddLanguageModal } from './AddLanguageModal';
import {
  TranslationProgressModal,
  TranslationModalStatus,
  LanguageProgressItem,
} from './TranslationProgressModal';
import { DeleteLanguageConfirmModal } from './DeleteLanguageConfirmModal';
import { SearchFilterInput } from './SearchFilterInput';
import {
  getSaveButtonStateClass,
  CREATE_ITEM_BUTTON_CLASS,
  PRIMARY_ACTION_BLUE_TEXT,
  PRIMARY_ACTION_MODAL_BUTTON_CLASS,
  MODAL_CANCEL_BUTTON_CLASS,
  MODAL_TITLE_CLASS,
  TAB_TITLE_CLASS,
  TABLE_FROZEN_DIVIDER_CLASS,
  TABLE_HEADER_DOUBLE_BOTTOM_CLASS,
  TABLE_HEADER_TEXT_CLASS,
  TABLE_TH_BASE_CLASS,
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

  // Codes des langues actives (persistance locale et Firestore)
  const [activeLanguageCodes, setActiveLanguageCodes] = useState<string[]>(() =>
    getSavedActiveLanguageCodes()
  );

  const activeLanguages: LanguageItem[] = useMemo(() => {
    return getActiveLanguageItems(activeLanguageCodes);
  }, [activeLanguageCodes]);

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

  // Modales d'ajout, traduction et suppression de langues (support multi-langues)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetLanguagesForAdd, setTargetLanguagesForAdd] = useState<LanguageItem[]>([]);
  const [translationProgressItems, setTranslationProgressItems] = useState<LanguageProgressItem[]>([]);
  const [isTranslatingModalOpen, setIsTranslatingModalOpen] = useState(false);
  const [translatingStatus, setTranslatingStatus] = useState<TranslationModalStatus>('translating');
  const [translationError, setTranslationError] = useState<string | null>(null);

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    language: LanguageItem | null;
  }>({
    isOpen: false,
    language: null,
  });

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

  // Synchronisation en temps réel avec Firestore (overrides + langues actives)
  useEffect(() => {
    const unsub = subscribeToTranslationOverrides((data, remoteLanguages) => {
      setSavedOverrides(data);
      if (remoteLanguages && remoteLanguages.length > 0) {
        setActiveLanguageCodes(remoteLanguages);
      }
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

    const handleLanguagesEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setActiveLanguageCodes(customEvent.detail);
      }
    };
    window.addEventListener(LANGUAGES_CHANGED_EVENT, handleLanguagesEvent);

    return () => {
      unsub();
      window.removeEventListener(LANGUAGES_CHANGED_EVENT, handleLanguagesEvent);
    };
  }, []);

  // Modal zoom pour édition confortable d'un libellé
  const [zoomModal, setZoomModal] = useState<ZoomModalState>({
    isOpen: false,
    leaf: null,
    langCode: 'fr',
    langLabel: 'Français',
    rows: [],
  });

  const [translatingRowCodes, setTranslatingRowCodes] = useState<Set<string>>(new Set());
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [zoomTranslateError, setZoomTranslateError] = useState<string | null>(null);
  const primaryTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modalScrollContainerRef = useRef<HTMLDivElement>(null);
  const [modalScrollbarWidth, setModalScrollbarWidth] = useState(0);

  // Synchronisation de la largeur de l'ascenseur pour un alignement au pixel près des colonnes d'en-tête et de données
  useEffect(() => {
    if (!zoomModal.isOpen) return;

    const updateScrollbar = () => {
      const el = modalScrollContainerRef.current;
      if (!el) return;
      const sw = el.offsetWidth - el.clientWidth;
      setModalScrollbarWidth(sw > 0 ? sw : 0);
    };

    updateScrollbar();
    const rafId = requestAnimationFrame(updateScrollbar);

    const el = modalScrollContainerRef.current;
    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateScrollbar);
      ro.observe(el);
    }

    window.addEventListener('resize', updateScrollbar);

    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateScrollbar);
    };
  }, [zoomModal.isOpen, zoomModal.rows.length]);

  // Focus automatique lors de l'ouverture du modal zoom sur la première ligne (langue modifiée)
  useEffect(() => {
    if (zoomModal.isOpen) {
      setTimeout(() => {
        primaryTextareaRef.current?.focus();
        primaryTextareaRef.current?.select();
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
    const collectIds = (nodes: TranslationTreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'section') {
          allSectionIds.add(n.id);
          collectIds(n.children);
        }
      }
    };
    collectIds(rootSections);
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
    return leaf.defaults[langCode] || leaf.defaults['fr'] || '';
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

  // Ouvrir le modal zoom lors d'un clic ou double-clic sur la cellule
  const handleOpenZoomModal = (leaf: TranslationLeafNode, langCode: string) => {
    const primaryItem = activeLanguages.find((l) => l.code === langCode) || {
      code: langCode,
      label: langCode.toUpperCase(),
      nativeLabel: langCode.toUpperCase(),
      flag: '🌐',
      abbr: langCode.slice(0, 2).toUpperCase(),
    };

    // Langue sélectionnée placée en première ligne, suivie des autres langues actives
    const otherLangs = activeLanguages.filter((l) => l.code !== langCode);
    const orderedLangs = [primaryItem, ...otherLangs];

    const rows: ZoomModalRow[] = orderedLangs.map((lang) => {
      const currentVal = getLeafValue(leaf, lang.code);
      return {
        langCode: lang.code,
        currentValue: currentVal,
        correctedValue: currentVal,
        defaultValue: leaf.defaults[lang.code] || leaf.defaults['fr'] || '',
      };
    });

    setZoomModal({
      isOpen: true,
      leaf,
      langCode,
      langLabel: primaryItem.nativeLabel || primaryItem.label,
      rows,
    });
    setTranslatingRowCodes(new Set());
    setIsTranslatingAll(false);
    setZoomTranslateError(null);
  };

  // Mettre à jour la valeur corrigée pour une langue donnée dans le modal
  const handleZoomRowChange = (langCode: string, newValue: string) => {
    setZoomModal((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.langCode === langCode ? { ...r, correctedValue: newValue } : r
      ),
    }));
  };

  // Reporter la traduction vers une langue spécifique
  const handleTranslateRow = async (targetLangCode: string) => {
    if (!zoomModal.leaf || zoomModal.rows.length === 0) return;
    const sourceRow = zoomModal.rows[0];
    const sourceText = sourceRow.correctedValue.trim();
    if (!sourceText) return;

    setZoomTranslateError(null);
    setTranslatingRowCodes((prev) => new Set(prev).add(targetLangCode));

    try {
      const translated = await translateTextOnline(sourceText, targetLangCode, sourceRow.langCode);
      setZoomModal((prev) => ({
        ...prev,
        rows: prev.rows.map((r) =>
          r.langCode === targetLangCode ? { ...r, correctedValue: translated } : r
        ),
      }));
    } catch (err: any) {
      console.warn(`Translation to ${targetLangCode} failed:`, err);
      setZoomTranslateError(
        t('settings.internationalization.zoom_modal.translate_error', 'Échec ponctuel de la traduction automatique.')
      );
    } finally {
      setTranslatingRowCodes((prev) => {
        const next = new Set(prev);
        next.delete(targetLangCode);
        return next;
      });
    }
  };

  // Reporter la traduction en une seule opération vers toutes les autres langues actives
  const handleTranslateAllRows = async () => {
    if (!zoomModal.leaf || zoomModal.rows.length <= 1) return;
    const sourceRow = zoomModal.rows[0];
    const sourceText = sourceRow.correctedValue.trim();
    if (!sourceText) return;

    setZoomTranslateError(null);
    setIsTranslatingAll(true);

    const otherTargetCodes = zoomModal.rows.slice(1).map((r) => r.langCode);
    setTranslatingRowCodes(new Set(otherTargetCodes));

    for (const code of otherTargetCodes) {
      try {
        const translated = await translateTextOnline(sourceText, code, sourceRow.langCode);
        setZoomModal((prev) => ({
          ...prev,
          rows: prev.rows.map((r) =>
            r.langCode === code ? { ...r, correctedValue: translated } : r
          ),
        }));
      } catch (err) {
        console.warn(`Translation to ${code} failed:`, err);
      } finally {
        setTranslatingRowCodes((prev) => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    setIsTranslatingAll(false);
  };

  // Valider les modifications du modal zoom pour toutes les langues modifiées
  const handleApplyZoomModal = () => {
    if (zoomModal.leaf) {
      const leafId = zoomModal.leaf.id;
      zoomModal.rows.forEach((row) => {
        if (row.correctedValue !== row.currentValue) {
          handleCellChange(leafId, row.langCode, row.correctedValue);
        }
      });
    }
    setZoomModal((prev) => ({ ...prev, isOpen: false, leaf: null, rows: [] }));
  };

  // Rétablir les valeurs par défaut dans le modal zoom
  const handleResetToDefaultInZoom = () => {
    setZoomModal((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => ({
        ...r,
        correctedValue: r.defaultValue,
      })),
    }));
  };

  // Calcul du nombre de modifications non enregistrées
  const { unsavedCount, hasUnsavedChanges } = useMemo(() => {
    let count = 0;
    for (const lang of activeLanguages) {
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
  }, [editedOverrides, savedOverrides, activeLanguages]);

  // Annuler toutes les modifications locales
  const handleRevertChanges = () => {
    setEditedOverrides(savedOverrides);
  };

  // Enregistrer les modifications dans Firestore
  const handleSave = async () => {
    if (!isAdmin || !hasUnsavedChanges || isSaving) return;
    try {
      setIsSaving(true);
      await saveTranslationOverrides(editedOverrides, currentUserEmail, activeLanguageCodes);
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
      for (const lang of activeLanguages) {
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
      let acc = '';
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}.${parts[i]}` : parts[i];
        autoExpanded.add(acc);
      }
    }
    return autoExpanded;
  }, [expandedSections, matchedLeafIds]);

  // --- Gestion de l'ajout d'une ou plusieurs nouvelles langues ---
  const handleSelectLanguagesToAdd = async (targetLangs: LanguageItem[]) => {
    if (!targetLangs || targetLangs.length === 0) return;
    setIsAddModalOpen(false);
    setTargetLanguagesForAdd(targetLangs);

    // Initialiser les éléments en préservant le statut de ceux déjà réussis (en cas de retry)
    const initialItems: LanguageProgressItem[] = targetLangs.map((lang) => {
      const existing = translationProgressItems.find(
        (it) => it.language.code.toLowerCase() === lang.code.toLowerCase()
      );
      if (existing && existing.status === 'success') {
        return existing;
      }
      return {
        language: lang,
        status: 'waiting',
        progress: { current: 0, total: leafCount, percentage: 0 },
      };
    });

    setTranslationProgressItems(initialItems);
    setIsTranslatingModalOpen(true);
    setTranslatingStatus('translating');
    setTranslationError(null);

    let runningOverrides = { ...editedOverrides };
    let hasFailure = false;
    let failureMsg = '';

    for (let i = 0; i < targetLangs.length; i++) {
      const currentLang = targetLangs[i];

      // Si déjà réussi lors d'une passe précédente, ignorer
      const isAlreadySuccess = initialItems.find(
        (it) =>
          it.language.code.toLowerCase() === currentLang.code.toLowerCase() &&
          it.status === 'success'
      );
      if (isAlreadySuccess) {
        continue;
      }

      // Mettre à jour l'élément en cours vers 'translating'
      setTranslationProgressItems((prev) =>
        prev.map((item) =>
          item.language.code.toLowerCase() === currentLang.code.toLowerCase()
            ? { ...item, status: 'translating' }
            : item
        )
      );

      try {
        const result = await translateAllKeys(currentLang.code, allLeaves, (p) => {
          setTranslationProgressItems((prev) =>
            prev.map((item) =>
              item.language.code.toLowerCase() === currentLang.code.toLowerCase()
                ? { ...item, progress: p }
                : item
            )
          );
        });

        if (result.success && result.translations) {
          // INSTALLATION IMMÉDIATE : dès qu'une langue est traduite, on l'ajoute directement à l'application et Firestore !
          const { updatedOverrides, updatedLanguages } = await addLanguageToApp(
            currentLang.code,
            result.translations,
            runningOverrides,
            currentUserEmail
          );
          runningOverrides = updatedOverrides;
          setSavedOverrides(updatedOverrides);
          setEditedOverrides(updatedOverrides);
          setActiveLanguageCodes(updatedLanguages);

          setTranslationProgressItems((prev) =>
            prev.map((item) =>
              item.language.code.toLowerCase() === currentLang.code.toLowerCase()
                ? {
                    ...item,
                    status: 'success',
                    progress: { current: leafCount, total: leafCount, percentage: 100 },
                  }
                : item
            )
          );
        } else {
          hasFailure = true;
          failureMsg =
            result.error ||
            t(
              'settings.internationalization.translating_modal.error_desc',
              "Impossible d'accéder au service Google Traduction (connexion Internet indisponible ou restrictions d'accès)."
            );

          setTranslationProgressItems((prev) =>
            prev.map((item) =>
              item.language.code.toLowerCase() === currentLang.code.toLowerCase()
                ? { ...item, status: 'error', errorMessage: failureMsg }
                : item
            )
          );
          break;
        }
      } catch (err: any) {
        hasFailure = true;
        failureMsg = err?.message || "Erreur de connexion au service de traduction.";
        setTranslationProgressItems((prev) =>
          prev.map((item) =>
            item.language.code.toLowerCase() === currentLang.code.toLowerCase()
              ? { ...item, status: 'error', errorMessage: failureMsg }
              : item
          )
        );
        break;
      }
    }

    if (!hasFailure) {
      setTranslatingStatus('success');
      setTimeout(() => {
        setIsTranslatingModalOpen(false);
        setTargetLanguagesForAdd([]);
        setTranslationProgressItems([]);
      }, 1800);
    } else {
      setTranslatingStatus('error');
      setTranslationError(failureMsg);
    }
  };

  // En cas d'erreur/hors-ligne : continuer avec les textes français par défaut UNIQUEMENT pour les langues non encore réussies
  const handleContinueWithDefault = async () => {
    // Identifier strictement les langues qui n'ont pas encore le statut 'success'
    const pendingItems = translationProgressItems.filter((item) => item.status !== 'success');

    if (pendingItems.length === 0) {
      setIsTranslatingModalOpen(false);
      setTargetLanguagesForAdd([]);
      setTranslationProgressItems([]);
      return;
    }

    try {
      setTranslatingStatus('translating');
      const fallbackMap = buildFallbackTranslationsFromSource(allLeaves);
      const batch = pendingItems.map((item) => ({
        langCode: item.language.code,
        initialKeyMap: fallbackMap,
      }));

      // On applique le fallback SEULEMENT aux langues en échec, en conservant intactes les langues déjà traduites avec succès !
      const { updatedOverrides, updatedLanguages } = await addMultipleLanguagesToApp(
        batch,
        editedOverrides,
        currentUserEmail
      );
      setSavedOverrides(updatedOverrides);
      setEditedOverrides(updatedOverrides);
      setActiveLanguageCodes(updatedLanguages);

      setTranslationProgressItems((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'success',
          progress: { current: leafCount, total: leafCount, percentage: 100 },
        }))
      );
      setTranslatingStatus('success');

      setTimeout(() => {
        setIsTranslatingModalOpen(false);
        setTargetLanguagesForAdd([]);
        setTranslationProgressItems([]);
      }, 1200);
    } catch (err: any) {
      setTranslationError(err?.message || "Erreur lors de l'ajout des langues.");
      setTranslatingStatus('error');
    }
  };

  // Réessayer la traduction uniquement pour les langues restantes
  const handleRetryTranslation = () => {
    if (targetLanguagesForAdd.length > 0) {
      handleSelectLanguagesToAdd(targetLanguagesForAdd);
    }
  };

  // --- Gestion de la suppression d'une langue ---
  const handleOpenDeleteLanguageModal = (language: LanguageItem) => {
    setDeleteModalState({ isOpen: true, language });
  };

  const handleConfirmDeleteLanguage = async (code: string) => {
    const { updatedOverrides, updatedLanguages } = await deleteLanguageFromApp(
      code,
      editedOverrides,
      currentUserEmail
    );
    setSavedOverrides(updatedOverrides);
    setEditedOverrides(updatedOverrides);
    setActiveLanguageCodes(updatedLanguages);
  };

  // Rendu récursif des nœuds de l'arbre
  const renderTreeNodes = (nodes: TranslationTreeNode[]): React.ReactNode => {
    return nodes.map((node) => {
      if (node.type === 'section') {
        const isExpanded = activeExpandedSections.has(node.id);

        return (
          <React.Fragment key={`sec-${node.id}`}>
            {/* Ligne de section cliquable pour déplier/replier */}
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
              {activeLanguages.map((lang, idx) => (
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
          {activeLanguages.map((lang) => {
            const currentVal = getLeafValue(leaf, lang.code);
            const isModified = isCellDirty(leaf, lang.code);

            return (
              <td
                key={`${leaf.id}-${lang.code}`}
                onDoubleClick={() => isAdmin && handleOpenZoomModal(leaf, lang.code)}
                className="py-1.5 px-2 border-r border-slate-200 align-top w-[300px] min-w-[280px] max-w-[380px] relative group/cell hover:bg-slate-50/50 transition-colors"
              >
                <div className="relative">
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={currentVal}
                    onChange={(e) => handleCellChange(leaf.id, lang.code, e.target.value)}
                    placeholder={leaf.defaults[lang.code] || leaf.defaults['fr'] || '—'}
                    className={`w-full py-1.5 px-2.5 text-xs rounded-lg border transition-all ${
                      isModified
                        ? 'border-2 border-[#5d4037] bg-yellow-50 text-slate-950 font-semibold shadow-xs focus:ring-0 focus:border-[#5d4037] focus:outline-none'
                        : 'border-transparent hover:border-slate-300 focus:border-2 focus:border-indigo-600 focus:ring-0 focus:outline-none bg-transparent focus:bg-white text-slate-800'
                    } ${!isAdmin ? 'cursor-default opacity-90' : 'cursor-text'}`}
                  />

                  {/* Bouton pour ouvrir la modale zoom */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenZoomModal(leaf, lang.code)}
                      title={t('settings.internationalization.zoom_tooltip', 'Agrandir pour modifier (double-clic)')}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded ${
                        isModified
                          ? 'bg-yellow-100/90 hover:bg-yellow-200 text-[#5d4037] border border-[#5d4037]/30'
                          : 'bg-white/90 hover:bg-slate-200 text-slate-400 hover:text-slate-700 border border-slate-200'
                      } shadow-2xs opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer`}
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
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
    <div className="flex-1 min-h-0 h-full flex flex-col gap-4">
      {/* En-tête avec titre, sous-titre et outils directement sur le fond de la fenêtre (sans boîte englobante) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className={`${TAB_TITLE_CLASS} text-[#5d4037] flex items-center gap-2.5`}>
            <Globe className="w-5 h-5 text-[#5d4037] shrink-0" />
            <span>{t('settings.internationalization.title', 'Internationalisation des clés')}</span>
          </h2>
          <p className="text-xs text-[#5d4037]/80 mt-1 max-w-2xl font-normal">
            {t(
              'settings.internationalization.subtitle',
              'Personnalisez en temps réel l’ensemble des libellés et textes de l’application pour chaque langue.'
            )}
          </p>
        </div>

        {/* Zone de recherche / filtre puis Bouton Ajouter une langue directement sur le fond */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Encart de recherche / filtrage (avec pictogramme loupe à gauche, validation par Entrée) */}
          <SearchFilterInput
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              if (val.trim() === '') {
                handleResetSearch();
              }
            }}
            onSubmit={handleExecuteSearch}
            onClear={handleResetSearch}
            placeholder={t('settings.internationalization.search_placeholder', 'Rechercher une clé ou un texte...')}
            showSearchButton={false}
            containerClassName="w-72 sm:w-80"
          />

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className={CREATE_ITEM_BUTTON_CLASS}
            >
              <Plus className="w-4 h-4" />
              <span>{t('settings.internationalization.add_language_btn', 'Ajouter une langue')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Cadre du tableau scrollable avec ascenseurs et barre inférieure d'enregistrement */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden isolate relative z-0">
        {/* Zone du tableau scrollable avec ascenseurs vertical et horizontal */}
        <div className="flex-1 min-h-0 overflow-auto [scrollbar-width:thin]">
        <table className="w-full border-collapse text-left min-w-[1200px]">
          {/* En-tête du tableau figée en haut */}
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
            <tr>
              {/* Colonne 1 : Clé (figée à gauche avec double filet vertical et horizontal, total des clés et pictogrammes Tout replier / Tout déplier) */}
              <th
                scope="col"
                className={`sticky left-0 z-30 bg-slate-100 py-2.5 px-3 ${TABLE_HEADER_TEXT_CLASS} select-none w-[320px] min-w-[320px] max-w-[320px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${TABLE_FROZEN_DIVIDER_CLASS} ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{t('settings.internationalization.col_key', 'Clé de traduction')}</span>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-200/90 text-slate-700 border border-slate-300/80 shrink-0">
                      {leafCount}{' '}
                      {leafCount > 1
                        ? t('settings.internationalization.key_other', 'clés')
                        : t('settings.internationalization.key_one', 'clé')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Pictogramme Tout replier avec bulle d'information */}
                    <Tooltip content={t('settings.internationalization.collapse_all', 'Tout replier')}>
                      <button
                        type="button"
                        onClick={handleCollapseAll}
                        aria-label={t('settings.internationalization.collapse_all', 'Tout replier')}
                        className="p-1 rounded-md border border-slate-300 bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
                      >
                        <ChevronsDownUp className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>

                    {/* Pictogramme Tout déplier avec bulle d'information */}
                    <Tooltip content={t('settings.internationalization.expand_all', 'Tout déplier')}>
                      <button
                        type="button"
                        onClick={handleExpandAll}
                        aria-label={t('settings.internationalization.expand_all', 'Tout déplier')}
                        className="p-1 rounded-md border border-slate-300 bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
                      >
                        <ChevronsUpDown className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </th>

              {/* Colonnes langues dynamiques avec Drapeau + Nom + Bouton poubelle suppression */}
              {activeLanguages.map((lang) => (
                <th
                  key={lang.code}
                  scope="col"
                  className={`py-3 px-3 text-xs font-bold text-slate-800 border-r border-slate-200 w-[300px] min-w-[280px] max-w-[380px] ${TABLE_HEADER_DOUBLE_BOTTOM_CLASS}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <LanguageFlag code={lang.code} className="w-5 h-3.5 shadow-2xs" />
                      <span className="truncate">{lang.nativeLabel || lang.label}</span>
                      <span className="text-[10px] font-bold font-mono text-slate-400 shrink-0">
                        ({lang.abbr})
                      </span>
                    </div>

                    {/* Bouton pictogramme poubelle pour supprimer la langue */}
                    {isAdmin && (
                      lang.code.toLowerCase() === 'fr' ? (
                        <Tooltip content={t('settings.internationalization.cannot_delete_default', 'La langue par défaut (français) ne peut pas être supprimée')}>
                          <button
                            type="button"
                            disabled
                            className="p-1 rounded text-slate-300 cursor-not-allowed opacity-40 shrink-0"
                            aria-label="Langue par défaut protégée"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      ) : activeLanguages.length <= 1 ? (
                        <Tooltip content={t('settings.internationalization.cannot_delete_last', 'Il doit rester au moins une langue')}>
                          <button
                            type="button"
                            disabled
                            className="p-1 rounded text-slate-300 cursor-not-allowed opacity-40 shrink-0"
                            aria-label="Dernière langue protégée"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      ) : (
                        <Tooltip content={t('settings.internationalization.delete_lang_tooltip', 'Supprimer cette langue de l’application')}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDeleteLanguageModal(lang);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                            aria-label={`Supprimer la langue ${lang.nativeLabel || lang.label}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      )
                    )}
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
        </div>

        {/* Boutons Annuler et Enregistrer */}
        {isAdmin && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={!hasUnsavedChanges || isSaving}
              onClick={handleRevertChanges}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                hasUnsavedChanges && !isSaving
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-200 cursor-pointer shadow-2xs'
                  : 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('settings.internationalization.btn_cancel', 'Annuler les modifications')}</span>
            </button>

            <button
              type="button"
              disabled={!hasUnsavedChanges || isSaving}
              onClick={handleSave}
              className={`px-3 py-1.5 ${getSaveButtonStateClass(hasUnsavedChanges, isSaving)} flex items-center gap-1.5`}
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving
                  ? t('settings.internationalization.btn_saving', 'Enregistrement...')
                  : t('settings.internationalization.btn_save', 'Enregistrer les modifications')}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>

      {/* Modale d'ajout d'une ou plusieurs nouvelles langues */}
      <AddLanguageModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        activeLanguageCodes={activeLanguageCodes}
        onSelectLanguages={handleSelectLanguagesToAdd}
      />

      {/* Modale d'information et animation de traduction en cours (support multi-lignes) */}
      <TranslationProgressModal
        isOpen={isTranslatingModalOpen}
        status={translatingStatus}
        items={translationProgressItems}
        errorMessage={translationError || undefined}
        onRetry={handleRetryTranslation}
        onContinueWithDefault={handleContinueWithDefault}
        onCancel={() => {
          setIsTranslatingModalOpen(false);
          setTargetLanguagesForAdd([]);
          setTranslationProgressItems([]);
        }}
      />

      {/* Modale de confirmation de suppression d'une langue */}
      <DeleteLanguageConfirmModal
        isOpen={deleteModalState.isOpen}
        language={deleteModalState.language}
        onClose={() => setDeleteModalState({ isOpen: false, language: null })}
        onConfirmDelete={handleConfirmDeleteLanguage}
      />

      {/* Modal Zoom pour édition confortable d'un libellé */}
      {zoomModal.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* En-tête du modal zoom */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-xs border border-blue-200">
                  <LanguageFlag code={zoomModal.langCode} className="w-6 h-4 rounded-xs shadow-xs" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`${MODAL_TITLE_CLASS} text-slate-900`}>
                      {t('settings.internationalization.zoom_modal.title', 'Modification d’un libellé')}
                    </h3>
                    {zoomModal.leaf?.id && (
                      <span
                        className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-sm"
                        title={zoomModal.leaf.id}
                      >
                        {zoomModal.leaf.id}
                      </span>
                    )}
                  </div>
                  {/* 1) Nom de la langue dans la langue de l'interface à la place de l'identifiant technique */}
                  <p className="text-xs font-semibold text-blue-700 mt-0.5">
                    {getLocalizedLanguageName(zoomModal.langCode, t)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setZoomModal((prev) => ({ ...prev, isOpen: false, leaf: null, rows: [] }))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label={t('settings.internationalization.zoom_modal.cancel', 'Annuler')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corps du modal zoom avec marges et frame à coins arrondis pour le tableau */}
            <div className="flex-1 min-h-0 p-4 sm:p-6 flex flex-col overflow-hidden bg-slate-50/40">
              {zoomTranslateError && (
                <div className="mb-3 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{zoomTranslateError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setZoomTranslateError(null)}
                    className="text-amber-600 hover:text-amber-800 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Cadre englobant l'en-tête fixe, la première ligne de langue figée et la zone scrollable */}
              <div className="flex-1 min-h-0 border border-slate-200 rounded-xl shadow-2xs bg-white overflow-hidden flex flex-col">
                {/* 1. Ligne d'en-tête FIXE (Colonnes : Langue, Actuelle, Corrigée, Action) */}
                <div className="shrink-0 bg-slate-100 border-b border-slate-200">
                  <div
                    style={{ paddingRight: `${modalScrollbarWidth}px` }}
                    className={`grid grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)_60px] ${TABLE_HEADER_TEXT_CLASS} h-10 select-none items-stretch`}
                  >
                    <div className="px-3 flex items-center border-r border-slate-200">
                      {t('settings.internationalization.zoom_modal.col_language', 'Langue')}
                    </div>
                    <div className="px-3 flex items-center border-r border-slate-200">
                      {t('settings.internationalization.zoom_modal.col_current', 'Actuelle')}
                    </div>
                    <div className="px-3 flex items-center border-r border-slate-200">
                      {t('settings.internationalization.zoom_modal.col_corrected', 'Corrigée')}
                    </div>
                    <div className="px-2 flex items-center justify-center">
                      <Tooltip
                        content={t(
                          'settings.internationalization.zoom_modal.apply_to_all_langs',
                          'Reporter en 1 seule opération la modification de libellé dans toutes les autres langues'
                        )}
                      >
                        <button
                          type="button"
                          onClick={handleTranslateAllRows}
                          disabled={isTranslatingAll || !zoomModal.rows[0]?.correctedValue.trim()}
                          className="p-1 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-100/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center justify-center"
                          aria-label={t(
                            'settings.internationalization.zoom_modal.apply_to_all_langs',
                            'Reporter en 1 seule opération la modification de libellé dans toutes les autres langues'
                          )}
                        >
                          {isTranslatingAll ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <Languages className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* 2. Première ligne de langue : FIGÉE comme la ligne d'en-tête (langue de départ de la modification) */}
                {zoomModal.rows[0] && (() => {
                  const primaryRow = zoomModal.rows[0];
                  const isModified =
                    primaryRow.correctedValue !== primaryRow.currentValue ||
                    (zoomModal.leaf ? isCellDirty(zoomModal.leaf, primaryRow.langCode) : false);

                  return (
                    <div className="shrink-0 bg-blue-50/20">
                      <div
                        style={{ paddingRight: `${modalScrollbarWidth}px` }}
                        className="grid grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)_60px] items-stretch font-semibold text-slate-900"
                      >
                        {/* 1ère colonne : langue initiale avec drapeau, nom et bandeau bleu net */}
                        <div className="py-3 px-3 align-top border-r border-slate-200/70 relative flex items-start bg-blue-50/25">
                          <span
                            className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-xs"
                            aria-hidden="true"
                          />
                          <div className="flex items-center gap-2 min-w-0">
                            <LanguageFlag
                              code={primaryRow.langCode}
                              className="w-5 h-3.5 shrink-0 rounded-xs shadow-xs"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {getLocalizedLanguageName(primaryRow.langCode, t)}
                              </div>
                              <span className="inline-block text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 uppercase tracking-wider mt-0.5">
                                {t('settings.internationalization.zoom_modal.primary_badge', 'Initiale')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 2ème colonne : version actuelle du libellé */}
                        <div className="py-3 px-3 align-top border-r border-slate-200/70">
                          <div className="p-2 bg-slate-100 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 break-words whitespace-pre-wrap select-all leading-relaxed">
                            {primaryRow.currentValue || (
                              <span className="text-slate-400 italic">
                                {t('settings.internationalization.zoom_modal.empty_label', '(vide)')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3ème colonne : nouveau libellé corrigé */}
                        <div className="py-3 px-3 align-top border-r border-slate-200/70">
                          <textarea
                            ref={primaryTextareaRef}
                            rows={2}
                            value={primaryRow.correctedValue}
                            onChange={(e) => handleZoomRowChange(primaryRow.langCode, e.target.value)}
                            placeholder={t(
                              'settings.internationalization.zoom_modal.input_placeholder',
                              'Saisissez la correction...'
                            )}
                            className={
                              isModified
                                ? 'w-full text-xs p-2 rounded-lg border-2 border-[#5d4037] focus:ring-0 focus:border-[#5d4037] focus:outline-none bg-yellow-50 font-semibold text-slate-950 shadow-xs leading-relaxed resize-y transition-all'
                                : 'w-full text-xs p-2 rounded-lg border border-slate-300 focus:border-2 focus:ring-0 focus:border-indigo-600 focus:outline-none bg-white font-medium text-slate-900 shadow-inner leading-relaxed resize-y transition-all'
                            }
                          />
                        </div>

                        {/* 4ème colonne : tiret (langue de départ) */}
                        <div className="py-3 px-2 flex items-center justify-center">
                          <span className="text-xs text-blue-400 font-bold select-none">—</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Double filet horizontal marquant la séparation sous la première ligne de langue figée */}
                <div
                  className="shrink-0 h-[5px] bg-slate-100 border-t border-slate-300 border-b-2 border-slate-300 w-full"
                  aria-hidden="true"
                />

                {/* 4. Zone SCROLLABLE contenant les AUTRES langues (l'ascenseur s'arrête strictement sous le double filet) */}
                <div
                  ref={modalScrollContainerRef}
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] bg-white divide-y divide-slate-100"
                >
                  {zoomModal.rows.slice(1).map((row) => {
                    const isTranslatingThis = translatingRowCodes.has(row.langCode);
                    const isModified =
                      row.correctedValue !== row.currentValue ||
                      (zoomModal.leaf ? isCellDirty(zoomModal.leaf, row.langCode) : false);

                    return (
                      <div
                        key={row.langCode}
                        className="grid grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)_60px] items-stretch bg-white hover:bg-slate-50/60 text-slate-700 transition-colors"
                      >
                        {/* 1ère colonne : langue cible avec drapeau et nom */}
                        <div className="py-3 px-3 align-top border-r border-slate-200/70 flex items-start">
                          <div className="flex items-center gap-2 min-w-0">
                            <LanguageFlag
                              code={row.langCode}
                              className="w-5 h-3.5 shrink-0 rounded-xs shadow-xs"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-700 text-xs truncate">
                                {getLocalizedLanguageName(row.langCode, t)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2ème colonne : version actuelle du libellé */}
                        <div className="py-3 px-3 align-top border-r border-slate-200/70">
                          <div className="p-2 bg-slate-100/60 rounded-lg border border-slate-200 text-xs text-slate-600 break-words whitespace-pre-wrap select-all leading-relaxed">
                            {row.currentValue || (
                              <span className="text-slate-400 italic">
                                {t('settings.internationalization.zoom_modal.empty_label', '(vide)')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3ème colonne : nouveau libellé corrigé */}
                        <div className="py-3 px-3 align-top border-r border-slate-200/70">
                          <textarea
                            rows={2}
                            value={row.correctedValue}
                            onChange={(e) => handleZoomRowChange(row.langCode, e.target.value)}
                            placeholder={t(
                              'settings.internationalization.zoom_modal.input_placeholder',
                              'Saisissez la correction...'
                            )}
                            className={
                              isModified
                                ? 'w-full text-xs p-2 rounded-lg border-2 border-[#5d4037] focus:ring-0 focus:border-[#5d4037] focus:outline-none bg-yellow-50 font-semibold text-slate-950 shadow-xs leading-relaxed resize-y transition-all'
                                : 'w-full text-xs p-2 rounded-lg border border-slate-300 focus:border-2 focus:ring-0 focus:border-indigo-600 focus:outline-none bg-white font-normal text-slate-800 shadow-2xs leading-relaxed resize-y transition-all'
                            }
                          />
                        </div>

                        {/* 4ème colonne : pictogramme de report de traduction */}
                        <div className="py-3 px-2 flex items-center justify-center">
                          <Tooltip
                            content={t(
                              'settings.internationalization.zoom_modal.apply_to_lang',
                              'reporter la modification en {{lang}}',
                              { lang: getLocalizedLanguageName(row.langCode, t) }
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => handleTranslateRow(row.langCode)}
                              disabled={
                                isTranslatingThis ||
                                isTranslatingAll ||
                                !zoomModal.rows[0]?.correctedValue.trim()
                              }
                              className="p-2 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-100/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center justify-center"
                              aria-label={t(
                                'settings.internationalization.zoom_modal.apply_to_lang',
                                'reporter la modification en {{lang}}',
                                { lang: getLocalizedLanguageName(row.langCode, t) }
                              )}
                            >
                              {isTranslatingThis ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              ) : (
                                <Languages className="w-4 h-4" />
                              )}
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pied de page du modal zoom */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleResetToDefaultInZoom}
                className="text-xs text-slate-600 hover:text-slate-900 font-semibold underline cursor-pointer"
              >
                {t('settings.internationalization.zoom_modal.restore_default', 'Rétablir les valeurs par défaut')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomModal((prev) => ({ ...prev, isOpen: false, leaf: null, rows: [] }))}
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
