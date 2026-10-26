import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Sliders,
  AlertCircle,
  Lock,
  Scale,
  CheckSquare,
  Eye,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Criterion,
  CRITERION_POINTS,
  CRITERION_WEIGHTS,
  CriterionFormData,
  CriterionWeight,
} from '../types/criteria';
import { BonusConfig, DEFAULT_BONUS_CONFIG } from '../types/bonus';
import { CriterionModal } from './CriterionModal';
import { Tooltip } from './Tooltip';
import { BonusSettingsCard } from './BonusSettingsCard';
import {
  addCriterion,
  updateCriterion,
  deleteCriterion,
  reorderCriteria,
  toggleCriterionActive,
} from '../services/criteriaService';

interface CriteriaTableProps {
  criteria: Criterion[];
  loading: boolean;
  isAdmin?: boolean;
  canManageBonus?: boolean;
  bonusConfig?: BonusConfig;
  currentUserEmail?: string;
  roleLabel?: string;
  onSeedExample?: () => void;
  seeding?: boolean;
}

export const CriteriaTable: React.FC<CriteriaTableProps> = ({
  criteria,
  loading,
  isAdmin = true,
  canManageBonus = true,
  bonusConfig,
  currentUserEmail = '',
  roleLabel,
  onSeedExample,
  seeding = false,
}) => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCriterion, setSelectedCriterion] = useState<Criterion | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Criterion | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleOpenAdd = () => {
    if (!isAdmin) return;
    setSelectedCriterion(null);
    setIsReadOnlyModal(false);
    setModalOpen(true);
    setActionError(null);
  };

  const handleOpenEdit = (criterion: Criterion) => {
    setSelectedCriterion(criterion);
    setIsReadOnlyModal(!isAdmin);
    setModalOpen(true);
    setActionError(null);
  };

  const handleSave = async (formData: CriterionFormData) => {
    if (!isAdmin) {
      setActionError("Action refusée : Seul un administrateur peut modifier les critères.");
      return;
    }
    setActionError(null);
    if (selectedCriterion) {
      await updateCriterion(selectedCriterion.id, formData);
    } else {
      await addCriterion(formData);
    }
  };

  const handleToggleActive = async (criterion: Criterion) => {
    if (!isAdmin) return;
    setActionError(null);
    try {
      const nextState = criterion.isActive === false ? true : false;
      await toggleCriterionActive(criterion.id, nextState);
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors de l'activation/désactivation du critère.");
    }
  };

  const handleDirectWeightChange = async (criterion: Criterion, newWeight: CriterionWeight) => {
    if (!isAdmin) return;
    setActionError(null);
    try {
      await updateCriterion(criterion.id, { weight: newWeight });
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors du changement de poids.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate || !isAdmin) return;
    setProcessing(true);
    setActionError(null);
    try {
      await deleteCriterion(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la suppression.');
    } finally {
      setProcessing(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!isAdmin) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= criteria.length) return;

    setProcessing(true);
    setActionError(null);
    try {
      const reordered = [...criteria];
      const temp = reordered[index];
      reordered[index] = reordered[targetIndex];
      reordered[targetIndex] = temp;
      await reorderCriteria(reordered);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la réorganisation.');
    } finally {
      setProcessing(false);
    }
  };

  const weightBadgeClass = 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <div className="space-y-6">
      {/* En-tête avec titre, sous-titre et bouton d'action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-emerald-600 flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{t('settings.criteria.title')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {isAdmin
              ? t('settings.criteria.subtitle_admin')
              : t('settings.criteria.subtitle_consult')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin && criteria.length === 0 && !loading && onSeedExample && (
            <button
              onClick={onSeedExample}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{seeding ? t('settings.criteria.loading_defaults') : t('settings.criteria.load_defaults')}</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('settings.criteria.add_button')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Information de restriction de profil */}
      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>{t('settings.common.consultation_mode')}</strong> {t('settings.criteria.consult_notice')}
          </span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tableau tabulaire avec ascenseur horizontal et vertical */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200 shadow-2xs">
              <tr>
                {/* Ordre */}
                {isAdmin && (
                  <th scope="col" className="py-3 px-3 w-14 text-center">
                    {t('settings.criteria.col_order')}
                  </th>
                )}
                {/* Boîte à cocher Actif */}
                <th scope="col" className="py-3 px-3 w-16 text-center">
                  <Tooltip content={t('settings.criteria.col_active_tooltip')} className="w-full inline-block">
                    <div className="flex items-center justify-center gap-1 cursor-help">
                      <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t('settings.criteria.col_active')}</span>
                    </div>
                  </Tooltip>
                </th>
                {/* Type */}
                <th scope="col" className="py-3 px-4 w-24">
                  {t('settings.criteria.col_type')}
                </th>
                {/* Nom du critère */}
                <th scope="col" className="py-3 px-4 min-w-[170px]">
                  {t('settings.criteria.col_name')}
                </th>
                {/* Poids */}
                <th scope="col" className="py-3 px-3 w-20 text-center bg-slate-50/90">
                  <div className="flex items-center justify-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('settings.criteria.col_weight')}</span>
                  </div>
                </th>
                {/* 6 échelons textuels */}
                {CRITERION_POINTS.map((pt) => (
                  <th
                    key={pt}
                    scope="col"
                    className="py-3 px-3 min-w-[140px] border-l border-slate-200/80 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-900">= {pt}</span>
                    </div>
                  </th>
                ))}
                {/* Actions */}
                <th scope="col" className="py-3 px-4 w-24 text-right sticky right-0 bg-slate-100">
                  {t('settings.criteria.col_actions')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 12 : 10} className="py-12 text-center text-slate-400">
                    {t('settings.common.loading')}
                  </td>
                </tr>
              ) : criteria.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 12 : 10} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Sliders className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-700">{t('settings.criteria.empty')}</p>
                      {isAdmin ? (
                        <>
                          <p className="text-xs text-slate-400 max-w-sm">
                            {t('settings.criteria.empty_hint')}
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            {onSeedExample && (
                              <button
                                onClick={onSeedExample}
                                disabled={seeding}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md font-semibold text-xs transition-colors cursor-pointer border border-indigo-200 shadow-2xs"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{seeding ? t('settings.criteria.loading_defaults') : t('settings.criteria.load_defaults')}</span>
                              </button>
                            )}
                            <button
                              onClick={handleOpenAdd}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-md font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{t('settings.criteria.add_button')}</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">
                          {t('settings.criteria.subtitle_consult')}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                criteria.map((criterion, index) => {
                  const isActive = criterion.isActive !== false;

                  return (
                    <tr
                      key={criterion.id}
                      className={`transition-colors group ${
                        isActive
                          ? 'hover:bg-slate-50/80 bg-white'
                          : 'bg-slate-50/70 hover:bg-slate-100/60 text-slate-400 italic'
                      }`}
                    >
                      {/* Boutons de réorganisation (admin) */}
                      {isAdmin && (
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0 || processing}
                              onClick={() => handleMove(index, 'up')}
                              className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Monter"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === criteria.length - 1 || processing}
                              onClick={() => handleMove(index, 'down')}
                              className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Descendre"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}

                      {/* Boîte à cocher Actif / Inactif */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {isAdmin ? (
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={() => handleToggleActive(criterion)}
                              title={
                                isActive
                                  ? 'Critère actif. Cliquez pour le désactiver des calculs de priorité.'
                                  : 'Critère désactivé (exclu des calculs). Cliquez pour le réactiver.'
                              }
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer transition-transform hover:scale-110"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isActive}
                              disabled
                              title={isActive ? 'Critère actif' : 'Critère inactif'}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 opacity-60 cursor-not-allowed"
                            />
                          )}
                        </div>
                      </td>

                      {/* Type VALEUR ou COÛT */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${
                            !isActive
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 italic'
                              : criterion.type === 'VALEUR'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {criterion.type === 'VALEUR' ? t('settings.criteria.type_value') : t('settings.criteria.type_cost')}
                        </span>
                      </td>

                      {/* Nom du critère */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            isActive ? 'text-slate-900' : 'text-slate-400 italic'
                          }`}
                        >
                          {criterion.name}
                        </span>
                      </td>

                      {/* Poids relatif (1, 2, 3, 5, 8, 13) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-50/30">
                        {isAdmin ? (
                          <select
                            value={criterion.weight || 1}
                            onChange={(e) =>
                              handleDirectWeightChange(
                                criterion,
                                Number(e.target.value) as CriterionWeight
                              )
                            }
                            title="Modifier le poids relatif"
                            className={`w-12 px-1.5 py-0.5 rounded text-xs font-bold text-center border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                              isActive
                                ? weightBadgeClass
                                : 'bg-slate-50 text-slate-400 border-slate-200 italic'
                            }`}
                          >
                            {CRITERION_WEIGHTS.map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center justify-center w-8 py-0.5 rounded text-xs font-bold border ${
                              isActive
                                ? weightBadgeClass
                                : 'bg-slate-50 text-slate-400 border-slate-200 italic'
                            }`}
                          >
                            {criterion.weight || 1}
                          </span>
                        )}
                      </td>

                      {/* 6 échelons textuels */}
                      {CRITERION_POINTS.map((pt, pIdx) => (
                        <td
                          key={pt}
                          className={`py-2.5 px-3 border-l border-slate-100 text-xs break-words max-w-[200px] ${
                            isActive ? 'text-slate-700' : 'text-slate-400 italic'
                          }`}
                        >
                          {criterion.levels?.[pIdx] || (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </td>
                      ))}

                      {/* Actions : Modifier / Supprimer (admin) ou Visualiser (non-admin) */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50/80">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(criterion)}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              isAdmin
                                ? 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                            }`}
                            title={isAdmin ? 'Modifier ce critère' : 'Consulter ce critère (Lecture seule)'}
                          >
                            {isAdmin ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteCandidate(criterion)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Encart "Gestion des bonus" (Value Management Officer / Administrateur) */}
      <BonusSettingsCard
        bonusConfig={bonusConfig || DEFAULT_BONUS_CONFIG}
        canManage={canManageBonus}
        currentUserEmail={currentUserEmail}
        roleLabel={roleLabel}
      />

      {/* Modal d'ajout / modification (admin) ou consultation (non-admin) */}
      <CriterionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        criterionToEdit={selectedCriterion}
        existingCriteria={criteria}
        isReadOnly={isReadOnlyModal}
      />

      {/* Confirmation de suppression (admin) */}
      {isAdmin && deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {t('settings.criteria.delete_title')}
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              {t('settings.criteria.delete_desc', { name: deleteCandidate.name })}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                {t('settings.common.cancel')}
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {processing ? t('settings.common.saving') : t('settings.common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
