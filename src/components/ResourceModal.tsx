import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Users, User, Brain, FileText, Check, HelpCircle } from 'lucide-react';
import { Resource, ResourceFormData } from '../types/resource';
import { KeySkill } from '../types/skill';
import { AppUser } from '../types/user';
import { resolveUserDisplayName } from '../utils/userUtils';
import { PRIMARY_ACTION_MODAL_BUTTON_CLASS } from '../constants/ui';

interface ResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ResourceFormData) => Promise<void>;
  resourceToEdit?: Resource | null;
  existingResources: Resource[];
  availableSkills: KeySkill[];
  defaultSkillId?: string;
  isReadOnly?: boolean;
  users?: AppUser[];
}

export const ResourceModal: React.FC<ResourceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  resourceToEdit,
  existingResources,
  availableSkills,
  defaultSkillId,
  isReadOnly = false,
  users = [],
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fte, setFte] = useState<string>('1.0');
  const [skillId, setSkillId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (resourceToEdit) {
      setName(resourceToEdit.name || '');
      setDescription(resourceToEdit.description || '');
      setFte(String(resourceToEdit.fte ?? 1.0));
      setSkillId(resourceToEdit.skillId || (availableSkills[0]?.id ?? ''));
    } else {
      setName('');
      setDescription('');
      setFte('1.0');
      setSkillId(defaultSkillId || availableSkills[0]?.id || '');
    }
    setError(null);
  }, [isOpen, resourceToEdit, defaultSkillId, availableSkills]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom de la ressource est obligatoire.');
      return;
    }

    // Vérification de la clé unique
    const duplicate = existingResources.find(
      (r) =>
        r.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        r.id !== resourceToEdit?.id
    );
    if (duplicate) {
      setError(`Une ressource nommée « ${duplicate.name} » existe déjà. Le nom doit être unique.`);
      return;
    }

    if (!skillId) {
      setError('Veuillez sélectionner une compétence clé de rattachement.');
      return;
    }

    const parsedFte = parseFloat(fte.replace(',', '.'));
    if (isNaN(parsedFte) || parsedFte <= 0) {
      setError("L'équivalent ETP doit être un nombre strictement positif (ex: 1.0 ou 0.8).");
      return;
    }

    const selectedSkill = availableSkills.find((s) => s.id === skillId);

    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        description: description.trim(),
        fte: parsedFte,
        skillId,
        skillName: selectedSkill?.name || '',
        resourceManagerId: selectedSkill?.resourceManagerId || '',
        unavailability: resourceToEdit ? resourceToEdit.unavailability : {},
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'enregistrement de la ressource.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* En-tête avec accent rouge foncé */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-rose-50/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-900 rounded-xl border border-rose-200 shrink-0">
              <Users className="w-5 h-5 text-rose-900" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {isReadOnly
                  ? `Détail de la ressource : ${resourceToEdit?.name || ''}`
                  : resourceToEdit
                  ? `Modifier la ressource : ${resourceToEdit.name}`
                  : 'Nouvelle ressource'}
              </h3>
              <p className="text-xs text-slate-500">
                Individu ou équipe rattaché(e) à une compétence clé.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nom unique */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nom de la ressource (clé unique) {!isReadOnly && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              required={!isReadOnly}
              disabled={isReadOnly}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Martin Dupont, Équipe Cloud Core..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-50"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Peut désigner un collaborateur individuel ou un collectif / équipe entière.
            </p>
          </div>

          {/* Compétence clé de rattachement */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Compétence clé de rattachement {!isReadOnly && <span className="text-red-500">*</span>}
            </label>
            <select
              required={!isReadOnly}
              disabled={isReadOnly || availableSkills.length <= 1}
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-50 bg-white"
            >
              {availableSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({resolveUserDisplayName(s.resourceManagerId, users, s.resourceManagerName) || 'RM'})
                </option>
              ))}
            </select>
          </div>

          {/* Équivalent Temps Plein (ETP) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Équivalent Temps Plein (ETP) {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <span className="text-[11px] text-slate-500 font-medium">Ex : 1.0 (100%), 0.8 (4/5e), 3.0 (équipe de 3)</span>
            </div>
            <input
              type="number"
              step="0.05"
              min="0.05"
              max="100"
              required={!isReadOnly}
              disabled={isReadOnly}
              value={fte}
              onChange={(e) => setFte(e.target.value)}
              placeholder="1.0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description / Notes facultatives
            </label>
            <textarea
              rows={3}
              disabled={isReadOnly}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : Développeur sénior fullstack, disponibilité partielle les vendredis..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {isReadOnly ? 'Fermer' : 'Annuler'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={saving}
                className={PRIMARY_ACTION_MODAL_BUTTON_CLASS}
              >
                {saving ? (
                  <span>Enregistrement...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{resourceToEdit ? 'Enregistrer les modifications' : 'Créer la ressource'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
