import React, { useState, useEffect } from 'react';
import {
  Coins,
  AlertCircle,
  Lock,
  Sparkles,
  Save,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BonusConfig, DEFAULT_BONUS_CONFIG } from '../types/bonus';
import { saveBonusConfig } from '../services/bonusService';

interface BonusSettingsCardProps {
  bonusConfig: BonusConfig;
  canManage: boolean;
  currentUserEmail?: string;
  roleLabel?: string;
}

export const BonusSettingsCard: React.FC<BonusSettingsCardProps> = ({
  bonusConfig,
  canManage,
  currentUserEmail = '',
  roleLabel = 'Value Management Officer ou Administrateur',
}) => {
  const { t } = useTranslation();
  // État local du formulaire
  const [isBonusActive, setIsBonusActive] = useState<boolean>(bonusConfig.isBonusActive);
  const [checkQuotas, setCheckQuotas] = useState<boolean>(bonusConfig.checkQuotas);
  const [maxBonusedProjects, setMaxBonusedProjects] = useState<string>(
    bonusConfig.maxBonusedProjects !== null && bonusConfig.maxBonusedProjects !== undefined
      ? String(bonusConfig.maxBonusedProjects)
      : '10'
  );
  const [maxBonusPointsPerProject, setMaxBonusPointsPerProject] = useState<string>(
    bonusConfig.maxBonusPointsPerProject !== null && bonusConfig.maxBonusPointsPerProject !== undefined
      ? String(bonusConfig.maxBonusPointsPerProject)
      : '5'
  );
  const [maxTotalBonusPoints, setMaxTotalBonusPoints] = useState<string>(
    bonusConfig.maxTotalBonusPoints !== null && bonusConfig.maxTotalBonusPoints !== undefined
      ? String(bonusConfig.maxTotalBonusPoints)
      : '30'
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Synchronisation avec les modifications distantes de Firestore
  useEffect(() => {
    setIsBonusActive(bonusConfig.isBonusActive);
    setCheckQuotas(bonusConfig.checkQuotas);
    if (bonusConfig.maxBonusedProjects !== null && bonusConfig.maxBonusedProjects !== undefined) {
      setMaxBonusedProjects(String(bonusConfig.maxBonusedProjects));
    }
    if (bonusConfig.maxBonusPointsPerProject !== null && bonusConfig.maxBonusPointsPerProject !== undefined) {
      setMaxBonusPointsPerProject(String(bonusConfig.maxBonusPointsPerProject));
    }
    if (bonusConfig.maxTotalBonusPoints !== null && bonusConfig.maxTotalBonusPoints !== undefined) {
      setMaxTotalBonusPoints(String(bonusConfig.maxTotalBonusPoints));
    }
  }, [bonusConfig]);

  // Sauvegarde globale des paramètres
  const handleSave = async (override?: Partial<BonusConfig>) => {
    if (!canManage) return;
    setSaving(true);
    setSaveError(null);

    const parsedMaxProjects = maxBonusedProjects === '' ? null : parseInt(maxBonusedProjects, 10);
    const parsedMaxPointsPerProject = maxBonusPointsPerProject === '' ? null : parseInt(maxBonusPointsPerProject, 10);
    const parsedMaxTotal = maxTotalBonusPoints === '' ? null : parseInt(maxTotalBonusPoints, 10);

    const newConfig: BonusConfig = {
      isBonusActive: override?.isBonusActive !== undefined ? override.isBonusActive : isBonusActive,
      checkQuotas: override?.checkQuotas !== undefined ? override.checkQuotas : checkQuotas,
      maxBonusedProjects:
        override?.maxBonusedProjects !== undefined ? override.maxBonusedProjects : parsedMaxProjects,
      maxBonusPointsPerProject:
        override?.maxBonusPointsPerProject !== undefined
          ? override.maxBonusPointsPerProject
          : parsedMaxPointsPerProject,
      maxTotalBonusPoints:
        override?.maxTotalBonusPoints !== undefined ? override.maxTotalBonusPoints : parsedMaxTotal,
    };

    try {
      await saveBonusConfig(newConfig, currentUserEmail);
    } catch (err: any) {
      setSaveError(err?.message || "Erreur lors de l'enregistrement des paramètres de bonus.");
    } finally {
      setSaving(false);
    }
  };

  // Basculement immédiat de "Bonus actifs"
  const handleToggleBonusActive = async () => {
    if (!canManage) return;
    const nextVal = !isBonusActive;
    setIsBonusActive(nextVal);
    await handleSave({ isBonusActive: nextVal });
  };

  // Basculement immédiat de "Vérification des quotas de bonus"
  const handleToggleCheckQuotas = async () => {
    if (!canManage) return;
    const nextVal = !checkQuotas;
    setCheckQuotas(nextVal);
    await handleSave({ checkQuotas: nextVal });
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      {/* En-tête de l'encart */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-teal-50/60 via-slate-50 to-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl border border-teal-200 shadow-2xs">
            <Coins className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {t('settings.bonus.title')}
              </h3>
              {!canManage && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>{t('settings.common.consult')} ({roleLabel})</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('settings.bonus.subtitle')}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? t('settings.common.saving') : t('settings.common.save')}</span>
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Contenu et paramètres */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Case à cocher "Bonus actifs" directement dans la frame Gestion des bonus */}
        <div
          onClick={canManage ? handleToggleBonusActive : undefined}
          className={`select-none ${canManage ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="checkbox-bonus-active"
              checked={isBonusActive}
              disabled={!canManage}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleBonusActive();
              }}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
            />
            <div className="flex-1">
              <label
                htmlFor="checkbox-bonus-active"
                className="text-sm font-bold text-slate-900 block cursor-pointer"
              >
                {t('settings.bonus.active_switch')}
              </label>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {isBonusActive ? (
                  <span className="text-teal-900 font-medium">
                    {t('settings.bonus.active_desc')}
                  </span>
                ) : (
                  <span className="text-slate-500">
                    {t('settings.bonus.active_desc')}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Encart Quotas de bonus avec la case à cocher "Vérification des quotas de bonus" directement à l'intérieur */}
        <div
          className={`p-4 sm:p-5 rounded-xl border transition-all space-y-4 ${
            checkQuotas
              ? 'bg-slate-50/50 border-slate-200'
              : 'bg-slate-100/60 border-slate-200/80 opacity-75'
          }`}
        >
          <div
            onClick={canManage ? handleToggleCheckQuotas : undefined}
            className={`select-none ${canManage ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="checkbox-bonus-quotas"
                checked={checkQuotas}
                disabled={!canManage}
                onChange={(e) => {
                  e.stopPropagation();
                  handleToggleCheckQuotas();
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
              />
              <div className="flex-1">
                <label
                  htmlFor="checkbox-bonus-quotas"
                  className="text-sm font-bold text-slate-900 block cursor-pointer"
                >
                  {t('settings.bonus.quotas_switch')}
                </label>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {checkQuotas ? (
                    <span className="text-indigo-900 font-medium">
                      {t('settings.bonus.quotas_desc')}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {t('settings.bonus.quotas_desc')}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Nombre maximum de projets bonussés */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 leading-tight">
                {t('settings.bonus.max_projects_label')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!checkQuotas || !canManage}
                  value={maxBonusedProjects}
                  onChange={(e) => setMaxBonusedProjects(e.target.value)}
                  onBlur={() => handleSave()}
                  placeholder="Ex : 10"
                  className={`w-full px-3 py-2 text-sm rounded-lg border font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    !checkQuotas || !canManage
                      ? 'bg-slate-200/60 border-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {t('settings.bonus.max_projects_desc')}
              </p>
            </div>

            {/* 2. Nombre de points de bonus maximum par projet */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 leading-tight">
                {t('settings.bonus.max_points_per_project_label')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!checkQuotas || !canManage}
                  value={maxBonusPointsPerProject}
                  onChange={(e) => setMaxBonusPointsPerProject(e.target.value)}
                  onBlur={() => handleSave()}
                  placeholder="Ex : 5"
                  className={`w-full px-3 py-2 text-sm rounded-lg border font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    !checkQuotas || !canManage
                      ? 'bg-slate-200/60 border-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {t('settings.bonus.max_points_per_project_desc')}
              </p>
            </div>

            {/* 3. Nombre total de points de bonus à distribuer sur l'ensemble des projets */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 leading-tight">
                {t('settings.bonus.max_total_points_label')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!checkQuotas || !canManage}
                  value={maxTotalBonusPoints}
                  onChange={(e) => setMaxTotalBonusPoints(e.target.value)}
                  onBlur={() => handleSave()}
                  placeholder="Ex : 30"
                  className={`w-full px-3 py-2 text-sm rounded-lg border font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    !checkQuotas || !canManage
                      ? 'bg-slate-200/60 border-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {t('settings.bonus.max_total_points_desc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
