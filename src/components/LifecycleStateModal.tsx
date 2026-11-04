import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, GitFork, AlertCircle, CheckCircle2, UserCheck, ListOrdered } from 'lucide-react';
import { ProjectState, ProjectStateFormData } from '../types/lifecycle';
import {
  CHECKBOX_INPUT_CLASS,
  CHECKBOX_TITLE_CLASS,
  CHECKBOX_DESCRIPTION_CLASS,
  MODAL_CANCEL_BUTTON_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_TITLE_CLASS,
} from '../constants/ui';

interface LifecycleStateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProjectStateFormData) => Promise<void>;
  editingState?: ProjectState | null;
  existingStates: ProjectState[];
  isReadOnly?: boolean;
}

export const LifecycleStateModal: React.FC<LifecycleStateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingState,
  existingStates,
  isReadOnly = false,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [needsStaffing, setNeedsStaffing] = useState(false);
  const [needsPrioritization, setNeedsPrioritization] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingState) {
      setName(editingState.name);
      setDescription(editingState.description || '');
      setNeedsStaffing(Boolean(editingState.needsStaffing));
      setNeedsPrioritization(Boolean(editingState.needsPrioritization));
    } else {
      setName('');
      setDescription('');
      setNeedsStaffing(false);
      setNeedsPrioritization(false);
    }
    setError(null);
  }, [editingState, isOpen]);

  // Nombre d'attributs obligatoires non renseignés
  const missingRequiredCount = useMemo(() => {
    let count = 0;
    if (!name.trim()) count++;
    return count;
  }, [name]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(t('modals.lifecycle_state.error_name_required'));
      return;
    }

    // Vérification locale d'unicité (clé unique)
    const duplicate = existingStates.some(
      (s) =>
        s.name.trim().toLowerCase() === cleanName.toLowerCase() &&
        (!editingState || s.id !== editingState.id)
    );
    if (duplicate) {
      setError(t('modals.lifecycle_state.error_name_duplicate', { name: cleanName }));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const order = editingState ? editingState.order : existingStates.length;
      await onSave({
        name: cleanName,
        description: description.trim(),
        needsStaffing,
        needsPrioritization,
        order,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || t('modals.lifecycle_state.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête (toujours visible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-200 text-blue-950 rounded-xl border border-slate-300 shrink-0">
              <GitFork className="w-5 h-5 text-blue-950" />
            </div>
            <div>
              <h3 className={`${MODAL_TITLE_CLASS} text-slate-900`}>
                {isReadOnly
                  ? t('modals.lifecycle_state.title_view', { name: editingState?.name || '' })
                  : editingState
                  ? t('modals.lifecycle_state.title_edit', { name: editingState.name })
                  : t('modals.lifecycle_state.title_create')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('modals.lifecycle_state.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
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
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Nom (clé unique, obligatoire) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {t('modals.lifecycle_state.name_label')} {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={!isReadOnly}
                disabled={isReadOnly}
                autoFocus={!isReadOnly}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder={t('modals.lifecycle_state.name_placeholder')}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
              />
            </div>

            {/* Description (facultative) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('modals.lifecycle_state.description_label')}
                </label>
                <span className={`text-[11px] font-mono ${description.length > 500 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                  {description.length} / 500 car.
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={500}
                disabled={isReadOnly}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('modals.lifecycle_state.description_placeholder')}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y disabled:bg-slate-50 disabled:text-slate-700"
              />
            </div>

            {/* Attributs "à staffer" et "à prioriser" */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {/* Boîte à cocher : À staffer */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} select-none group ${
                  needsStaffing
                    ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-300/60'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={needsStaffing}
                  disabled={isReadOnly}
                  onChange={(e) => setNeedsStaffing(e.target.checked)}
                  className={`mt-0.5 ${CHECKBOX_INPUT_CLASS}`}
                />
                <div className="flex-1">
                  <div className={`flex items-center gap-1.5 ${CHECKBOX_TITLE_CLASS}`}>
                    <UserCheck className="w-3.5 h-3.5 text-rose-900 group-hover:text-rose-950 transition-colors" />
                    <span>{t('modals.lifecycle_state.staffed_title')}</span>
                  </div>
                  <p className={`mt-0.5 ${CHECKBOX_DESCRIPTION_CLASS}`}>
                    {t('modals.lifecycle_state.staffed_desc')}
                  </p>
                </div>
              </label>

              {/* Boîte à cocher : À prioriser */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} select-none group ${
                  needsPrioritization
                    ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-300/60'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={needsPrioritization}
                  disabled={isReadOnly}
                  onChange={(e) => setNeedsPrioritization(e.target.checked)}
                  className={`mt-0.5 ${CHECKBOX_INPUT_CLASS}`}
                />
                <div className="flex-1">
                  <div className={`flex items-center gap-1.5 ${CHECKBOX_TITLE_CLASS}`}>
                    <ListOrdered className="w-3.5 h-3.5 text-blue-600 group-hover:text-blue-800 transition-colors" />
                    <span>{t('modals.lifecycle_state.prioritized_title')}</span>
                  </div>
                  <p className={`mt-0.5 ${CHECKBOX_DESCRIPTION_CLASS}`}>
                    {t('modals.lifecycle_state.prioritized_desc')}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Boutons d'action (bandeau inférieur fixe) */}
          <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2.5">
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
            <div className="flex items-center gap-2.5 shrink-0">
              {isReadOnly ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={MODAL_CLOSE_BUTTON_CLASS}
                >
                  {t('modals.common.close')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className={MODAL_CANCEL_BUTTON_CLASS}
                  >
                    {t('modals.common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || missingRequiredCount > 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {saving
                        ? t('modals.common.saving')
                        : editingState
                        ? t('modals.lifecycle_state.btn_save')
                        : t('modals.lifecycle_state.btn_create')}
                    </span>
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
