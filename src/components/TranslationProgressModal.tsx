import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, AlertTriangle, CheckCircle2, RotateCcw, FileText } from 'lucide-react';
import { LanguageItem, getLocalizedLanguageName } from '../i18n';
import { LanguageFlag } from './Flags';
import { TranslationProgress } from '../services/autoTranslateService';
import {
  MODAL_CANCEL_BUTTON_CLASS,
  MODAL_TITLE_CLASS,
} from '../constants/ui';

export type LanguageInstallItemStatus = 'waiting' | 'translating' | 'success' | 'error';

export interface LanguageProgressItem {
  language: LanguageItem;
  status: LanguageInstallItemStatus;
  progress: TranslationProgress;
  errorMessage?: string;
}

export type TranslationModalStatus = 'translating' | 'error' | 'success';

interface TranslationProgressModalProps {
  isOpen: boolean;
  status: TranslationModalStatus;
  items?: LanguageProgressItem[];
  language?: LanguageItem | null;
  progress?: TranslationProgress;
  errorMessage?: string;
  onRetry: () => void;
  onContinueWithDefault: () => void;
  onCancel: () => void;
}

export const TranslationProgressModal: React.FC<TranslationProgressModalProps> = ({
  isOpen,
  status,
  items = [],
  language,
  progress,
  errorMessage,
  onRetry,
  onContinueWithDefault,
  onCancel,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // Harmonisation de la liste des langues à afficher
  const displayItems: LanguageProgressItem[] =
    items.length > 0
      ? items
      : language
      ? [
          {
            language,
            status: status === 'translating' ? 'translating' : status === 'error' ? 'error' : 'success',
            progress: progress || { current: 0, total: 100, percentage: 0 },
            errorMessage,
          },
        ]
      : [];

  if (displayItems.length === 0) return null;

  const totalCount = displayItems.length;
  const completedCount = displayItems.filter((i) => i.status === 'success').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95 duration-150 flex flex-col">
        {/* État 1 : Traduction en cours avec pictogramme horloge unique tournante */}
        {status === 'translating' && (
          <div className="flex flex-col items-center text-center py-2">
            {/* Un seul pictogramme d'horloge tournante */}
            <div className="mb-3.5 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 shadow-inner">
                <Clock className="w-7 h-7 text-blue-600 animate-[spin_4s_linear_infinite]" />
              </div>
            </div>

            <h3 className={`${MODAL_TITLE_CLASS} text-slate-900`}>
              {totalCount > 1
                ? t(
                    'settings.internationalization.translating_modal.multi_title',
                    'Installation et traduction des langues...'
                  )
                : t(
                    'settings.internationalization.translating_modal.title',
                    'Traduction en cours...'
                  )}
            </h3>

            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {totalCount > 1
                ? t(
                    'settings.internationalization.translating_modal.multi_desc',
                    'Traduction automatique progressive de l’ensemble des libellés ({{completed}} sur {{total}} terminées).',
                    { completed: completedCount, total: totalCount }
                  )
                : t(
                    'settings.internationalization.translating_modal.desc',
                    'Traduction automatique et initialisation des libellés vers le {{lang}}.',
                    { lang: displayItems[0].language.nativeLabel }
                  )}
            </p>

            {/* Liste montrant la progression successive sur chaque langue */}
            <div className="w-full mt-5 space-y-2 max-h-[42vh] overflow-y-auto pr-0.5 text-left [scrollbar-width:thin]">
              {displayItems.map((item) => {
                const isTranslating = item.status === 'translating';
                const isSuccess = item.status === 'success';
                const isError = item.status === 'error';
                const isWaiting = item.status === 'waiting';

                return (
                  <div
                    key={item.language.code}
                    className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                      isTranslating
                        ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-200/80 shadow-2xs'
                        : isSuccess
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : isError
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-slate-50/60 border-slate-200 text-slate-500 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <LanguageFlag code={item.language.code} className="w-5 h-3.5 shadow-2xs shrink-0" />
                        <div className="min-w-0 truncate">
                          <span className="text-xs font-bold text-slate-800">
                            {item.language.nativeLabel}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-1.5 font-normal">
                            ({getLocalizedLanguageName(item.language.code, t)})
                          </span>
                        </div>
                      </div>

                      {/* Indicateurs d'état à droite */}
                      <div className="shrink-0">
                        {isWaiting && (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded-full border border-slate-300/80 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{t('settings.internationalization.translating_modal.status_waiting', 'En attente')}</span>
                          </span>
                        )}

                        {isTranslating && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-blue-600 animate-[spin_3s_linear_infinite]" />
                            <span>{t('settings.internationalization.translating_modal.in_progress', 'En cours...')}</span>
                          </span>
                        )}

                        {isSuccess && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{t('settings.internationalization.translating_modal.status_done', 'Terminé')}</span>
                          </span>
                        )}

                        {isError && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>{t('settings.internationalization.translating_modal.status_failed', 'Échec')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barre de progression avec boîte de couleur du pourcentage au plus près de l'axe */}
                    {isTranslating && (
                      <div className="w-full pt-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1.5">
                          <span>
                            {item.progress.current} / {item.progress.total}{' '}
                            {t('settings.internationalization.key_other', 'clés')}
                          </span>
                          {/* Boîte de couleur avec le % au plus près de l'axe */}
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                            {item.progress.percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden shadow-inner">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-150 ease-out"
                            style={{ width: `${item.progress.percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping inline-block" />
              <span>
                {t(
                  'settings.internationalization.translating_modal.wait_hint',
                  'Veuillez patienter pendant le traitement des libellés...'
                )}
              </span>
            </div>
          </div>
        )}

        {/* État 2 : Impossible d'accéder au service de traduction (hors ligne ou restriction) */}
        {status === 'error' && (
          <div className="flex flex-col py-1">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className={`${MODAL_TITLE_CLASS} text-slate-900`}>
                  {t('settings.internationalization.translating_modal.error_title', 'Service de traduction inaccessible')}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {errorMessage ||
                    t(
                      'settings.internationalization.translating_modal.error_desc',
                      "Impossible d'accéder au service Google Traduction (connexion Internet indisponible ou restrictions d'accès réseau)."
                    )}
                </p>
              </div>
            </div>

            {/* Liste avec le statut d'erreur des langues concernées */}
            <div className="space-y-1.5 mb-4 max-h-[30vh] overflow-y-auto">
              {displayItems.map((item) => (
                <div
                  key={item.language.code}
                  className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <LanguageFlag code={item.language.code} className="w-4 h-3 shadow-2xs" />
                    <span className="font-semibold text-slate-800">{item.language.nativeLabel}</span>
                    <span className="text-slate-500 font-normal">
                      ({getLocalizedLanguageName(item.language.code, t)})
                    </span>
                  </div>
                  <div>
                    {item.status === 'success' ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{t('settings.internationalization.translating_modal.status_done', 'Terminé')}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>{t('settings.internationalization.translating_modal.status_failed', 'Échec')}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mb-5 space-y-1.5 leading-relaxed">
              <p className="font-semibold">
                {t('settings.internationalization.translating_modal.options_title', 'Que souhaitez-vous faire ?')}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-amber-800">
                <li>
                  {t(
                    'settings.internationalization.translating_modal.option_default_hint',
                    'Ajouter tout de même la ou les langues manquantes avec les textes source (français) sans écraser les langues déjà traduites.'
                  )}
                </li>
                <li>
                  {t(
                    'settings.internationalization.translating_modal.option_retry_hint',
                    'Vérifier la connexion réseau et relancer la tentative de traduction.'
                  )}
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onContinueWithDefault}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>
                  {t(
                    'settings.internationalization.translating_modal.continue_default_btn',
                    'Ajouter avec les clés par défaut (Français)'
                  )}
                </span>
              </button>

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={onCancel}
                  className={`flex-1 ${MODAL_CANCEL_BUTTON_CLASS}`}
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('settings.internationalization.translating_modal.retry_btn', 'Réessayer')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* État 3 : Succès complet */}
        {status === 'success' && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3 shadow-2xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className={`${MODAL_TITLE_CLASS} text-slate-900`}>
              {totalCount > 1
                ? t('settings.internationalization.translating_modal.success_multi_title', 'Langues ajoutées avec succès !')
                : t('settings.internationalization.translating_modal.success_title', 'Langue ajoutée avec succès !')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {totalCount > 1
                ? t(
                    'settings.internationalization.translating_modal.success_multi_desc',
                    'Les {{count}} langues ont été insérées dans le tableau et pré-remplies avec l’ensemble de leurs traductions.',
                    { count: totalCount }
                  )
                : t(
                    'settings.internationalization.translating_modal.success_desc',
                    'La colonne pour le {{lang}} a été insérée dans le tableau et pré-remplie avec l’ensemble des traductions.',
                    { lang: displayItems[0].language.nativeLabel }
                  )}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-sm">
              {displayItems.map((item) => (
                <span
                  key={item.language.code}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-1.5"
                >
                  <LanguageFlag code={item.language.code} className="w-4 h-3 shadow-2xs" />
                  <span>{item.language.nativeLabel}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
