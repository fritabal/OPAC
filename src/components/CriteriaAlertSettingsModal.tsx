import React, { useState, useEffect } from 'react';
import { X, Sliders, AlertCircle, Info, RotateCcw, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  CriteriaAlertConfig,
  DEFAULT_CRITERIA_ALERT_CONFIG,
  TOTAL_CRITERION_LEVELS_COUNT,
} from '../types/criteriaAlert';
import { PRIMARY_ACTION_BUTTON_CLASS } from '../constants/ui';

interface CriteriaAlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CriteriaAlertConfig;
  onSave: (newConfig: CriteriaAlertConfig) => Promise<void>;
  isAdmin?: boolean;
}

export const CriteriaAlertSettingsModal: React.FC<CriteriaAlertSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  isAdmin = true,
}) => {
  const { t } = useTranslation();
  const [singleLevelThreshold, setSingleLevelThreshold] = useState<number>(
    config.singleLevelThreshold ?? DEFAULT_CRITERIA_ALERT_CONFIG.singleLevelThreshold
  );
  const [cumulatedThreshold, setCumulatedThreshold] = useState<number>(
    config.cumulatedThreshold ?? DEFAULT_CRITERIA_ALERT_CONFIG.cumulatedThreshold
  );
  const [levelCountPercentThreshold, setLevelCountPercentThreshold] = useState<number>(
    config.levelCountPercentThreshold ?? DEFAULT_CRITERIA_ALERT_CONFIG.levelCountPercentThreshold
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Synchroniser quand la modal s'ouvre ou que la config externe change
  useEffect(() => {
    if (isOpen) {
      setSingleLevelThreshold(config.singleLevelThreshold ?? DEFAULT_CRITERIA_ALERT_CONFIG.singleLevelThreshold);
      setCumulatedThreshold(config.cumulatedThreshold ?? DEFAULT_CRITERIA_ALERT_CONFIG.cumulatedThreshold);
      setLevelCountPercentThreshold(
        config.levelCountPercentThreshold ?? DEFAULT_CRITERIA_ALERT_CONFIG.levelCountPercentThreshold
      );
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  // Calcul du nombre effectif de niveaux max autorisés selon le pourcentage renseigné
  const calculatedMaxLevels = Math.max(
    1,
    Math.round((levelCountPercentThreshold / 100) * TOTAL_CRITERION_LEVELS_COUNT)
  );

  const levelsWord = calculatedMaxLevels <= 1
    ? t('common.words.level_one')
    : t('common.words.level_other');

  const handleResetDefaults = () => {
    setSingleLevelThreshold(DEFAULT_CRITERIA_ALERT_CONFIG.singleLevelThreshold);
    setCumulatedThreshold(DEFAULT_CRITERIA_ALERT_CONFIG.cumulatedThreshold);
    setLevelCountPercentThreshold(DEFAULT_CRITERIA_ALERT_CONFIG.levelCountPercentThreshold);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError(t('settings.criteria.alerts.access_denied'));
      return;
    }

    // Validation des valeurs numériques
    if (isNaN(singleLevelThreshold) || singleLevelThreshold < 1 || singleLevelThreshold > 100) {
      setError(t('settings.criteria.alerts.validation_error_1'));
      return;
    }
    if (isNaN(cumulatedThreshold) || cumulatedThreshold < 1 || cumulatedThreshold > 100) {
      setError(t('settings.criteria.alerts.validation_error_cumulated'));
      return;
    }
    if (isNaN(levelCountPercentThreshold) || levelCountPercentThreshold < 1 || levelCountPercentThreshold > 100) {
      setError(t('settings.criteria.alerts.validation_error_nb'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({
        singleLevelThreshold: Math.round(singleLevelThreshold),
        cumulatedThreshold: Math.round(cumulatedThreshold),
        levelCountPercentThreshold: Math.round(levelCountPercentThreshold),
      });
      setSuccessMessage(t('settings.criteria.alerts.save_success'));
      setTimeout(() => {
        onClose();
      }, 350);
    } catch (err: any) {
      console.error("Erreur enregistrement paramètres d'alerte critères:", err);
      setError(t('settings.criteria.alerts.save_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête de la modale */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 shrink-0 mt-0.5">
              <Sliders className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {t('settings.criteria.alerts.modal_title')}
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {t('settings.criteria.alerts.modal_subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire des paramètres */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Paramètre 1 : % d'alerte pour 1 valeur */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="pct-1-val"
                  className="text-xs font-bold text-slate-900 uppercase tracking-wider"
                >
                  {t('settings.criteria.alerts.pct_1_val_label')}
                </label>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <input
                    type="number"
                    id="pct-1-val"
                    min="1"
                    max="100"
                    step="1"
                    required
                    value={singleLevelThreshold}
                    onChange={(e) => setSingleLevelThreshold(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-right text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <span className="text-xs font-bold text-slate-700">%</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                {t('settings.criteria.alerts.pct_1_val_desc')}
              </p>
            </div>

            {/* Paramètre 2 : % d'alerte pour l'ensemble des valeurs */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="pct-toutes-val"
                  className="text-xs font-bold text-slate-900 uppercase tracking-wider"
                >
                  {t('settings.criteria.alerts.pct_toutes_val_label')}
                </label>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <input
                    type="number"
                    id="pct-toutes-val"
                    min="1"
                    max="100"
                    step="1"
                    required
                    value={cumulatedThreshold}
                    onChange={(e) => setCumulatedThreshold(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-right text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <span className="text-xs font-bold text-slate-700">%</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                {t('settings.criteria.alerts.pct_toutes_val_desc')}
              </p>
            </div>

            {/* Paramètre 3 : % d'alerte nb valeurs */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="pct-nb-val"
                  className="text-xs font-bold text-slate-900 uppercase tracking-wider"
                >
                  {t('settings.criteria.alerts.pct_nb_val_label')}
                </label>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <input
                    type="number"
                    id="pct-nb-val"
                    min="1"
                    max="100"
                    step="1"
                    required
                    value={levelCountPercentThreshold}
                    onChange={(e) => setLevelCountPercentThreshold(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-right text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <span className="text-xs font-bold text-slate-700">%</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                {t('settings.criteria.alerts.pct_nb_val_desc', {
                  totalLevels: TOTAL_CRITERION_LEVELS_COUNT,
                  maxLevels: calculatedMaxLevels,
                  levelsWord,
                  levelWords: levelsWord,
                  levels: levelsWord,
                  pct: levelCountPercentThreshold,
                  rawCalculated: ((levelCountPercentThreshold * TOTAL_CRITERION_LEVELS_COUNT) / 100).toFixed(2),
                })}
              </p>
            </div>
          </div>

          {/* Encart récapitulatif & exemple concret */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{t('settings.criteria.alerts.rule_summary_title')}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-900">
              {t('settings.criteria.alerts.rule_summary_desc')}
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-950 pl-1">
              <li>
                {t('settings.criteria.alerts.rule_summary_item1', {
                  threshold: singleLevelThreshold,
                })}
              </li>
              <li>
                {t('settings.criteria.alerts.rule_summary_item2', {
                  maxLevels: calculatedMaxLevels,
                  levelsWord,
                  levelWords: levelsWord,
                  levels: levelsWord,
                  threshold: cumulatedThreshold,
                })}
              </li>
            </ul>
          </div>

          {/* Actions au bas de la modale */}
          <div className="pt-2 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('settings.criteria.alerts.reset_defaults')}</span>
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('settings.common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${PRIMARY_ACTION_BUTTON_CLASS} px-4 py-2 text-xs`}
              >
                {saving ? t('settings.common.saving') : t('settings.common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
