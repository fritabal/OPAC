import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Project } from '../types/project';
import { deleteAllProjects } from '../services/projectCsvService';

interface DeleteAllProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[]; // Tous les projets du portefeuille
  selectedProjects?: Project[]; // Projets sélectionnés au lancement
  onSuccess: (count: number) => void;
}

export const DeleteAllProjectsModal: React.FC<DeleteAllProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  selectedProjects = [],
  onSuccess,
}) => {
  const hasSelectedSubset = selectedProjects.length > 0 && selectedProjects.length < projects.length;
  const [scope, setScope] = useState<'selected' | 'all'>(hasSelectedSubset ? 'selected' : 'all');
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Réinitialisation lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      setScope(hasSelectedSubset ? 'selected' : 'all');
      setConfirmInput('');
      setError(null);
      setIsDeleting(false);
    }
  }, [isOpen, hasSelectedSubset]);

  if (!isOpen) return null;

  const targetProjects =
    scope === 'selected' && selectedProjects.length > 0 ? selectedProjects : projects;
  const count = targetProjects.length;
  const isConfirmed = confirmInput.trim().toUpperCase() === 'SUPPRIMER';

  const handleDelete = async () => {
    if (!isConfirmed || count === 0) return;
    setIsDeleting(true);
    setError(null);

    try {
      const deletedCount = await deleteAllProjects(targetProjects);
      onSuccess(deletedCount);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression des projets.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 my-8">
        {/* En-tête */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5 text-rose-600">
            <div className="p-2 bg-rose-100 rounded-xl">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Supprimer des projets
              </h3>
              <p className="text-xs text-slate-500">
                Suppression définitive d'un ensemble de projets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="py-4 space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Action destructrice irréversible</p>
              <p className="mt-1 text-rose-800">
                Les projets supprimés ne pourront pas être récupérés et leurs identifiants séquentiels ne seront jamais réutilisés.
              </p>
            </div>
          </div>

          {/* Choix du périmètre de suppression */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900">
              Périmètre de suppression :
            </label>
            <div className="space-y-2">
              {/* Option 1 : Projets sélectionnés au lancement */}
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  scope === 'selected'
                    ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                } ${selectedProjects.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="deleteScope"
                  value="selected"
                  checked={scope === 'selected'}
                  disabled={selectedProjects.length === 0 || isDeleting}
                  onChange={() => setScope('selected')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Seulement ceux qui étaient sélectionnés ({selectedProjects.length} {selectedProjects.length > 1 ? 'projets' : 'projet'})
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedProjects.length > 0
                      ? `Supprime uniquement les ${selectedProjects.length} ${selectedProjects.length > 1 ? 'projets sélectionnés' : 'projet sélectionné'} au lancement de l'option.`
                      : 'Aucun projet sélectionné au préalable.'}
                  </div>
                </div>
              </label>

              {/* Option 2 : Tous les projets du portefeuille */}
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="deleteScope"
                  value="all"
                  checked={scope === 'all'}
                  disabled={isDeleting}
                  onChange={() => setScope('all')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Tous les projets ({projects.length} {projects.length > 1 ? 'projets' : 'projet'})
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Supprime l'intégralité des projets actuellement enregistrés dans le portefeuille.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Liste récapitulative des projets ciblés */}
          {count > 0 && (
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-700">
                {count > 1 ? 'Projets qui seront supprimés' : 'Projet qui sera supprimé'} ({count}) :
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-slate-700 [scrollbar-width:thin]">
                {targetProjects.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 truncate">
                    <span className="font-mono font-bold text-rose-700 shrink-0">
                      #{p.projectNumber}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </div>
                ))}
                {count > 10 && (
                  <div className="text-[11px] text-slate-400 italic">
                    ... et {count - 10} {count - 10 > 1 ? 'autres projets' : 'autre projet'}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
              {error}
            </div>
          )}

          {/* Saisie de confirmation */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Pour confirmer la suppression de {count > 1 ? 'ces' : 'ce'} <strong className="text-rose-700">{count} {count > 1 ? 'projets' : 'projet'}</strong>, saisissez{' '}
              <span className="font-mono font-bold text-rose-700">SUPPRIMER</span> :
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="SUPPRIMER"
              disabled={isDeleting || count === 0}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-mono uppercase tracking-wider"
            />
          </div>
        </div>

        {/* Pied de page */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting || count === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-xs ${
              !isConfirmed || isDeleting || count === 0
                ? 'bg-rose-300 cursor-not-allowed opacity-60'
                : 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
            }`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Suppression en cours...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Supprimer définitivement ({count})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
