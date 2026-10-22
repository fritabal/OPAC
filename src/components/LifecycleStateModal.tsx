import React, { useState, useEffect, useMemo } from 'react';
import { X, GitFork, AlertCircle, CheckCircle2, UserCheck, SlidersHorizontal } from 'lucide-react';
import { ProjectState, ProjectStateFormData } from '../types/lifecycle';

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
      setError("Le nom de l'état est obligatoire.");
      return;
    }

    // Vérification locale d'unicité (clé unique)
    const duplicate = existingStates.some(
      (s) =>
        s.name.trim().toLowerCase() === cleanName.toLowerCase() &&
        (!editingState || s.id !== editingState.id)
    );
    if (duplicate) {
      setError(`Un état nommé « ${cleanName} » existe déjà dans le cycle de vie. Le nom doit être unique.`);
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
      setError(err?.message || "Erreur lors de l'enregistrement de l'état.");
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
              <h3 className="font-semibold text-slate-900 text-base">
                {isReadOnly
                  ? `Etat du cycle de vie projet : ${editingState?.name || ''}`
                  : editingState
                  ? 'Modifier l’état du cycle de vie projet : ' + editingState.name
                  : 'Nouvel état du cycle de vie projet'}
              </h3>
              <p className="text-xs text-slate-500">
                {isReadOnly
                  ? 'Propriétés et attributs de cet état (Mode lecture seule).'
                  : 'Définissez les propriétés et les attributs de cet état pour les projets.'}
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
              Nom de l'état {!isReadOnly && <span className="text-red-500">*</span>}
              <span className="text-slate-400 font-normal lowercase ml-1">(clé unique obligatoire)</span>
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
              placeholder="Ex: Cadrage, À staffer, En cours, Livré..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
            />
            <p className="text-[11px] text-slate-500">
              Ce libellé servira de référence d'étape pour les projets dans le workflow.
            </p>
          </div>

          {/* Description (facultative) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
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
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y disabled:bg-slate-50 disabled:text-slate-700"
            />
          </div>

          {/* Attributs "à staffer" et "à prioriser" */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Attributs d'automatisation et de pilotage :
            </label>

            {/* Boîte à cocher : À staffer */}
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} select-none ${
                needsStaffing
                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 ring-1 ring-emerald-300/60'
                  : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <input
                type="checkbox"
                checked={needsStaffing}
                disabled={isReadOnly}
                onChange={(e) => setNeedsStaffing(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>À staffer</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Cochez cette case si les projets ayant cet état nécessitent l'affectation ou le suivi des compétences clés et ressources (Resource Managers).
                </p>
              </div>
            </label>

            {/* Boîte à cocher : À prioriser */}
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} select-none ${
                needsPrioritization
                  ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 ring-1 ring-indigo-300/60'
                  : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <input
                type="checkbox"
                checked={needsPrioritization}
                disabled={isReadOnly}
                onChange={(e) => setNeedsPrioritization(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                  <span>À prioriser</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Cochez cette case si les projets à cet état doivent être évalués sur la grille des critères de priorisation (Valeur & Coût) et soumis aux arbitrages.
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
                    ? '1 attribut obligatoire non renseigné'
                    : `${missingRequiredCount} attributs obligatoires non renseignés`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Fermer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || missingRequiredCount > 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{saving ? 'Enregistrement...' : editingState ? 'Enregistrer les modifications' : "Créer l'état"}</span>
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
