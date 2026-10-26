import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  AlertCircle,
  Brain,
  FileText,
  BarChart3,
  Layers,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { KeySkill, KeySkillFormData, SkillBudgetAllocation } from '../types/skill';
import { BudgetLine } from '../types/budget';
import { AppUser } from '../types/user';
import { BUDGET_PALETTE_32 } from '../constants/colors';
import { UserAutocompleteSelect } from './UserAutocompleteSelect';
import { getUserRoles } from '../utils/userUtils';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: KeySkillFormData) => Promise<void>;
  skillToEdit?: KeySkill | null;
  existingSkills: KeySkill[];
  budgetLines: BudgetLine[];
  users: AppUser[];
  currentUserId?: string;
  isReadOnly?: boolean;
}

export const SkillModal: React.FC<SkillModalProps> = ({
  isOpen,
  onClose,
  onSave,
  skillToEdit,
  existingSkills,
  budgetLines,
  users,
  currentUserId,
  isReadOnly = false,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [resourceManagerId, setResourceManagerId] = useState('');
  const [description, setDescription] = useState('');
  const [alertOnDemandOverrun, setAlertOnDemandOverrun] = useState<boolean>(false);
  const [isCapped, setIsCapped] = useState<boolean>(false);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filtrer les utilisateurs pré-filtrés avec seulement le profil de Resource Manager
  const resourceManagers = useMemo(() => {
    return users.filter((u) => {
      const userRoles = getUserRoles(u);
      return userRoles.includes('resource manager');
    });
  }, [users]);

  // Données de répartition pour le bargraph horizontal
  const barSlices = useMemo(() => {
    const validLines = budgetLines.filter((bl) => (allocations[bl.id] || 0) > 0);
    return validLines.map((bl, idx) => ({
      id: bl.id,
      label: bl.name,
      value: allocations[bl.id] || 0,
      color: bl.color || BUDGET_PALETTE_32[idx % BUDGET_PALETTE_32.length].hex,
    }));
  }, [budgetLines, allocations]);

  const totalPercentage = useMemo(() => {
    return Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [allocations]);

  useEffect(() => {
    if (skillToEdit) {
      setName(skillToEdit.name);
      const matchedUser = users.find(
        (u) =>
          u.id === skillToEdit.resourceManagerId ||
          u.email.toLowerCase() === (skillToEdit.resourceManagerId || '').toLowerCase()
      );
      setResourceManagerId(matchedUser ? matchedUser.email : skillToEdit.resourceManagerId);
      setDescription(skillToEdit.description || '');
      setAlertOnDemandOverrun(Boolean(skillToEdit.alertOnDemandOverrun));
      setIsCapped(Boolean(skillToEdit.isCapped));

      const allocMap: Record<string, number> = {};
      budgetLines.forEach((bl) => {
        allocMap[bl.id] = 0;
      });
      (skillToEdit.budgetAllocations || []).forEach((a) => {
        allocMap[a.budgetLineId] = a.percentage || 0;
      });
      setAllocations(allocMap);
    } else {
      setName('');
      const defaultRm =
        resourceManagers.find((u) => u.id === currentUserId || u.email === currentUserId)?.email ||
        resourceManagers[0]?.email ||
        '';
      setResourceManagerId(defaultRm);
      setDescription('');
      setAlertOnDemandOverrun(false);
      setIsCapped(false);

      const allocMap: Record<string, number> = {};
      budgetLines.forEach((bl) => {
        allocMap[bl.id] = 0;
      });
      setAllocations(allocMap);
    }
    setError(null);
  }, [skillToEdit, isOpen, budgetLines, users, currentUserId, resourceManagers]);

  const handleAllocationChange = (lineId: string, valStr: string) => {
    let num = Number(valStr);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;

    setAllocations((prev) => ({
      ...prev,
      [lineId]: num,
    }));
  };

  const missingRequiredCount = useMemo(() => {
    let count = 0;
    if (!name.trim()) count++;
    if (!resourceManagerId) count++;
    return count;
  }, [name, resourceManagerId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError(t('modals.skill.error_name_required'));
      return;
    }

    if (!resourceManagerId) {
      setError(t('modals.skill.error_manager_required'));
      return;
    }

    // Vérification du nom unique (insensible à la casse)
    const isDuplicate = existingSkills.some(
      (s) =>
        s.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        s.id !== skillToEdit?.id
    );

    if (isDuplicate) {
      setError(t('modals.skill.error_name_duplicate', { name: trimmedName }));
      return;
    }

    const rmUser = users.find(
      (u) =>
        (u.email || '').toLowerCase() === resourceManagerId.toLowerCase() ||
        u.id === resourceManagerId
    );
    const rmName = rmUser ? rmUser.displayName : 'Inconnu';
    const cleanRmEmail = rmUser ? rmUser.email : resourceManagerId;

    const budgetAllocations: SkillBudgetAllocation[] = budgetLines.map((bl) => ({
      budgetLineId: bl.id,
      budgetLineName: bl.name,
      percentage: Number(allocations[bl.id]) || 0,
    }));

    setSaving(true);
    setError(null);

    try {
      const order = skillToEdit
        ? skillToEdit.order
        : existingSkills.length > 0
        ? Math.max(...existingSkills.map((s) => s.order)) + 1
        : 0;

      await onSave({
        name: trimmedName,
        resourceManagerId: cleanRmEmail,
        resourceManagerName: rmName,
        description: description.trim(),
        alertOnDemandOverrun,
        isCapped,
        budgetAllocations,
        order,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || t('modals.skill.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête modal (toujours visible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl border border-rose-200 shrink-0">
              <Brain className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {isReadOnly
                  ? t('modals.skill.title_view', { name: skillToEdit?.name || '' })
                  : skillToEdit
                  ? t('modals.skill.title_edit', { name: skillToEdit.name })
                  : t('modals.skill.title_create')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('modals.skill.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire avec zone défilable et bandeau d'actions fixe */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 [scrollbar-width:thin]">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Ligne 1 : Nom et Resource Manager */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Nom unique */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {t('modals.skill.name_label')} {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  required={!isReadOnly}
                  disabled={isReadOnly}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('modals.skill.name_placeholder')}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700 min-h-[34px]"
                />
              </div>

              {/* Resource Manager */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {t('modals.skill.manager_label')} {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <UserAutocompleteSelect
                  value={resourceManagerId}
                  onChange={(val) => setResourceManagerId(val)}
                  users={users}
                  valueKey="email"
                  requiredRole="resource manager"
                  placeholder={t('modals.skill.manager_select_placeholder')}
                  required={!isReadOnly}
                  disabled={isReadOnly}
                  size="sm"
                />
              </div>
            </div>

            {/* Description (facultative) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('modals.skill.description_label')}
                </label>
                <span className={`text-[11px] font-mono ${description.length > 500 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                  {description.length} / 500 car.
                </span>
              </div>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <textarea
                  rows={2}
                  maxLength={500}
                  disabled={isReadOnly}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('modals.skill.description_placeholder')}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700 resize-y"
                />
              </div>
            </div>

            {/* Boîte à cocher : alerter en cas de dépassement des demandes */}
            <div className="pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 hover:text-slate-900">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={alertOnDemandOverrun}
                  onChange={(e) => setAlertOnDemandOverrun(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <span>{t('modals.skill.alert_title')}</span>
              </label>
            </div>

            {/* Section Répartition par ligne budgétaire */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    {t('modals.skill.distribution_title')}
                  </h4>
                </div>

                {/* Boîte à cocher : Mode de plafonnement */}
                <label
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all select-none ${
                    isReadOnly ? 'cursor-default pointer-events-none' : 'cursor-pointer'
                  } ${
                    isCapped
                      ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={isCapped}
                    onChange={(e) => setIsCapped(e.target.checked)}
                    className={`w-4 h-4 rounded cursor-pointer transition-colors ${
                      isCapped
                        ? 'text-blue-600 border-blue-400 focus:ring-blue-500'
                        : 'text-slate-400 border-slate-300 focus:ring-slate-400'
                    }`}
                  />
                  <span>{isCapped ? t('settings.skills.cap_active') : t('settings.skills.cap_inactive')}</span>
                </label>
              </div>

              {/* Avertissement / Info en mode non capé */}
              {!isCapped && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <strong>{t('modals.skill.cap_desc')}</strong>
                  </div>
                </div>
              )}

              {/* Conteneur avec état grisé si non capé */}
              <div
                className={`space-y-4 transition-all duration-200 ${
                  !isCapped ? 'opacity-40 grayscale pointer-events-none select-none' : ''
                }`}
              >
                {budgetLines.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs text-slate-500">
                    {t('settings.budgets.empty')}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">{t('settings.skills.col_budget_line')}</th>
                          <th className="py-2.5 px-3 w-40 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {budgetLines.map((bl) => {
                          const lineColor = bl.color || BUDGET_PALETTE_32[0].hex;
                          return (
                            <tr key={bl.id} className="hover:bg-slate-50/60">
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 shadow-2xs"
                                    style={{ backgroundColor: lineColor }}
                                  />
                                  <div>
                                    <span className="font-semibold text-slate-800">{bl.name}</span>
                                    <span className="text-[11px] text-slate-400 block">
                                      {bl.manager} ({bl.budgetKe} K€)
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    disabled={!isCapped || isReadOnly}
                                    value={allocations[bl.id] ?? 0}
                                    onChange={(e) => handleAllocationChange(bl.id, e.target.value)}
                                    className="w-20 px-2 py-1 border border-slate-300 rounded text-center text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                                  />
                                  <span className="font-bold text-slate-500">%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-700">
                        <tr>
                          <td className="py-2.5 px-3">{t('modals.skill.total_allocated')}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`font-mono text-xs font-bold ${
                                totalPercentage > 100
                                  ? 'text-red-600'
                                  : totalPercentage === 100
                                  ? 'text-emerald-700'
                                  : 'text-indigo-700'
                              }`}
                            >
                              {totalPercentage}%
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Unique bargraph horizontal de répartition */}
                {budgetLines.length > 0 && (
                  <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t('modals.skill.distribution_title')}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {totalPercentage > 100 ? (
                          <span className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{totalPercentage}% (&gt; 100%)</span>
                          </span>
                        ) : totalPercentage === 100 ? (
                          <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>100%</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {totalPercentage}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full h-8 bg-slate-200 rounded-lg overflow-hidden flex border border-slate-300/80 shadow-inner">
                      {barSlices.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-400 italic">
                          0%
                        </div>
                      ) : (
                        <>
                          {barSlices.map((slice) => {
                            const base = Math.max(100, totalPercentage);
                            const widthPct = (slice.value / base) * 100;

                            return (
                              <div
                                key={slice.id}
                                style={{
                                  width: `${widthPct}%`,
                                  backgroundColor: slice.color,
                                }}
                                className="h-full relative group transition-all duration-300 flex items-center justify-center border-r border-white/30 last:border-r-0"
                                title={`${slice.label} : ${slice.value}%`}
                              >
                                {slice.value >= 6 && (
                                  <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] truncate px-1 select-none">
                                    {slice.value}%
                                  </span>
                                )}
                              </div>
                            );
                          })}

                          {totalPercentage < 100 && (
                            <div
                              style={{ width: `${100 - totalPercentage}%` }}
                              className="h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-medium italic select-none"
                            >
                              {100 - totalPercentage >= 15 && (
                                <span>{100 - totalPercentage}%</span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pied modal : Boutons d'action (bandeau inférieur fixe) */}
          <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              {!isReadOnly && missingRequiredCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    {missingRequiredCount === 1
                      ? t('modals.common.missing_required_one')
                      : t('modals.common.missing_required_other', { count: missingRequiredCount })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isReadOnly ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  {t('modals.common.close')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    {t('modals.common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || missingRequiredCount > 0}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 cursor-pointer"
                  >
                    {saving
                      ? t('modals.common.saving')
                      : skillToEdit
                      ? t('modals.skill.btn_save')
                      : t('modals.skill.btn_create')}
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
