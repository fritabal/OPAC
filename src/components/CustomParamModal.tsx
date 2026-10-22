import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  SlidersHorizontal,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  List,
  Check,
  CheckSquare,
} from 'lucide-react';
import {
  CustomProjectParam,
  CustomProjectParamFormData,
  CustomParamType,
  CUSTOM_PARAM_TYPES,
  CUSTOM_PARAM_TYPE_LABELS,
  CUSTOM_PARAM_TYPE_DESCRIPTIONS,
} from '../types/customParam';
import {
  addCustomParam,
  updateCustomParam,
  checkCustomParamNameExists,
} from '../services/customParamService';

interface CustomParamModalProps {
  isOpen: boolean;
  onClose: () => void;
  paramToEdit?: CustomProjectParam | null;
  onSuccess: () => void;
  isReadOnly?: boolean;
}

export const CustomParamModal: React.FC<CustomParamModalProps> = ({
  isOpen,
  onClose,
  paramToEdit,
  onSuccess,
  isReadOnly = false,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CustomParamType>('texte court');
  const [options, setOptions] = useState<string[]>([]);
  const [allowMultiple, setAllowMultiple] = useState<boolean>(false);
  const [isRequired, setIsRequired] = useState<boolean>(false);
  const [showInTable, setShowInTable] = useState<boolean>(false);
  const [newOptionInput, setNewOptionInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (paramToEdit) {
      setName(paramToEdit.name);
      setDescription(paramToEdit.description || '');
      setType(paramToEdit.type || 'texte court');
      setOptions(Array.isArray(paramToEdit.options) ? [...paramToEdit.options] : []);
      setAllowMultiple(Boolean(paramToEdit.allowMultiple));
      setIsRequired(Boolean(paramToEdit.isRequired));
      setShowInTable(Boolean(paramToEdit.showInTable));
    } else {
      setName('');
      setDescription('');
      setType('texte court');
      setOptions([]);
      setAllowMultiple(false);
      setIsRequired(false);
      setShowInTable(false);
    }
    setNewOptionInput('');
    setError(null);
  }, [paramToEdit, isOpen]);

  // Nombre d'attributs obligatoires non renseignés
  const missingRequiredCount = useMemo(() => {
    let count = 0;
    if (!name.trim()) count++;
    if (type === 'liste de valeurs' && options.length === 0) count++;
    return count;
  }, [name, type, options]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    const val = newOptionInput.trim();
    if (!val) return;
    if (options.some((o) => o.toLowerCase() === val.toLowerCase())) {
      setError(`La valeur « ${val} » existe déjà dans la liste.`);
      return;
    }
    setOptions((prev) => [...prev, val]);
    setNewOptionInput('');
    setError(null);
  };

  const handleRemoveOption = (indexToRemove: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleMoveOption = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= options.length) return;
    const newOpts = [...options];
    const [moved] = newOpts.splice(index, 1);
    newOpts.splice(targetIndex, 0, moved);
    setOptions(newOpts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom du paramètre personnalisé est obligatoire.');
      return;
    }

    if (trimmedName.length > 30) {
      setError('Le nom ne peut pas dépasser 30 caractères.');
      return;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length > 500) {
      setError('La description ne peut pas dépasser 500 caractères.');
      return;
    }

    if (type === 'liste de valeurs' && options.length === 0) {
      setError('Veuillez ajouter au moins une valeur prédéfinie pour la liste.');
      return;
    }

    setSaving(true);
    try {
      const exists = await checkCustomParamNameExists(trimmedName, paramToEdit?.id);
      if (exists) {
        setError(`Un paramètre nommé « ${trimmedName} » existe déjà. Le nom doit être une clé unique.`);
        setSaving(false);
        return;
      }

      if (paramToEdit) {
        await updateCustomParam(paramToEdit.id, {
          name: trimmedName,
          description: trimmedDesc,
          type,
          options: type === 'liste de valeurs' ? options : [],
          allowMultiple: type === 'liste de valeurs' ? allowMultiple : false,
          isRequired,
          showInTable,
        });
      } else {
        const formData: CustomProjectParamFormData = {
          name: trimmedName,
          description: trimmedDesc,
          type,
          order: 0,
          options: type === 'liste de valeurs' ? options : [],
          allowMultiple: type === 'liste de valeurs' ? allowMultiple : false,
          isRequired,
          showInTable,
        };
        await addCustomParam(formData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue lors de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* En-tête (toujours visible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-100 text-sky-500 rounded-xl border border-sky-200 shrink-0">
              <SlidersHorizontal className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {isReadOnly
                  ? `Paramètre projet personnalisé : ${paramToEdit?.name || ''}`
                  : paramToEdit
                  ? 'Modifier le paramètre personnalisé : ' + paramToEdit.name
                  : 'Nouveau paramètre personnalisé de projet'}
              </h3>
              <p className="text-xs text-slate-500">
                {isReadOnly
                  ? 'Champ additionnel configurable pour les projets (Mode lecture seule)'
                  : 'Champ additionnel configurable pour les projets'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire avec zone de saisie défilable et pied fixe */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 [scrollbar-width:thin]">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

          {/* Nom du paramètre (30 car. max, clé unique) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Nom du paramètre {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <span className={`text-[11px] font-mono ${name.length > 30 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                {name.length} / 30 car.
              </span>
            </div>
            <input
              type="text"
              required={!isReadOnly}
              disabled={isReadOnly}
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Référence contrat"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium disabled:bg-slate-50 disabled:text-slate-700"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Clé unique (30 caractères max), apparaîtra dans l’encart « Autres » du projet.
            </p>
          </div>

          {/* Type du paramètre */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Type de donnée {!isReadOnly && <span className="text-red-500">*</span>}
            </label>
            <select
              value={type}
              disabled={isReadOnly}
              onChange={(e) => setType(e.target.value as CustomParamType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:text-slate-700 disabled:cursor-not-allowed"
            >
              {CUSTOM_PARAM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CUSTOM_PARAM_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{CUSTOM_PARAM_TYPE_DESCRIPTIONS[type]}</span>
            </p>
          </div>

          {/* Configuration spécifique pour la liste de valeurs prédéfinies */}
          {type === 'liste de valeurs' && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                <List className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Configuration de la liste de valeurs</span>
              </div>

              {/* Mode de sélection : choix unique ou choix multiple */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sélection autorisée dans le projet {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setAllowMultiple(false)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                      !allowMultiple
                        ? 'border-indigo-600 bg-white text-indigo-950 shadow-2xs ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        !allowMultiple ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}
                    >
                      {!allowMultiple && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold">Valeur unique</div>
                      <div className="text-[11px] text-slate-500">Une et une seule valeur sélectionnable</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setAllowMultiple(true)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                      allowMultiple
                        ? 'border-indigo-600 bg-white text-indigo-950 shadow-2xs ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                        allowMultiple ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}
                    >
                      {allowMultiple && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold">Valeurs multiples</div>
                      <div className="text-[11px] text-slate-500">Plusieurs valeurs sélectionnables</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Gestion des valeurs prédéfinies */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Valeurs prédéfinies de la liste {!isReadOnly && <span className="text-red-500">*</span>}
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {options.length} valeur{options.length > 1 ? 's' : ''}
                  </span>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      placeholder="Ajouter une valeur (ex : France, Prioritaire...)"
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      disabled={!newOptionInput.trim()}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                )}

                {/* Liste des options */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 bg-white rounded-xl p-2">
                  {options.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs italic">
                      Aucune valeur définie. Saisissez une valeur ci-dessus puis cliquez sur Ajouter.
                    </div>
                  ) : (
                    options.map((opt, idx) => (
                      <div
                        key={`${opt}_${idx}`}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate font-medium">{opt}</span>
                        </div>

                        {!isReadOnly && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveOption(idx, 'up')}
                              disabled={idx === 0}
                              title="Monter"
                              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOption(idx, 'down')}
                              disabled={idx === options.length - 1}
                              title="Descendre"
                              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx)}
                              title="Supprimer cette valeur"
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description du paramètre (100 car. max) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Description (facultative)
              </label>
              <span className={`text-[11px] font-mono ${description.length > 500 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                {description.length} / 500 car.
              </span>
            </div>
            <textarea
              rows={2}
              disabled={isReadOnly}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Saisissez une description..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-700 resize-y"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Affichée au survol du point d’interrogation (?) dans le projet (500 caractères max).
            </p>
          </div>

          {/* Attribut Obligatoire (case à cocher) */}
          <div className="pt-1">
            <label className={`flex items-start gap-3 p-3 rounded-xl border border-slate-200 transition-colors select-none ${
              isReadOnly ? 'bg-slate-50 cursor-default' : 'bg-slate-50/70 hover:bg-slate-50 cursor-pointer'
            }`}>
              <input
                type="checkbox"
                checked={isRequired}
                disabled={isReadOnly}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">Paramètre obligatoire</span>
                  <span className="text-red-500 font-bold">*</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Si coché, une étoile rouge apparaîtra à droite du nom dans les fiches projets et la saisie de ce paramètre sera obligatoire pour pouvoir enregistrer le projet.
                </p>
              </div>
            </label>
          </div>

          {/* Attribut Affiché dans le tableau (case à cocher) */}
          <div>
            <label className={`flex items-start gap-3 p-3 rounded-xl border border-slate-200 transition-colors select-none ${
              isReadOnly ? 'bg-slate-50 cursor-default' : 'bg-slate-50/70 hover:bg-slate-50 cursor-pointer'
            }`}>
              <input
                type="checkbox"
                checked={showInTable}
                disabled={isReadOnly}
                onChange={(e) => setShowInTable(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">Affiché dans le tableau</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Si coché, ce paramètre apparaîtra sous forme de colonne dédiée dans le tableau des projets de l’onglet Priorités, selon l’ordre configuré.
                </p>
              </div>
            </label>
          </div>

          </div>

          {/* Boutons d'action (bandeau inférieur fixe) */}
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
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving || missingRequiredCount > 0 || name.length > 30 || description.length > 500}
                    className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Enregistrement...' : paramToEdit ? 'Enregistrer les modifications' : 'Créer le paramètre'}
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
