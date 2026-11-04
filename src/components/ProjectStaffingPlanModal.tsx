import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge, X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Project } from '../types/project';
import { KeySkill } from '../types/skill';
import { getRolling12Months } from '../types/resource';
import { Tooltip } from './Tooltip';
import {
  MODAL_CANCEL_BUTTON_CLASS,
  PRIMARY_ACTION_MODAL_BUTTON_CLASS,
  TABLE_FROZEN_DIVIDER_CLASS,
  TABLE_FROZEN_DIVIDER_LEFT_CLASS,
  TABLE_HEADER_THEAD_CLASS,
  TABLE_TH_BASE_CLASS,
  MODAL_TITLE_CLASS,
  PROJECT_TITLE_CLASS,
} from '../constants/ui';
import { updateProjectStaffingPlan } from '../services/projectService';

interface ProjectStaffingPlanModalProps {
  isOpen: boolean;
  project: Project | null;
  skills: KeySkill[];
  nextMonthKey: string;
  onClose: () => void;
  onSaved?: () => void;
}

export const ProjectStaffingPlanModal: React.FC<ProjectStaffingPlanModalProps> = ({
  isOpen,
  project,
  skills,
  nextMonthKey,
  onClose,
  onSaved,
}) => {
  const { t, i18n } = useTranslation();

  // 12 mois glissants à compter du mois en cours
  const rollingMonths = useMemo(() => {
    return getRolling12Months(new Date(), i18n.language);
  }, [i18n.language]);

  // État local des jours demandés : [monthKey][skillId] -> number | null
  const [daysState, setDaysState] = useState<Record<string, Record<string, number | null>>>({});

  // État local pour le Reste à Terminaison : [skillId] -> number | null
  const [ratState, setRatState] = useState<Record<string, number | null>>({});

  // Saisie brute de la cellule RAT pour permettre la saisie et suppression sans blocage
  const [ratRawInputs, setRatRawInputs] = useState<Record<string, string>>({});

  // Suivi des erreurs de validation du RAT par compétence (validé seulement après Enter ou Enregistrement)
  const [ratErrors, setRatErrors] = useState<Record<string, boolean>>({});

  // Indicateur si l'utilisateur a explicitement saisi un RAT personnalisé (différent de la somme auto)
  const [customRatFlags, setCustomRatFlags] = useState<Record<string, boolean>>({});

  // État des cases à cocher par mois : [monthKey] -> boolean (signifiant que la demande a bien été renseignée)
  const [validatedMonths, setValidatedMonths] = useState<Record<string, boolean>>({});

  // État de la case à cocher pour le Reste à Terminaison (RAT)
  const [isRatValidated, setIsRatValidated] = useState<boolean>(false);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialisation à l'ouverture du modal avec les données du projet
  useEffect(() => {
    if (!isOpen || !project) return;

    // Initialiser les demandes mensuelles
    const initialDays: Record<string, Record<string, number | null>> = {};
    const existingPlan = project.staffingPlan || {};

    rollingMonths.forEach((m) => {
      initialDays[m.key] = {};
      const monthDemands = existingPlan[m.key] || {};

      skills.forEach((skill) => {
        let val: number | null = null;
        if (monthDemands[skill.id] !== undefined && monthDemands[skill.id] !== null) {
          val = Number(monthDemands[skill.id]);
        } else if (m.key === nextMonthKey && project.capacityDaysPerSkill?.[skill.id] !== undefined) {
          // Rétrocompatibilité / synchronisation avec les données du mois à venir saisies dans le tableau principal
          const cVal = project.capacityDaysPerSkill[skill.id];
          val = cVal !== null && cVal !== undefined ? Number(cVal) : null;
        }
        initialDays[m.key][skill.id] = val !== null && !isNaN(val) && val >= 0 ? val : null;
      });
    });

    setDaysState(initialDays);

    // Initialiser les cases à cocher de confirmation de renseignement par mois (et RAT)
    const initialValidated: Record<string, boolean> = {};
    const existingValidated = project.staffingPlanValidatedMonths || {};
    rollingMonths.forEach((m) => {
      initialValidated[m.key] = Boolean(existingValidated[m.key]);
    });
    // Considérer le RAT comme un mois en terme de persistance
    const ratValidated = Boolean(existingValidated['rat'] ?? project.isRatValidated);
    initialValidated['rat'] = ratValidated;
    setValidatedMonths(initialValidated);
    setIsRatValidated(ratValidated);

    // Initialiser les RAT :
    // Règle métier : si la colonne RAT n'est pas cochée, recalculer ce RAT en sommant ce qui se trouve dans les 12 mois à côté
    const initialRat: Record<string, number | null> = {};
    const initialFlags: Record<string, boolean> = {};
    const initialRaw: Record<string, string> = {};
    const initialErrors: Record<string, boolean> = {};
    const existingRat = project.remainingToComplete || {};

    skills.forEach((skill) => {
      // Calcul de la somme des 12 mois pour cette compétence
      let sum12 = 0;
      rollingMonths.forEach((m) => {
        const d = initialDays[m.key]?.[skill.id];
        if (typeof d === 'number' && !isNaN(d) && d > 0) {
          sum12 += d;
        }
      });
      sum12 = Math.round(sum12 * 10) / 10;

      if (ratValidated) {
        // La colonne RAT EST cochée : on charge les données enregistrées
        if (existingRat[skill.id] !== undefined && existingRat[skill.id] !== null) {
          const storedRat = Number(existingRat[skill.id]);
          if (!isNaN(storedRat)) {
            initialRat[skill.id] = storedRat;
            initialFlags[skill.id] = true;
            initialRaw[skill.id] = String(storedRat);
          } else {
            initialRat[skill.id] = sum12;
            initialFlags[skill.id] = false;
            initialRaw[skill.id] = String(sum12);
          }
        } else {
          initialRat[skill.id] = sum12;
          initialFlags[skill.id] = false;
          initialRaw[skill.id] = String(sum12);
        }
      } else {
        // La colonne RAT N'EST PAS cochée : on recalcule ce RAT en sommant ce qui se trouve dans les 12 mois à côté
        initialRat[skill.id] = sum12;
        initialFlags[skill.id] = false;
        initialRaw[skill.id] = String(sum12);
      }
      initialErrors[skill.id] = false;
    });

    setRatState(initialRat);
    setCustomRatFlags(initialFlags);
    setRatRawInputs(initialRaw);
    setRatErrors(initialErrors);

    setSaveError(null);
    setSaveSuccess(false);
  }, [isOpen, project, skills, rollingMonths, nextMonthKey]);

  // Recalcul de la somme des 12 mois pour chaque compétence
  const sums12PerSkill = useMemo(() => {
    const sums: Record<string, number> = {};
    skills.forEach((skill) => {
      let sum = 0;
      rollingMonths.forEach((m) => {
        const val = daysState[m.key]?.[skill.id];
        if (typeof val === 'number' && !isNaN(val) && val > 0) {
          sum += val;
        }
      });
      sums[skill.id] = Math.round(sum * 10) / 10;
    });
    return sums;
  }, [skills, rollingMonths, daysState]);

  const hasAnyRatError = useMemo(() => {
    return Object.values(ratErrors).some(Boolean);
  }, [ratErrors]);

  // Gestion de la modification d'un mois pour une compétence
  const handleMonthChange = (monthKey: string, skillId: string, rawVal: string) => {
    const trimmed = rawVal.trim().replace(',', '.');
    const parsed = trimmed === '' ? null : parseFloat(trimmed);
    const validVal = parsed !== null && !isNaN(parsed) && parsed >= 0 ? Math.round(parsed * 10) / 10 : null;

    setDaysState((prev) => {
      const updatedMonth = { ...(prev[monthKey] || {}), [skillId]: validVal };
      const nextDaysState = { ...prev, [monthKey]: updatedMonth };

      // Si la case RAT n'est pas cochée et qu'aucune valeur n'a été saisie pour cette compétence (!customRatFlags[skillId]),
      // on met à jour automatiquement le RAT avec la nouvelle somme des mois.
      // Dès qu'une valeur a été saisie, ne plus la réinitialiser avec la somme des mois !
      if (!isRatValidated && !customRatFlags[skillId]) {
        let newSum = 0;
        rollingMonths.forEach((m) => {
          const v = nextDaysState[m.key]?.[skillId];
          if (typeof v === 'number' && !isNaN(v) && v > 0) {
            newSum += v;
          }
        });
        const roundedSum = Math.round(newSum * 10) / 10;
        setRatState((prevRat) => ({ ...prevRat, [skillId]: roundedSum }));
        setRatRawInputs((prevRaw) => ({ ...prevRaw, [skillId]: String(roundedSum) }));
        setRatErrors((prevErr) => ({ ...prevErr, [skillId]: false }));
      }

      return nextDaysState;
    });
  };

  // Gestion de la saisie libre du RAT pour une compétence (aucune validation bloquante pendant la frappe de l'utilisateur)
  const handleRatInputChange = (skillId: string, rawVal: string) => {
    setRatRawInputs((prev) => ({ ...prev, [skillId]: rawVal }));
    // Dès qu'une valeur est saisie, ne plus la réinitialiser avec la somme des mois
    setCustomRatFlags((prev) => ({ ...prev, [skillId]: true }));

    const trimmed = rawVal.trim().replace(',', '.');
    if (trimmed !== '') {
      const parsed = parseFloat(trimmed);
      if (!isNaN(parsed) && parsed >= 0) {
        const rounded = Math.round(parsed * 10) / 10;
        setRatState((prev) => ({ ...prev, [skillId]: rounded }));
      }
    }

    // Si la cellule affichait une erreur, la retirer dès que l'utilisateur modifie pour ne pas le bloquer
    if (ratErrors[skillId]) {
      setRatErrors((prev) => ({ ...prev, [skillId]: false }));
    }
  };

  // Validation et enregistrement effectif du RAT après avoir tapé 'Enter' (ou focus out)
  const commitAndValidateRat = (skillId: string) => {
    const raw = ratRawInputs[skillId] !== undefined ? ratRawInputs[skillId] : '';
    const trimmed = raw.trim().replace(',', '.');
    const sum12 = sums12PerSkill[skillId] || 0;

    if (trimmed === '') {
      // Si l'utilisateur efface tout et que la case RAT n'est pas cochée en entête, réinitialiser à la somme des 12 mois
      if (!isRatValidated) {
        setCustomRatFlags((prev) => ({ ...prev, [skillId]: false }));
        setRatState((prev) => ({ ...prev, [skillId]: sum12 }));
        setRatRawInputs((prev) => ({ ...prev, [skillId]: String(sum12) }));
        setRatErrors((prev) => ({ ...prev, [skillId]: false }));
      }
      return;
    }

    const parsed = parseFloat(trimmed);
    if (isNaN(parsed) || parsed < 0) {
      setRatErrors((prev) => ({ ...prev, [skillId]: true }));
      return;
    }

    const rounded = Math.round(parsed * 10) / 10;
    setCustomRatFlags((prev) => ({ ...prev, [skillId]: true }));
    setRatState((prev) => ({ ...prev, [skillId]: rounded }));
    setRatRawInputs((prev) => ({ ...prev, [skillId]: String(rounded) }));

    // Vérifier que le nombre saisi est bien supérieur ou égal à la somme des autres colonnes
    if (rounded < sum12) {
      setRatErrors((prev) => ({ ...prev, [skillId]: true }));
    } else {
      setRatErrors((prev) => ({ ...prev, [skillId]: false }));
    }
  };

  // Détection de la touche 'Enter' dans la cellule RAT pour valider
  const handleRatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, skillId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAndValidateRat(skillId);
    }
  };

  // Basculement de la case à cocher d'un mois
  const handleToggleMonthValidation = (monthKey: string) => {
    setValidatedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  // Basculement de la case à cocher du RAT (figer toutes les données quand coché, revenir au recalcul dynamique quand décoché)
  const handleToggleRatValidation = () => {
    setIsRatValidated((prev) => {
      const next = !prev;
      setValidatedMonths((vPrev) => ({
        ...vPrev,
        rat: next,
      }));

      if (next) {
        // COCHÉ : figer toutes les données RAT
        // Pour chaque compétence, la valeur actuelle (ou la somme des 12 mois si vide) est figée
        const frozenRat: Record<string, number | null> = {};
        const frozenFlags: Record<string, boolean> = {};
        const frozenRaw: Record<string, string> = {};

        skills.forEach((skill) => {
          const sum12 = sums12PerSkill[skill.id] || 0;
          const currentVal =
            ratRawInputs[skill.id] !== undefined && ratRawInputs[skill.id].trim() !== ''
              ? parseFloat(ratRawInputs[skill.id].trim().replace(',', '.'))
              : ratState[skill.id] !== undefined && ratState[skill.id] !== null
              ? ratState[skill.id]
              : sum12;
          const finalVal =
            typeof currentVal === 'number' && !isNaN(currentVal) && currentVal >= 0
              ? Math.round(currentVal * 10) / 10
              : sum12;

          frozenRat[skill.id] = finalVal;
          frozenFlags[skill.id] = true;
          frozenRaw[skill.id] = String(finalVal);
        });

        setRatState(frozenRat);
        setCustomRatFlags(frozenFlags);
        setRatRawInputs(frozenRaw);
        setRatErrors({});
      } else {
        // DÉCOCHÉ : revenir au comportement initial !
        // Les RAT pour chacune des compétences clés sont recalculés (somme) à la volée
        const resetFlags: Record<string, boolean> = {};
        const resetRaw: Record<string, string> = {};
        const resetRat: Record<string, number | null> = {};

        skills.forEach((skill) => {
          const sum12 = sums12PerSkill[skill.id] || 0;
          resetFlags[skill.id] = false;
          resetRaw[skill.id] = String(sum12);
          resetRat[skill.id] = sum12;
        });

        setCustomRatFlags(resetFlags);
        setRatRawInputs(resetRaw);
        setRatState(resetRat);
        setRatErrors({});
      }

      return next;
    });
  };

  const handleSave = async () => {
    if (!project) return;

    let hasError = false;
    const newErrors: Record<string, boolean> = {};
    const committedRat: Record<string, number> = {};

    // Si la colonne RAT est cochée, validation stricte : pour chaque compétence, le RAT est >= somme des 12 mois
    if (isRatValidated) {
      skills.forEach((skill) => {
        const raw = ratRawInputs[skill.id] !== undefined ? ratRawInputs[skill.id] : '';
        const trimmed = raw.trim().replace(',', '.');
        const sum12 = sums12PerSkill[skill.id] || 0;
        let val = sum12;

        if (trimmed !== '') {
          const parsed = parseFloat(trimmed);
          if (!isNaN(parsed) && parsed >= 0) {
            val = Math.round(parsed * 10) / 10;
          } else {
            val = -1;
          }
        } else if (ratState[skill.id] !== undefined && ratState[skill.id] !== null) {
          val = ratState[skill.id] as number;
        }

        if (val < sum12) {
          hasError = true;
          newErrors[skill.id] = true;
        } else {
          newErrors[skill.id] = false;
        }
        committedRat[skill.id] = val >= 0 ? val : sum12;
      });

      if (hasError) {
        setRatErrors(newErrors);
        setSaveError(
          t(
            'capacity.staffing_plan.rat_error',
            'Le Reste à Terminaison doit être supérieure ou égale à la somme des besoins sur les prochains mois.'
          )
        );
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    try {
      // Nettoyage et formatage des données à enregistrer
      const cleanedStaffingPlan: Record<string, Record<string, number | null>> = {};
      rollingMonths.forEach((m) => {
        cleanedStaffingPlan[m.key] = {};
        skills.forEach((skill) => {
          const val = daysState[m.key]?.[skill.id];
          cleanedStaffingPlan[m.key][skill.id] =
            typeof val === 'number' && !isNaN(val) && val >= 0 ? Math.round(val * 10) / 10 : null;
        });
      });

      // Règle métier : ne sauvegarder le RAT que si on coche la case dans l'entête
      const cleanedRat: Record<string, number | null> = {};
      if (isRatValidated) {
        skills.forEach((skill) => {
          cleanedRat[skill.id] =
            committedRat[skill.id] !== undefined ? committedRat[skill.id] : sums12PerSkill[skill.id] || 0;
        });
      }

      // Synchroniser la demande pour le prochain mois (nextMonthKey)
      const nextMonthDemands: Record<string, number | null> = {};
      skills.forEach((skill) => {
        const val = cleanedStaffingPlan[nextMonthKey]?.[skill.id];
        nextMonthDemands[skill.id] = typeof val === 'number' && val >= 0 ? val : null;
      });

      const finalValidatedMonths = {
        ...validatedMonths,
        rat: isRatValidated,
      };

      await updateProjectStaffingPlan(
        project.id,
        cleanedStaffingPlan,
        cleanedRat,
        nextMonthDemands,
        nextMonthKey,
        project.name,
        finalValidatedMonths,
        isRatValidated,
        currentMonthKey
      );

      setSaveSuccess(true);
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 600);
    } catch (err: any) {
      console.error('Erreur sauvegarde plan de staffing:', err);
      setSaveError(err?.message || 'Erreur lors de la sauvegarde du plan de staffing.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="staffing-plan-modal-title"
      >
        {/* En-tête de la modale */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-rose-50/40 via-slate-50 to-white flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Gauge className="w-5 h-5 text-rose-900 stroke-[2.5] shrink-0" />
              <h2
                id="staffing-plan-modal-title"
                className={`${MODAL_TITLE_CLASS} text-rose-900`}
              >
                {t('capacity.staffing_plan.modal_title', 'Plan de staffing prévisionnel')}
              </h2>
              <span className="text-slate-300 font-normal select-none mx-0.5">—</span>
              <span className={`${PROJECT_TITLE_CLASS} font-mono`}>
                #{project.projectNumber}
              </span>
              <span className={`${PROJECT_TITLE_CLASS} truncate max-w-sm`}>
                {project.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {t(
                'capacity.staffing_plan.modal_subtitle',
                'Saisie des besoins de staffing pour les 12 prochains mois et estimation du Reste à Terminaison (RAT).'
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label={t('common.close', 'Fermer')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message d'erreur ou d'alerte globale */}
        {saveError && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t('capacity.staffing_plan.saved_success', 'Plan de staffing et reste à terminaison enregistrés avec succès.')}</span>
          </div>
        )}

        {/* Corps de la modale avec ascenseurs horizontal et vertical */}
        <div className="flex-1 min-h-0 p-6 flex flex-col overflow-hidden">
          {skills.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">
              {t('capacity.tooltips.no_skills', 'Aucune compétence clé définie dans le référentiel.')}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto border border-slate-200 rounded-xl shadow-2xs bg-white [scrollbar-width:thin]">
              <table className="w-full text-xs text-left border-collapse min-w-max">
                <thead className={`sticky top-0 z-40 select-none ${TABLE_HEADER_THEAD_CLASS}`}>
                  <tr>
                    {/* Colonne 1 : Compétence clé (figée à gauche, avec double filet après la colonne) */}
                    <th
                      scope="col"
                      className={`sticky left-0 top-0 bg-slate-100 z-50 px-3 py-2.5 text-left w-[200px] min-w-[200px] max-w-[200px] ${TABLE_FROZEN_DIVIDER_CLASS} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${TABLE_TH_BASE_CLASS}`}
                    >
                      <span className="font-bold text-slate-800">
                        {t('capacity.staffing_plan.col_skill', 'Compétence clé')}
                      </span>
                    </th>

                    {/* 12 colonnes mensuelles glissantes : Case à cocher à gauche + Mois et Année sur 2 lignes à gauche */}
                    {rollingMonths.map((m) => {
                      const isValidated = Boolean(validatedMonths[m.key]);

                      return (
                        <th
                          key={m.key}
                          scope="col"
                          className={`px-2 py-1.5 text-left min-w-[86px] w-[86px] ${TABLE_TH_BASE_CLASS}`}
                        >
                          <div className="flex items-center gap-1.5 justify-start">
                            {/* Case à cocher pour signifier que la demande a bien été renseignée */}
                            <Tooltip
                              content={t(
                                'capacity.staffing_plan.checkbox_month_tooltip',
                                'Cocher pour signifier que la demande a bien été renseignée pour ce mois'
                              )}
                            >
                              <label className="inline-flex items-center cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isValidated}
                                  onChange={() => handleToggleMonthValidation(m.key)}
                                  className="h-3.5 w-3.5 rounded-[3px] border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                />
                              </label>
                            </Tooltip>

                            {/* Mois et Année sur 2 lignes, alignés à gauche et proches de la case à cocher */}
                            <div className="flex flex-col text-left leading-tight select-none min-w-0">
                              <span className="font-bold text-xs capitalize text-slate-800 truncate">
                                {new Date(m.year, m.month - 1, 1).toLocaleDateString(i18n.language, { month: 'short' })}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500 font-mono">
                                {m.year}
                              </span>
                            </div>
                          </div>
                        </th>
                      );
                    })}

                    {/* 13ème colonne : Reste à Terminaison (RAT) (figée à droite, avec double filet avant la colonne) */}
                    <th
                      scope="col"
                      className={`sticky right-0 top-0 z-50 px-2 py-1.5 text-left w-[110px] min-w-[110px] max-w-[110px] bg-slate-100 ${TABLE_FROZEN_DIVIDER_LEFT_CLASS} shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)] ${TABLE_TH_BASE_CLASS}`}
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        {/* Case à cocher pour signifier que le RAT a bien été renseigné */}
                        <Tooltip
                          content={t(
                            'capacity.staffing_plan.checkbox_rat_tooltip',
                            'Cocher pour signifier que le Reste à Terminaison (RAT) a bien été renseigné'
                          )}
                        >
                          <label className="inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isRatValidated}
                              onChange={handleToggleRatValidation}
                              className="h-3.5 w-3.5 rounded-[3px] border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                          </label>
                        </Tooltip>

                        {/* Titre RAT et Terminaison sur 2 lignes, alignés à gauche */}
                        <div className="flex flex-col text-left leading-tight select-none min-w-0">
                          <Tooltip
                            title={t('capacity.staffing_plan.rat_title', 'Reste à Terminaison')}
                            content={t(
                              'capacity.staffing_plan.rat_description',
                              'Nombre de jours nécessaire pour terminer le projet'
                            )}
                          >
                            <span className="font-bold text-xs text-slate-900 cursor-help select-none inline-block truncate">
                              {t('capacity.staffing_plan.rat_col', 'RAT')}
                            </span>
                          </Tooltip>
                          <span className="text-[10px] font-medium text-slate-500 font-mono">
                            {t('capacity.staffing_plan.rat_short_label', 'Termin.')}
                          </span>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {skills.map((skill) => {
                    const sum12 = sums12PerSkill[skill.id] || 0;
                    const isCustom = Boolean(customRatFlags[skill.id]);
                    const currentRatVal = ratState[skill.id];
                    const isInvalid =
                      Boolean(ratErrors[skill.id]) ||
                      (isCustom && currentRatVal !== null && currentRatVal !== undefined && currentRatVal < sum12);
                    const ratValue =
                      ratRawInputs[skill.id] !== undefined
                        ? ratRawInputs[skill.id]
                        : currentRatVal !== undefined && currentRatVal !== null
                        ? String(currentRatVal)
                        : String(sum12);
                    const ratPlaceholder = String(sum12);

                    return (
                      <tr
                        key={skill.id}
                        className="transition-colors group bg-white hover:bg-slate-50"
                      >
                        {/* Colonne 1 : Compétence clé (figée à gauche, avec double filet après la colonne) */}
                        <td
                          className={`sticky left-0 z-30 px-3 py-2 text-left w-[200px] min-w-[200px] max-w-[200px] ${TABLE_FROZEN_DIVIDER_CLASS} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] bg-white group-hover:bg-slate-50`}
                        >
                          <span className="font-semibold text-slate-800 truncate block">
                            {skill.name}
                          </span>
                        </td>

                        {/* 12 colonnes mensuelles : saisie numérique directe */}
                        {rollingMonths.map((m) => {
                          const val = daysState[m.key]?.[skill.id];
                          const strVal = val !== undefined && val !== null ? String(val) : '';

                          return (
                            <td
                              key={m.key}
                              className="px-1.5 py-1.5 text-center min-w-[86px] w-[86px] border-r border-slate-200 bg-white group-hover:bg-slate-50"
                            >
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={strVal}
                                onChange={(e) => handleMonthChange(m.key, skill.id, e.target.value)}
                                placeholder="0"
                                className="w-14 px-1.5 py-1 text-center text-xs text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 hover:border-slate-400 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-slate-400"
                              />
                            </td>
                          );
                        })}

                        {/* 13ème colonne : RAT (figée à droite, 100% opaque pour masquer le défilement) */}
                        <td
                          className={`sticky right-0 z-30 px-2 py-1.5 text-center w-[110px] min-w-[110px] max-w-[110px] ${TABLE_FROZEN_DIVIDER_LEFT_CLASS} shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                            isInvalid ? 'bg-red-50' : 'bg-white group-hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-center">
                            <div className="relative inline-flex items-center">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={ratValue}
                                onChange={(e) => handleRatInputChange(skill.id, e.target.value)}
                                onKeyDown={(e) => handleRatKeyDown(e, skill.id)}
                                onBlur={() => commitAndValidateRat(skill.id)}
                                placeholder={ratPlaceholder}
                                className={`w-14 px-1.5 py-1 text-center text-xs rounded-md focus:outline-none focus:ring-1 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-slate-400 ${
                                  isInvalid
                                    ? 'font-bold text-red-600 bg-red-50 border border-red-500 focus:ring-red-500 shadow-2xs'
                                    : 'text-slate-800 bg-white border border-slate-300 focus:ring-blue-500 hover:border-slate-400'
                                }`}
                              />
                              {isInvalid && (
                                <Tooltip
                                  variant="error"
                                  placement="top"
                                  content={t(
                                    'capacity.staffing_plan.rat_error',
                                    'Le Reste à Terminaison doit être supérieure ou égale à la somme des besoins sur les prochains mois.'
                                  )}
                                >
                                  <span className="ml-1 cursor-help inline-flex items-center">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pied de la modale */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-medium text-slate-700">
              {t(
                'capacity.staffing_plan.sync_notice',
                'Les besoins saisis pour le prochain mois ({{period}}) seront automatiquement appliqués au tableau capacitaire.',
                { period: nextMonthKey }
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={MODAL_CANCEL_BUTTON_CLASS}
            >
              {t('common.actions.cancel', 'Annuler')}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (isRatValidated && hasAnyRatError)}
              className={`${PRIMARY_ACTION_MODAL_BUTTON_CLASS} ${
                isRatValidated && hasAnyRatError ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? t('common.actions.saving', 'Enregistrement...')
                  : t('common.actions.save', 'Enregistrer')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
