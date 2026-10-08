import React, { useState, useEffect, useMemo } from 'react';
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
  const [name, setName] = useState('');
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
      setBudgetKe(lineToEdit.budgetKe);
      setManager(lineToEdit.manager);
      setColor(lineToEdit.color || getFirstAvailableColor(usedColors));
      setIsActive(lineToEdit.isActive !== false);
    } else {
      setName('');
      setBudgetKe('');
      setManager('');
      setColor(getFirstAvailableColor(usedColors));
      setIsActive(true);
    }
    setError(null);
  }, [lineToEdit, isOpen, usedColors]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedManager = manager.trim();

    if (!trimmedName) {
      setError('Le nom de la ligne budgétaire est obligatoire.');
      return;
    }

    if (budgetKe === '' || isNaN(Number(budgetKe)) || Number(budgetKe) < 0) {
      setError('Le budget en K€ doit être un nombre positif ou nul.');
      return;
    }

    if (!trimmedManager) {
      setError('Le responsable de la ligne budgétaire est obligatoire.');
      return;
    }

    if (!color) {
      setError('Veuillez sélectionner une couleur distinctive pour cette ligne.');
      return;
    }

    // Vérification unicité de couleur
    if (usedColors.includes(color.toLowerCase())) {
      setError('Cette couleur est déjà utilisée par une autre ligne budgétaire. Choisissez une couleur libre.');
      return;
    }

    // Vérification du nom unique (insensible à la casse)
    const isDuplicate = existingLines.some(
      (line) =>
        line.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        line.id !== lineToEdit?.id
    );

    if (isDuplicate) {
      setError(`Une ligne budgétaire nommée « ${trimmedName} » existe déjà. Le nom doit être unique.`);
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
        budgetKe: Number(budgetKe),
        manager: trimmedManager,
        color,
        isActive,
        order,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'enregistrement de la ligne budgétaire.");
    } finally {
      setSaving(false);
    }
  };

  const selectedColorObj = BUDGET_PALETTE_32.find(
    (c) => c.hex.toLowerCase() === color.toLowerCase()
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-100 text-teal-600 rounded-xl border border-teal-200 shrink-0">
              <Coins className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                {isReadOnly
                  ? `Ligne budgétaire : ${lineToEdit?.name || ''}`
                  : lineToEdit
                  ? 'Modifier la ligne budgétaire : ' + lineToEdit.name
                  : 'Nouvelle ligne budgétaire'}
              </h3>
              <p className="text-xs text-slate-500">
                {isReadOnly
                  ? 'Visualisation du budget, responsable, couleur et statut (Mode lecture seule).'
                  : 'Nom unique, budget en K€, responsable, couleur distinctive et statut d\'activation.'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nom unique */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nom de la ligne budgétaire (unique) {!isReadOnly && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                required={!isReadOnly}
                disabled={isReadOnly}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Digital & Innovation, Infrastructure Cloud..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Budget en K€ */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Budget (K€) {!isReadOnly && <span className="text-red-500">*</span>}
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
                  placeholder="Ex : 250"
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
                Responsable {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  required={!isReadOnly}
                  disabled={isReadOnly}
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  placeholder="Ex : Stéphane Labati"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Palette de 32 couleurs (Unicité stricte avec couleurs prises barrées) */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-600" />
                <span>Couleur distinctive (Palette 32 teintes)</span>
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

            <p className="text-[11px] text-slate-500">
              Chaque ligne budgétaire doit avoir sa propre couleur pour être facilement reconnaissable dans le bargraph des compétences clés. Les couleurs déjà utilisées sont barrées.
            </p>

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
                      title={`${pColor.name} (Couleur déjà prise par une autre ligne)`}
                    >
                      {/* Barre diagonale rouge indiquant l'inaccessibilité */}
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
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
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
                  Ligne budgétaire active
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Si décochée, la ligne est désactivée et conservée pour l'historique sans être mobilisable.
                </span>
              </div>
            </label>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded border ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200 italic'
              }`}
            >
              {isActive ? 'Active' : 'Désactivée'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Fermer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : lineToEdit ? 'Mettre à jour' : 'Ajouter la ligne'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
