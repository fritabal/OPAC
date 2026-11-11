import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Globe, Search, Plus, Check, CheckSquare, Square } from 'lucide-react';
import {
  AVAILABLE_LANGUAGES_CATALOG,
  LanguageItem,
  getLocalizedLanguageName,
} from '../i18n';
import { LanguageFlag } from './Flags';
import {
  MODAL_CANCEL_BUTTON_CLASS,
  PRIMARY_ACTION_MODAL_BUTTON_CLASS,
  MODAL_TITLE_CLASS,
} from '../constants/ui';
import { SearchFilterInput } from './SearchFilterInput';

interface AddLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLanguageCodes: string[];
  onSelectLanguages: (languages: LanguageItem[]) => void;
}

export const AddLanguageModal: React.FC<AddLanguageModalProps> = ({
  isOpen,
  onClose,
  activeLanguageCodes,
  onSelectLanguages,
}) => {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // Réinitialiser la sélection à l'ouverture de la modale
  useEffect(() => {
    if (isOpen) {
      setSelectedCodes(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  const activeSet = useMemo(() => {
    return new Set(activeLanguageCodes.map((c) => c.toLowerCase()));
  }, [activeLanguageCodes]);

  // Filtrage et tri alphabétique selon le nom dans la langue courante de l'interface
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = AVAILABLE_LANGUAGES_CATALOG.filter((lang) => {
      if (!q) return true;
      const localizedName = getLocalizedLanguageName(lang.code, t).toLowerCase();
      return (
        lang.nativeLabel.toLowerCase().includes(q) ||
        lang.label.toLowerCase().includes(q) ||
        localizedName.includes(q) ||
        lang.code.toLowerCase().includes(q) ||
        lang.abbr.toLowerCase().includes(q)
      );
    });

    // Tri alphabétique basé sur le nom traduit dans la langue de l'interface
    return list.slice().sort((a, b) => {
      const nameA = getLocalizedLanguageName(a.code, t);
      const nameB = getLocalizedLanguageName(b.code, t);
      return nameA.localeCompare(nameB, i18n.language || 'fr', { sensitivity: 'base' });
    });
  }, [searchQuery, t, i18n.language]);

  // Langues disponibles sélectionnables (non encore actives) dans le filtre actuel
  const availableInFilter = useMemo(() => {
    return filteredLanguages.filter((l) => !activeSet.has(l.code.toLowerCase()));
  }, [filteredLanguages, activeSet]);

  if (!isOpen) return null;

  const toggleSelect = (code: string) => {
    const lower = code.toLowerCase();
    if (activeSet.has(lower)) return;
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      availableInFilter.forEach((l) => next.add(l.code.toLowerCase()));
      return next;
    });
  };

  const handleDeselectAllVisible = () => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      availableInFilter.forEach((l) => next.delete(l.code.toLowerCase()));
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedCodes.size === 0) return;
    const selectedList = AVAILABLE_LANGUAGES_CATALOG.filter((l) =>
      selectedCodes.has(l.code.toLowerCase()) && !activeSet.has(l.code.toLowerCase())
    );
    if (selectedList.length > 0) {
      onSelectLanguages(selectedList);
    }
  };

  const selectedCount = selectedCodes.size;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* En-tête de la modale */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 shadow-2xs">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className={`${MODAL_TITLE_CLASS} text-slate-900`}>
                {t('settings.internationalization.add_lang_modal.title', 'Ajouter une nouvelle langue')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {t(
                  'settings.internationalization.add_lang_modal.subtitle_multi',
                  "Cochez une ou plusieurs langues à intégrer dans l'application avec traduction automatique."
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label={t('modals.common.close', 'Fermer')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de recherche et actions de sélection rapide */}
        <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <SearchFilterInput
              autoFocus
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder={t(
                'settings.internationalization.add_lang_modal.search_placeholder',
                'Rechercher une langue par son nom ou son code (ex: Español, Português, ES, IT...)'
              )}
            />
          </div>

          {availableInFilter.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title={t('settings.internationalization.add_lang_modal.select_all_title', 'Cocher toutes les langues affichées')}
              >
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('settings.internationalization.add_lang_modal.select_all', 'Tout cocher')}</span>
              </button>

              {selectedCodes.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAllVisible}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title={t('settings.internationalization.add_lang_modal.deselect_all_title', 'Décocher les langues')}
                >
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('settings.internationalization.add_lang_modal.deselect_all', 'Tout décocher')}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Grille sur plusieurs colonnes des langues possibles */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-[300px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {filteredLanguages.map((lang) => {
              const isAlreadyActive = activeSet.has(lang.code.toLowerCase());
              const isSelected = selectedCodes.has(lang.code.toLowerCase());

              return (
                <div
                  key={lang.code}
                  role="button"
                  tabIndex={isAlreadyActive ? -1 : 0}
                  onClick={() => toggleSelect(lang.code)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleSelect(lang.code);
                    }
                  }}
                  title={
                    isAlreadyActive
                      ? t('settings.internationalization.add_lang_modal.already_active', 'Déjà active')
                      : undefined
                  }
                  className={`p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all select-none ${
                    isAlreadyActive
                      ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-300/80 shadow-2xs cursor-pointer'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/80 shadow-2xs cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <LanguageFlag code={lang.code} className="w-6 h-4 shadow-2xs" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                        {lang.nativeLabel}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span>{getLocalizedLanguageName(lang.code, t)}</span>
                        <span className="font-mono text-slate-400 text-[10px] font-semibold">
                          ({lang.abbr})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Case à cocher carrée pour sélection multiple */}
                  <div className="shrink-0">
                    {isAlreadyActive ? (
                      <div
                        className="w-5 h-5 rounded-md bg-slate-200 text-slate-600 flex items-center justify-center border border-slate-300 shadow-2xs cursor-not-allowed"
                        title={t('settings.internationalization.add_lang_modal.already_active', 'Déjà active')}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    ) : isSelected ? (
                      <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center border border-blue-600 shadow-2xs transition-transform active:scale-90">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white hover:border-blue-400 transition-colors" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredLanguages.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              {t('settings.internationalization.add_lang_modal.no_match', 'Aucune langue ne correspond à votre recherche.')}
            </div>
          )}
        </div>

        {/* Pied de page sans encart redondant en bas à gauche */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className={MODAL_CANCEL_BUTTON_CLASS}
          >
            {t('common.cancel', 'Annuler')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className={`${PRIMARY_ACTION_MODAL_BUTTON_CLASS} flex items-center gap-1.5`}
          >
            <Plus className="w-4 h-4" />
            <span>
              {selectedCount > 1
                ? `${t('settings.internationalization.add_lang_modal.add_btn', 'Ajouter et traduire')} (${selectedCount})`
                : selectedCount === 1
                ? `${t('settings.internationalization.add_lang_modal.add_btn', 'Ajouter et traduire')} (1)`
                : t('settings.internationalization.add_lang_modal.add_btn', 'Ajouter et traduire')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
