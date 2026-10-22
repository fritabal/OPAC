import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, Sliders } from 'lucide-react';
import {
  Criterion,
  CriterionFormData,
  CriterionType,
  CriterionWeight,
  CRITERION_POINTS,
  CRITERION_WEIGHTS,
} from '../types/criteria';

interface CriterionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CriterionFormData) => Promise<void>;
  criterionToEdit?: Criterion | null;
  existingCriteria: Criterion[];
  isReadOnly?: boolean;
}

export const CriterionModal: React.FC<CriterionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  criterionToEdit,
  existingCriteria,
  isReadOnly = false,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CriterionType>('VALEUR');
  const [weight, setWeight] = useState<CriterionWeight>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [levels, setLevels] = useState<[string, string, string, string, string, string]>([
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (criterionToEdit) {
      setName(criterionToEdit.name);
      setDescription(criterionToEdit.description || '');
      setType(criterionToEdit.type);
      setWeight(criterionToEdit.weight ?? 1);
      setIsActive(criterionToEdit.isActive !== false);
      setLevels([...criterionToEdit.levels]);
    } else {
      setName('');
      setDescription('');
      setType('VALEUR');
      setWeight(1);
      setIsActive(true);
      setLevels(['', '', '', '', '', '']);
    }
    setError(null);
  }, [criterionToEdit, isOpen]);

  // Nombre d'attributs obligatoires non renseignés
  const missingRequiredCount = useMemo(() => {
    let count = 0;
    if (!name.trim()) count++;
    count += levels.filter((lvl) => !lvl.trim()).length;
    return count;
  }, [name, levels]);

  if (!isOpen) return null;

  const handleLevelChange = (index: number, val: string) => {
    const updated = [...levels] as [string, string, string, string, string, string];
    updated[index] = val;
    setLevels(updated);
  };

  const handleApplyExample = () => {
    setName('CA additionnel');
    setType('VALEUR');
    setWeight(2);
    setIsActive(true);
    setLevels([
      '0 K€/an',
      'de 0 à 10 K€/an',
      'de 10 à 50 K€/an',
      'de 50 à 200 K€/an',
      'de 200 à 500 K€/an',
      'plus de 500 K€/an',
    ]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Le nom du critère est obligatoire.');
      return;
    }

    // Check unique name (case-insensitive)
    const isDuplicate = existingCriteria.some(
      (c) =>
        c.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        c.id !== criterionToEdit?.id
    );

    if (isDuplicate) {
      setError(`Un critère nommé "${trimmedName}" existe déjà. Le nom doit être unique.`);
      return;
    }

    // Check that all 6 levels are provided
    for (let i = 0; i < 6; i++) {
      if (!levels[i].trim()) {
        setError(`Veuillez renseigner le libellé pour l'échelon correspondant à = ${CRITERION_POINTS[i]}.`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const order = criterionToEdit
        ? criterionToEdit.order
        : existingCriteria.length > 0
        ? Math.max(...existingCriteria.map((c) => c.order)) + 1
        : 0;

      await onSave({
        name: trimmedName,
        description: description.trim(),
        type,
        weight,
        isActive,
        levels: levels.map((lvl) => lvl.trim()) as [string, string, string, string, string, string],
        order,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de l’enregistrement du critère.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête (toujours visible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl border border-emerald-200 shrink-0">
              <Sliders className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {isReadOnly
                  ? `Critère de priorisation : ${criterionToEdit?.name || ''}`
                  : criterionToEdit
                  ? 'Modifier le critère de priorisation : ' + criterionToEdit.name
                  : 'Nouveau critère de priorisation'}
              </h3>
              <p className="text-xs text-slate-500">
                {isReadOnly
                  ? 'Visualisation des paramètres, du type, du poids et de l\'échelle de cotation (Mode lecture seule).'
                  : 'Définissez le nom, le type, le poids relatif, l\'activation et les 6 libellés de l’échelle de cotation (0, 1, 2, 3, 5, 8).'}
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

          {!criterionToEdit && !isReadOnly && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleApplyExample}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Pré-remplir avec l'exemple « CA additionnel » (Poids 2)
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Nom du critère */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nom du critère (unique) {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={!isReadOnly}
                disabled={isReadOnly}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : CA additionnel, Alignement stratégique..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
              />
            </div>

            {/* Type de critère */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Type {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <select
                value={type}
                disabled={isReadOnly}
                onChange={(e) => setType(e.target.value as CriterionType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium cursor-pointer disabled:bg-slate-50 disabled:text-slate-700 disabled:cursor-not-allowed"
              >
                <option value="VALEUR">VALEUR</option>
                <option value="COÛT">COÛT</option>
              </select>
            </div>

            {/* Poids relatif */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Poids relatif {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <select
                value={weight}
                disabled={isReadOnly}
                onChange={(e) => setWeight(Number(e.target.value) as CriterionWeight)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-800 cursor-pointer disabled:bg-slate-50 disabled:text-slate-700 disabled:cursor-not-allowed"
              >
                {CRITERION_WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description (facultative) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Description (facultative)
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
              placeholder="Saisissez une description..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700 resize-y"
            />
          </div>

          {/* Statut Actif / Inactif */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center">
            <label htmlFor="criterion-is-active" className={`flex items-center gap-2.5 ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                id="criterion-is-active"
                checked={isActive}
                disabled={isReadOnly}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Critère actif (pris en compte dans les calculs de priorité)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Si décoché, le critère est conservé dans le référentiel mais exclu des calculs de priorité.
                </span>
              </div>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Échelle de cotation (6 valeurs textuelles pour 0, 1, 2, 3, 5, 8) {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <span className="text-[11px] text-slate-500">Poids appliqué : ×{weight}</span>
            </div>
            <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              {CRITERION_POINTS.map((points, idx) => (
                <div key={points} className="flex items-center gap-3">
                  <div className="w-16 shrink-0 text-center py-1.5 px-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 shadow-2xs">
                    = {points}
                  </div>
                  <input
                    type="text"
                    required={!isReadOnly}
                    disabled={isReadOnly}
                    value={levels[idx]}
                    onChange={(e) => handleLevelChange(idx, e.target.value)}
                    placeholder={`Valeur textuelle pour note ${points}`}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
                  />
                </div>
              ))}
            </div>
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
                    ? '1 attribut obligatoire non renseigné'
                    : `${missingRequiredCount} attributs obligatoires non renseignés`}
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
                  disabled={saving || missingRequiredCount > 0}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : criterionToEdit ? 'Enregistrer les modifications' : 'Créer le critère'}
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
