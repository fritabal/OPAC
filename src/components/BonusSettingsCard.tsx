import React, { useState, useEffect, useMemo } from 'react';
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
import {
  CHECKBOX_INPUT_CLASS,
  CHECKBOX_TITLE_CLASS,
  CHECKBOX_DESCRIPTION_CLASS,
  UNSAVED_CHANGES_TEXT_CLASS,
  getSaveButtonStateClass,
} from '../constants/ui';

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

  // Valeurs initiales sauvegardées comme référence
  const [savedBaseline, setSavedBaseline] = useState({
    isBonusActive: Boolean(bonusConfig.isBonusActive),
    checkQuotas: Boolean(bonusConfig.checkQuotas),
    maxBonusedProjects:
      bonusConfig.maxBonusedProjects !== null && bonusConfig.maxBonusedProjects !== undefined
        ? String(bonusConfig.maxBonusedProjects)
        : '10',
    maxBonusPointsPerProject:
      bonusConfig.maxBonusPointsPerProject !== null && bonusConfig.maxBonusPointsPerProject !== undefined
        ? String(bonusConfig.maxBonusPointsPerProject)
        : '5',
    maxTotalBonusPoints:
      bonusConfig.maxTotalBonusPoints !== null && bonusConfig.maxTotalBonusPoints !== undefined
        ? String(bonusConfig.maxTotalBonusPoints)
        : '30',
  });

  // État local du formulaire
  const [isBonusActive, setIsBonusActive] = useState<boolean>(Boolean(bonusConfig.isBonusActive));
  const [checkQuotas, setCheckQuotas] = useState<boolean>(Boolean(bonusConfig.checkQuotas));
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
    const newBaseline = {
      isBonusActive: Boolean(bonusConfig.isBonusActive),
      checkQuotas: Boolean(bonusConfig.checkQuotas),
      maxBonusedProjects:
        bonusConfig.maxBonusedProjects !== null && bonusConfig.maxBonusedProjects !== undefined
          ? String(bonusConfig.maxBonusedProjects)
          : '10',
      maxBonusPointsPerProject:
        bonusConfig.maxBonusPointsPerProject !== null && bonusConfig.maxBonusPointsPerProject !== undefined
          ? String(bonusConfig.maxBonusPointsPerProject)
          : '5',
      maxTotalBonusPoints:
        bonusConfig.maxTotalBonusPoints !== null && bonusConfig.maxTotalBonusPoints !== undefined
          ? String(bonusConfig.maxTotalBonusPoints)
          : '30',
    };
    setSavedBaseline(newBaseline);
    setIsBonusActive(newBaseline.isBonusActive);
    setCheckQuotas(newBaseline.checkQuotas);
    setMaxBonusedProjects(newBaseline.maxBonusedProjects);
    setMaxBonusPointsPerProject(newBaseline.maxBonusPointsPerProject);
    setMaxTotalBonusPoints(newBaseline.maxTotalBonusPoints);
  }, [bonusConfig]);

  // Détection des modifications non enregistrées
  const isModified = useMemo(() => {
    if (isBonusActive !== savedBaseline.isBonusActive) return true;
    if (checkQuotas !== savedBaseline.checkQuotas) return true;
    if (maxBonusedProjects !== savedBaseline.maxBonusedProjects) return true;
    if (maxBonusPointsPerProject !== savedBaseline.maxBonusPointsPerProject) return true;
    if (maxTotalBonusPoints !== savedBaseline.maxTotalBonusPoints) return true;
    return false;
  }, [
    isBonusActive,
    checkQuotas,
    maxBonusedProjects,
    maxBonusPointsPerProject,
    maxTotalBonusPoints,
    savedBaseline,
  ]);

  // Sauvegarde globale des paramètres au clic sur le bouton
  const handleSave = async () => {
    if (!canManage || !isModified || saving) return;
    setSaving(true);
    setSaveError(null);

    const parsedMaxProjects = maxBonusedProjects === '' ? null : parseInt(maxBonusedProjects, 10);
    const parsedMaxPointsPerProject = maxBonusPointsPerProject === '' ? null : parseInt(maxBonusPointsPerProject, 10);
    const parsedMaxTotal = maxTotalBonusPoints === '' ? null : parseInt(maxTotalBonusPoints, 10);

    const newConfig: BonusConfig = {
      isBonusActive,
      checkQuotas,
      maxBonusedProjects: parsedMaxProjects,
      maxBonusPointsPerProject: parsedMaxPointsPerProject,
      maxTotalBonusPoints: parsedMaxTotal,
    };

    try {
      await saveBonusConfig(newConfig, currentUserEmail);
      // Met à jour la baseline immédiatement pour repasser en non modifié
      setSavedBaseline({
        isBonusActive,
        checkQuotas,
        maxBonusedProjects,
        maxBonusPointsPerProject,
        maxTotalBonusPoints,
      });
    } catch (err: any) {
      setSaveError(err?.message || "Erreur lors de l'enregistrement des paramètres de bonus.");
    } finally {
      setSaving(false);
    }
  };

  // Basculement de "Bonus actifs" sans sauvegarde automatique
  const handleToggleBonusActive = () => {
    if (!canManage) return;
    setIsBonusActive((prev) => !prev);
  };

  // Basculement de "Vérification des quotas de bonus" sans sauvegarde automatique
  const handleToggleCheckQuotas = () => {
    if (!canManage) return;
    setCheckQuotas((prev) => !prev);
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
          <div className="flex items-center gap-3">
            {isModified && (
              <span className={UNSAVED_CHANGES_TEXT_CLASS}>
                {t('profile.unsaved_changes', 'Modifications non enregistrées')}
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!isModified || saving}
              className={`px-3.5 py-1.5 text-xs flex items-center gap-1.5 ${getSaveButtonStateClass(isModified, saving)}`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? t('settings.common.saving', 'Enregistrement...') : t('settings.common.save', 'Enregistrer')}</span>
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
          className={`select-none group ${canManage ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
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
              className={`mt-0.5 ${CHECKBOX_INPUT_CLASS}`}
            />
            <div className="flex-1">
              <label
                htmlFor="checkbox-bonus-active"
                className={`block ${CHECKBOX_TITLE_CLASS}`}
              >
                {t('settings.bonus.active_switch')}
              </label>
              <p className={`mt-0.5 ${CHECKBOX_DESCRIPTION_CLASS}`}>
                {t('settings.bonus.active_desc')}
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
            className={`select-none group ${canManage ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
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
                className={`mt-0.5 ${CHECKBOX_INPUT_CLASS}`}
              />
              <div className="flex-1">
                <label
                  htmlFor="checkbox-bonus-quotas"
                  className={`block ${CHECKBOX_TITLE_CLASS}`}
                >
                  {t('settings.bonus.quotas_switch')}
                </label>
                <p className={`mt-0.5 ${CHECKBOX_DESCRIPTION_CLASS}`}>
                  {t('settings.bonus.quotas_desc')}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isModified && !saving) {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isModified && !saving) {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isModified && !saving) {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
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
