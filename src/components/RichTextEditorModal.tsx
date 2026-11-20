import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Type,
  Italic,
  Highlighter,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  RemoveFormatting,
  HelpCircle,
  X,
  Check,
} from 'lucide-react';
import { MODAL_CANCEL_BUTTON_CLASS } from '../constants/ui';
import { DEFAULT_LONG_TEXT_MAX_LENGTH } from '../types/customParam';
import { getElementTextLength } from '../utils/richText';

// Palette de couleurs de texte prédéfinies
const TEXT_COLORS = [
  { hex: '#0f172a', name: 'Noir ardoise' },
  { hex: '#475569', name: 'Gris anthracite' },
  { hex: '#2563eb', name: 'Bleu vif' },
  { hex: '#4f46e5', name: 'Indigo' },
  { hex: '#059669', name: 'Vert émeraude' },
  { hex: '#dc2626', name: 'Rouge carmin' },
  { hex: '#ea580c', name: 'Orange intense' },
  { hex: '#9333ea', name: 'Pourpre' },
];

interface RichTextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (htmlContent: string) => void;
  initialValue: string;
  paramName: string;
  paramDescription?: string;
  maxLength?: number;
  isReadOnly?: boolean;
}

export const RichTextEditorModal: React.FC<RichTextEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialValue,
  paramName,
  paramDescription,
  maxLength = DEFAULT_LONG_TEXT_MAX_LENGTH,
  isReadOnly = false,
}) => {
  const effectiveMaxLength =
    maxLength && Number.isFinite(maxLength) && maxLength >= 1
      ? Math.round(maxLength)
      : DEFAULT_LONG_TEXT_MAX_LENGTH;
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);

  const [charCount, setCharCount] = useState(0);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [isBulletList, setIsBulletList] = useState(false);
  const [isNumberedList, setIsNumberedList] = useState(false);
  const [currentAlignment, setCurrentAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [currentFontSize, setCurrentFontSize] = useState<string>('14px');
  const [currentTextColor, setCurrentTextColor] = useState<string>('#0f172a');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Fermer la palette de couleurs en cas de clic en dehors
  useEffect(() => {
    if (!isColorPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColorPickerOpen]);

  // Calcule la longueur de texte réel (hors balises HTML)
  const computeTextLength = useCallback(() => {
    return getElementTextLength(editorRef.current);
  }, []);

  // Détecte les styles actifs au point d'insertion ou sur la sélection
  const updateActiveFormats = useCallback(() => {
    if (!editorRef.current) return;
    try {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsBulletList(document.queryCommandState('insertUnorderedList'));
      setIsNumberedList(document.queryCommandState('insertOrderedList'));

      // Alignement
      if (document.queryCommandState('justifyCenter')) {
        setCurrentAlignment('center');
      } else if (document.queryCommandState('justifyRight')) {
        setCurrentAlignment('right');
      } else if (document.queryCommandState('justifyFull')) {
        setCurrentAlignment('justify');
      } else {
        setCurrentAlignment('left');
      }

      // Surlignage, taille et couleur de police via les nœuds parents de la sélection
      const sel = window.getSelection();
      if (sel && sel.anchorNode && editorRef.current.contains(sel.anchorNode)) {
        let node: Node | null = sel.anchorNode;
        let foundHighlight = false;
        let foundSize = '14px';
        let foundColor = '';

        while (node && node !== editorRef.current) {
          if (node instanceof HTMLElement) {
            const bg = node.style.backgroundColor || window.getComputedStyle(node).backgroundColor;
            if (
              bg === 'rgb(254, 240, 138)' ||
              bg === '#fef08a' ||
              bg === 'yellow' ||
              bg.includes('254, 240, 138') ||
              node.tagName.toLowerCase() === 'mark'
            ) {
              foundHighlight = true;
            }
            if (node.style.fontSize) {
              foundSize = node.style.fontSize;
            }
            if (node.style.color) {
              foundColor = node.style.color;
            }
          }
          node = node.parentNode;
        }
        setIsHighlighted(foundHighlight);
        setCurrentFontSize(foundSize);
        if (foundColor) {
          setCurrentTextColor(foundColor);
        }
      }
    } catch {
      // Ignore les exceptions de commandes non supportées selon les navigateurs
    }
    setCharCount(computeTextLength());
  }, [computeTextLength]);

  // Initialisation du contenu à l'ouverture
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (editorRef.current) {
        let formatted = initialValue || '';
        // Si le texte est brut sans balises HTML mais contient des retours à la ligne
        if (formatted && !/<[a-z][\s\S]*>/i.test(formatted) && formatted.includes('\n')) {
          formatted = formatted.replace(/\n/g, '<br/>');
        }
        editorRef.current.innerHTML = formatted;
        setCharCount(computeTextLength());

        if (!isReadOnly) {
          editorRef.current.focus();
          // Placer le curseur à la fin du contenu
          try {
            const sel = window.getSelection();
            if (sel) {
              const range = document.createRange();
              range.selectNodeContents(editorRef.current);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          } catch {
            // Ignore
          }
        }
        updateActiveFormats();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, initialValue, isReadOnly, computeTextLength, updateActiveFormats]);

  // Écoute des changements de sélection globaux quand le modal est ouvert
  useEffect(() => {
    if (!isOpen) return;

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.anchorNode && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
        updateActiveFormats();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isOpen, updateActiveFormats]);

  if (!isOpen) return null;

  // Actions de mise en page
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (isReadOnly || !editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand(command, false, value);
    } catch {
      // fallback
    }
    updateActiveFormats();
  };

  const handleToggleBold = (e: React.MouseEvent) => {
    e.preventDefault();
    executeCommand('bold');
  };

  const handleToggleItalic = (e: React.MouseEvent) => {
    e.preventDefault();
    executeCommand('italic');
  };

  const handleToggleHighlight = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isReadOnly || !editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand('styleWithCSS', false, 'true');
      if (isHighlighted) {
        document.execCommand('hiliteColor', false, 'transparent');
        try {
          document.execCommand('backColor', false, 'transparent');
        } catch {}
      } else {
        document.execCommand('hiliteColor', false, '#fef08a');
        try {
          document.execCommand('backColor', false, '#fef08a');
        } catch {}
      }
    } catch {
      // fallback
    }
    updateActiveFormats();
  };

  const handleSetAlignment = (e: React.MouseEvent, align: 'left' | 'center' | 'right' | 'justify') => {
    e.preventDefault();
    if (align === 'left') executeCommand('justifyLeft');
    if (align === 'center') executeCommand('justifyCenter');
    if (align === 'right') executeCommand('justifyRight');
    if (align === 'justify') executeCommand('justifyFull');
    setCurrentAlignment(align);
  };

  const handleSetFontSize = (sizePx: string) => {
    if (isReadOnly || !editorRef.current) return;
    editorRef.current.focus();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    // Si aucun texte n'est sélectionné, insérer un span prêt pour la frappe
    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = sizePx;
      span.appendChild(document.createTextNode('\u200B')); // caractère de largeur nulle
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(span.firstChild!, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      setCurrentFontSize(sizePx);
      updateActiveFormats();
      return;
    }

    try {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('fontSize', false, '7');
      const nodes = editorRef.current.querySelectorAll('[style*="xxx-large"], font[size="7"]');
      nodes.forEach((el) => {
        (el as HTMLElement).removeAttribute('size');
        (el as HTMLElement).style.fontSize = sizePx;
      });
    } catch {
      // fallback
    }
    setCurrentFontSize(sizePx);
    updateActiveFormats();
  };

  const handleSetTextColor = (colorHex: string) => {
    if (isReadOnly || !editorRef.current) return;
    editorRef.current.focus();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        const span = document.createElement('span');
        span.style.color = colorHex;
        span.appendChild(document.createTextNode('\u200B')); // caractère de largeur nulle
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.setStart(span.firstChild!, 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        setCurrentTextColor(colorHex);
        setIsColorPickerOpen(false);
        updateActiveFormats();
        return;
      }
    }

    try {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('foreColor', false, colorHex);
    } catch {
      // fallback
    }
    setCurrentTextColor(colorHex);
    setIsColorPickerOpen(false);
    updateActiveFormats();
  };

  const handleClearFormatting = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isReadOnly || !editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand('removeFormat', false);
      document.execCommand('justifyLeft', false);
      setCurrentAlignment('left');
      setCurrentFontSize('14px');
      setCurrentTextColor('#0f172a');
      setIsBulletList(false);
      setIsNumberedList(false);
    } catch {
      // fallback
    }
    updateActiveFormats();
  };

  const handleSave = () => {
    if (isReadOnly || !editorRef.current) return;
    const length = computeTextLength();
    if (length > effectiveMaxLength) return;

    let html = editorRef.current.innerHTML.trim();
    // Normalisation si vide
    if (html === '<br>' || html === '<p><br></p>' || html === '<div><br></div>' || length === 0) {
      html = '';
    }
    onSave(html);
  };

  const isOverLimit = charCount > effectiveMaxLength;

  return (
    <div
      className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-2xl w-full p-6 animate-in zoom-in-95 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Entête */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-lg border border-sky-200">
              <Type className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h5 className="font-bold text-base text-slate-900 leading-tight">
                {paramName}
              </h5>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={t('modals.common.cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description optionnelle */}
        {paramDescription && (
          <div className="p-2.5 bg-sky-50/80 border border-sky-200 rounded-lg text-sky-900 text-xs mb-3 flex items-start gap-2 shrink-0">
            <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>{paramDescription}</span>
          </div>
        )}

        {/* Barre d'outils de mise en page */}
        {!isReadOnly && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg mb-2.5 shrink-0 text-xs">
            {/* Taille de police */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
              <span className="text-[11px] font-medium text-slate-500">
                {t('modals.project.editor_font_size', 'Taille')} :
              </span>
              <select
                value={currentFontSize}
                onChange={(e) => handleSetFontSize(e.target.value)}
                className="py-1 px-2 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                title={t('modals.project.editor_font_size', 'Taille de police')}
              >
                <option value="12px">{t('modals.project.font_size_small', 'Petite (12px)')}</option>
                <option value="14px">{t('modals.project.font_size_normal', 'Normale (14px)')}</option>
                <option value="16px">{t('modals.project.font_size_large', 'Grande (16px)')}</option>
                <option value="18px">{t('modals.project.font_size_xlarge', 'Très grande (18px)')}</option>
              </select>
            </div>

            {/* Gras, Italique, Surligné, Couleur de police */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
              <button
                type="button"
                onMouseDown={handleToggleBold}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  isBold
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_bold', 'Gras (Ctrl+B)')}
              >
                <span
                  className="w-4 h-4 flex items-center justify-center font-black text-[13px] leading-none select-none tracking-tight font-sans"
                  style={{ fontWeight: 950 }}
                >
                  B
                </span>
              </button>

              <button
                type="button"
                onMouseDown={handleToggleItalic}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  isItalic
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_italic', 'Italique (Ctrl+I)')}
              >
                <Italic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={handleToggleHighlight}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1 ${
                  isHighlighted
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_highlight', 'Surligné en jaune')}
              >
                <Highlighter className="w-4 h-4 text-amber-600" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 border border-amber-400 inline-block" />
              </button>

              {/* Sélecteur de couleur de police */}
              <div className="relative" ref={colorPickerRef}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsColorPickerOpen((prev) => !prev);
                  }}
                  className={`p-1.5 rounded-md border transition-colors cursor-pointer flex items-center ${
                    isColorPickerOpen
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title={t('modals.project.editor_font_color', 'Couleur de police')}
                >
                  <div className="flex flex-col items-center justify-center w-4 h-4">
                    <span
                      className="font-black text-xs leading-none select-none"
                      style={{ color: currentTextColor || '#0f172a' }}
                    >
                      A
                    </span>
                    <span
                      className="w-3.5 h-1 rounded-full mt-0.5 border border-black/15 shrink-0"
                      style={{ backgroundColor: currentTextColor || '#0f172a' }}
                    />
                  </div>
                </button>

                {isColorPickerOpen && (
                  <div
                    className="absolute left-0 top-full mt-1.5 p-2.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 w-52 animate-in fade-in zoom-in-95 select-none"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-semibold text-slate-600 mb-2 px-0.5">
                      {t('modals.project.editor_font_color', 'Couleur de police')}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                      {TEXT_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSetTextColor(c.hex);
                          }}
                          className="w-8 h-8 rounded-lg border border-slate-300 hover:scale-105 transition-transform flex items-center justify-center cursor-pointer shadow-2xs"
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {currentTextColor.toLowerCase() === c.hex.toLowerCase() && (
                            <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <label className="text-[11px] text-slate-600 cursor-pointer flex items-center gap-1.5">
                        <span>{t('modals.project.editor_custom_color', 'Personnalisée :')}</span>
                        <input
                          type="color"
                          value={currentTextColor.startsWith('#') ? currentTextColor : '#0f172a'}
                          onChange={(e) => handleSetTextColor(e.target.value)}
                          className="w-6 h-6 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
                        />
                      </label>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSetTextColor('#0f172a');
                        }}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer font-medium"
                      >
                        {t('modals.project.editor_reset_color', 'Par défaut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Listes à puces et listes numérotées */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  executeCommand('insertUnorderedList');
                }}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  isBulletList
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_bullet_list', 'Liste à puces')}
              >
                <List className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  executeCommand('insertOrderedList');
                }}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  isNumberedList
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_numbered_list', 'Liste numérotée')}
              >
                <ListOrdered className="w-4 h-4" />
              </button>
            </div>

            {/* Alignement */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
              <button
                type="button"
                onMouseDown={(e) => handleSetAlignment(e, 'left')}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  currentAlignment === 'left'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_align_left', 'Aligner à gauche')}
              >
                <AlignLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => handleSetAlignment(e, 'center')}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  currentAlignment === 'center'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_align_center', 'Centrer')}
              >
                <AlignCenter className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => handleSetAlignment(e, 'right')}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  currentAlignment === 'right'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_align_right', 'Aligner à droite')}
              >
                <AlignRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => handleSetAlignment(e, 'justify')}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  currentAlignment === 'justify'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={t('modals.project.editor_align_justify', 'Justifier')}
              >
                <AlignJustify className="w-4 h-4" />
              </button>
            </div>

            {/* Effacer la mise en page */}
            <button
              type="button"
              onMouseDown={handleClearFormatting}
              className="p-1.5 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer ml-auto"
              title={t('modals.project.editor_clear_formatting', 'Effacer la mise en page')}
            >
              <RemoveFormatting className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Zone éditeur contentEditable */}
        <div className="flex-1 flex flex-col min-h-0 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span>{t('modals.project.editor_content_label', 'Contenu et mise en forme :')}</span>
            <span
              className={`font-mono font-medium ${
                isOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'
              }`}
            >
              {charCount} / {effectiveMaxLength} {t('modals.project.editor_chars', 'car.')}
              {isOverLimit && ` (${t('modals.project.editor_over_limit', 'dépassement !')})`}
            </span>
          </div>

          <div
            ref={editorRef}
            contentEditable={!isReadOnly}
            suppressContentEditableWarning
            onInput={() => {
              setCharCount(computeTextLength());
              updateActiveFormats();
            }}
            onKeyUp={updateActiveFormats}
            onMouseUp={updateActiveFormats}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            data-placeholder={t('modals.project.long_text_modal_placeholder', 'Saisissez ici le texte détaillé de ce paramètre...')}
            className={`w-full flex-1 min-h-[220px] max-h-[360px] overflow-y-auto px-4 py-3 border rounded-lg text-sm leading-relaxed font-sans transition-colors [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 ${
              isReadOnly
                ? 'bg-slate-50 border-slate-300 text-slate-800 cursor-default'
                : 'bg-white border-slate-300 focus:border-2 focus:border-indigo-600 focus:outline-none text-slate-900 shadow-2xs'
            }`}
          />
        </div>

        {/* Pied de page avec boutons */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 shrink-0">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            {!isReadOnly && t('modals.project.editor_save_shortcut_hint', 'Raccourci : Ctrl+Entrée pour valider')}
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className={MODAL_CANCEL_BUTTON_CLASS}
            >
              {t('modals.common.cancel')}
            </button>
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isOverLimit}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                {t('modals.common.validate')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
