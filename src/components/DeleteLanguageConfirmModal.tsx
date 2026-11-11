import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { LanguageItem, getLocalizedLanguageName } from '../i18n';
import { LanguageFlag } from './Flags';
import { MODAL_CANCEL_BUTTON_CLASS, MODAL_TITLE_CLASS } from '../constants/ui';

interface DeleteLanguageConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageItem | null;
  onConfirmDelete: (code: string) => Promise<void>;
}

export const DeleteLanguageConfirmModal: React.FC<DeleteLanguageConfirmModalProps> = ({
  isOpen,
  onClose,
  language,
  onConfirmDelete,
}) => {
  const { t } = useTranslation();
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setError(null);
      setIsDeleting(false);
    }
  }, [isOpen, language]);

  if (!isOpen || !language) return null;

  const confirmKeyword = t('settings.internationalization.delete_lang.confirm_keyword', 'SUPPRIMER').toUpperCase();
  const inputUpper = confirmInput.trim().toUpperCase();
  const isConfirmed =
    inputUpper === confirmKeyword ||
    inputUpper === 'SUPPRIMER' ||
    inputUpper === 'DELETE' ||
    inputUpper === 'ELIMINA' ||
    inputUpper === 'LÖSCHEN';

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirmDelete(language.code);
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          t('settings.internationalization.delete_lang.error', 'Erreur lors de la suppression de la langue.')
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5 text-rose-600">
            <div className="p-2 bg-rose-100 rounded-xl">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className={`${MODAL_TITLE_CLASS} text-slate-900 flex items-center gap-2`}>
                <span>
                  {t('settings.internationalization.delete_lang.title', 'Supprimer la langue')}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                  <LanguageFlag code={language.code} className="w-4 h-3" />
                  <span>{language.nativeLabel}</span>
                  <span className="text-slate-400 font-normal">({getLocalizedLanguageName(language.code, t)})</span>
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {t(
                  'settings.internationalization.delete_lang.subtitle',
                  "Suppression définitive de la langue de l'application"
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label={t('modals.common.close', 'Fermer')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="py-4 space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {t('settings.internationalization.delete_lang.warning_title', 'Action irréversible')}
              </p>
              <p className="mt-1 text-rose-800">
                {t(
                  'settings.internationalization.delete_lang.warning_desc',
                  'La colonne correspondante sera retirée du tableau et l’ensemble des traductions personnalisées pour cette langue seront effacées.'
                )}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('settings.internationalization.delete_lang.confirm_instruction', {
                keyword: confirmKeyword,
                defaultValue: `Pour confirmer la suppression, veuillez saisir le mot « ${confirmKeyword} » :`,
              })}
            </label>
            <input
              type="text"
              autoFocus
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmKeyword}
              disabled={isDeleting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={MODAL_CANCEL_BUTTON_CLASS}
          >
            {t('common.cancel', 'Annuler')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className={`px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-all ${
              isConfirmed && !isDeleting
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-sm cursor-pointer'
                : 'bg-rose-300 text-rose-100 cursor-not-allowed'
            }`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('settings.internationalization.delete_lang.deleting', 'Suppression en cours...')}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{t('settings.internationalization.delete_lang.confirm_btn', 'Supprimer la langue')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
