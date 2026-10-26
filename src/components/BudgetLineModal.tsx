import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, DollarSign, User, Tag, Palette, Check, Coins } from 'lucide-react';
import { BudgetLine, BudgetLineFormData } from '../types/budget';
import { BUDGET_PALETTE_32, getFirstAvailableColor } from '../constants/colors';

interface BudgetLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: BudgetLineFormData) => Promise<void>;
  lineToEdit?: BudgetLine | null;
  existingLines: BudgetLine[];
  isReadOnly?: boolean;
}

export const BudgetLineModal: React.FC<BudgetLineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  lineToEdit,
  existingLines,
  isReadOnly = false,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budgetKe, setBudgetKe] = useState<number | ''>('');
  const [manager, setManager] = useState('');
  const [color, setColor] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Couleurs déjà occupées par les autres lignes
  const usedColors = useMemo(() => {
    return existingLines
      .filter((line) => line.id !== lineToEdit?.id)
      .map((line) => (line.color || '').toLowerCase())
      .filter(Boolean);
  }, [existingLines, lineToEdit]);

  useEffect(() => {
    if (lineToEdit) {
      setName(lineToEdit.name);
      setDescription(lineToEdit.description || '');
      setBudgetKe(lineToEdit.budgetKe);
      setManager(lineToEdit.manager);
      setColor(lineToEdit.color || getFirstAvailableColor(usedColors));
      setIsActive(lineToEdit.isActive !== false);
    } else {
      setName('');
      setDescription('');
      setBudgetKe('');
      setManager('');
      setColor(getFirstAvailableColor(usedColors));
      setIsActive(true);
    }
    setError(null);
  }, [lineToEdit, isOpen, usedColors]);

  // Nombre d'attributs obligatoires non renseignés
  const missingRequiredCount = useMemo(() => {
    let count = 0;
    if (!name.trim()) count++;
    if (budgetKe === '' || isNaN(Number(budgetKe)) || Number(budgetKe) < 0) count++;
    if (!manager.trim()) count++;
    if (!color) count++;
    return count;
  }, [name, budgetKe, manager, color]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedManager = manager.trim();

    if (!trimmedName) {
      setError(t('modals.budget_line.error_name_required'));
      return;
    }

    if (budgetKe === '' || isNaN(Number(budgetKe)) || Number(budgetKe) < 0) {
      setError(t('modals.budget_line.error_budget_invalid'));
      return;
    }

    if (!trimmedManager) {
      setError(t('modals.budget_line.error_manager_required'));
      return;
    }

    if (!color) {
      setError(t('modals.budget_line.error_color_required'));
      return;
    }

    // Vérification du nom unique (insensible à la casse)
    const isDuplicate = existingLines.some(
      (line) =>
        line.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        line.id !== lineToEdit?.id
    );

    if (isDuplicate) {
      setError(t('modals.budget_line.error_name_duplicate', { name: trimmedName }));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const order = lineToEdit
        ? lineToEdit.order
        : existingLines.length > 0
        ? Math.max(...existingLines.map((l) => l.order)) + 1
        : 0;

      await onSave({
        name: trimmedName,
        description: description.trim(),
        budgetKe: Number(budgetKe),
        manager: trimmedManager,
        color,
        isActive,
        order,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || t('modals.budget_line.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const selectedColorObj = BUDGET_PALETTE_32.find(
    (c) => c.hex.toLowerCase() === color.toLowerCase()
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête (toujours visible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-100 text-teal-600 rounded-xl border border-teal-200 shrink-0">
              <Coins className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {isReadOnly
                  ? t('modals.budget_line.title_view', { name: lineToEdit?.name || '' })
                  : lineToEdit
                  ? t('modals.budget_line.title_edit', { name: lineToEdit.name })
                  : t('modals.budget_line.title_create')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('modals.budget_line.subtitle')}
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

            {/* Nom unique */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {t('modals.budget_line.name_label')} {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  required={!isReadOnly}
                  disabled={isReadOnly}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('modals.budget_line.name_placeholder')}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
                />
              </div>
            </div>

            {/* Description (facultative) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('modals.budget_line.description_label')}
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
                placeholder={t('modals.budget_line.description_placeholder')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700 resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Budget en K€ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('modals.budget_line.budget_label')} {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="number"
                    required={!isReadOnly}
                    disabled={isReadOnly}
                    min="0"
                    step="1"
                    value={budgetKe}
                    onChange={(e) => setBudgetKe(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={t('modals.budget_line.budget_placeholder')}
                    className="w-full pl-9 pr-12 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold disabled:bg-slate-50 disabled:text-slate-700"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">
                    K€
                  </span>
                </div>
              </div>

              {/* Responsable */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('modals.budget_line.manager_label')} {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required={!isReadOnly}
                    disabled={isReadOnly}
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    placeholder={t('modals.budget_line.manager_placeholder')}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Palette de 32 couleurs */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t('modals.budget_line.color_label')}</span>
                  <span className="text-red-500">*</span>
                </label>

                {selectedColorObj && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs"
                      style={{ backgroundColor: selectedColorObj.hex }}
                    />
                    <span className="font-semibold text-slate-800">{selectedColorObj.name}</span>
                  </div>
                )}
              </div>

              {/* Grille des 32 pastilles */}
              <div className="grid grid-cols-8 gap-2 pt-1">
                {BUDGET_PALETTE_32.map((pColor) => {
                  const isSelected = pColor.hex.toLowerCase() === color.toLowerCase();
                  const isTaken = usedColors.includes(pColor.hex.toLowerCase());

                  if (isTaken) {
                    return (
                      <div
                        key={pColor.hex}
                        className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-300 opacity-30 cursor-not-allowed select-none"
                        style={{ backgroundColor: pColor.hex }}
                        title={`${pColor.name} (Couleur déjà prise)`}
                      >
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 32 32">
                          <line
                            x1="0"
                            y1="0"
                            x2="32"
                            y2="32"
                            stroke="#ef4444"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                          <line
                            x1="32"
                            y1="0"
                            x2="0"
                            y2="32"
                            stroke="#ef4444"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={pColor.hex}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setColor(pColor.hex)}
                      style={{ backgroundColor: pColor.hex }}
                      title={`${pColor.name} ${isReadOnly ? '' : '(Disponible)'}`}
                      className={`relative w-8 h-8 rounded-lg transition-transform ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} flex items-center justify-center shadow-2xs ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-indigo-600 scale-105'
                          : 'border border-black/15'
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Boîte à cocher Activation */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center">
              <label htmlFor="budget-is-active" className={`flex items-center gap-2.5 ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  id="budget-is-active"
                  checked={isActive}
                  disabled={isReadOnly}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {t('modals.budget_line.active_title')}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {t('modals.budget_line.active_desc')}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Bandeau d'actions fixe */}
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
                      : lineToEdit
                      ? t('modals.budget_line.btn_save')
                      : t('modals.budget_line.btn_create')}
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
