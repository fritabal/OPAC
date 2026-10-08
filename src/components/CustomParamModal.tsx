import React, { useState, useEffect } from 'react';
import { X, SlidersHorizontal, AlertCircle, HelpCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (paramToEdit) {
      setName(paramToEdit.name);
      setDescription(paramToEdit.description || '');
      setType(paramToEdit.type || 'texte court');
    } else {
      setName('');
      setDescription('');
      setType('texte court');
    }
    setError(null);
  }, [paramToEdit, isOpen]);

  if (!isOpen) return null;

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
    if (trimmedDesc.length > 100) {
      setError('La description ne peut pas dépasser 100 caractères.');
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
        });
      } else {
        const formData: CustomProjectParamFormData = {
          name: trimmedName,
          description: trimmedDesc,
          type,
          order: 0,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
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

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {/* Description du paramètre (100 car. max) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Description
              </label>
              <span className={`text-[11px] font-mono ${description.length > 100 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                {description.length} / 100 car.
              </span>
            </div>
            <input
              type="text"
              disabled={isReadOnly}
              maxLength={100}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : Numéro officiel du contrat signé chez le client"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Affichée au survol du point d’interrogation (?) dans le projet (100 caractères max).
            </p>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
                  disabled={saving || !name.trim() || name.length > 30 || description.length > 100}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Enregistrement...' : paramToEdit ? 'Enregistrer les modifications' : 'Créer le paramètre'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
