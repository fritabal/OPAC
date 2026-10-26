import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Project } from '../types/project';

interface ExportProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[]; // Tous les projets du portefeuille
  selectedProjects?: Project[]; // Projets sélectionnés ou pré-filtrés au lancement
  onExport: (targetProjects: Project[]) => void;
}

export const ExportProjectsModal: React.FC<ExportProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  selectedProjects = [],
  onExport,
}) => {
  const hasSelectedSubset = selectedProjects.length > 0 && selectedProjects.length < projects.length;
  const [scope, setScope] = useState<'selected' | 'all'>(hasSelectedSubset ? 'selected' : 'all');
  const [isExporting, setIsExporting] = useState(false);

  // Réinitialisation du périmètre par défaut lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      setScope(hasSelectedSubset ? 'selected' : 'all');
      setIsExporting(false);
    }
  }, [isOpen, hasSelectedSubset]);

  if (!isOpen) return null;

  const targetProjects =
    scope === 'selected' && selectedProjects.length > 0 ? selectedProjects : projects;
  const count = targetProjects.length;

  const handleConfirmExport = () => {
    if (count === 0) return;
    setIsExporting(true);
    try {
      onExport(targetProjects);
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 my-8">
        {/* En-tête */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5 text-indigo-600">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Download className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Exporter des projets
              </h3>
              <p className="text-xs text-slate-500">
                Génération d'un fichier CSV (|) pour tableur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="py-4 space-y-4">
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-3 text-xs text-indigo-900">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Format d'export standardisé</p>
              <p className="mt-1 text-indigo-800 leading-relaxed">
                Le fichier CSV est encodé en UTF-8 avec séparateur barre verticale (|) et BOM pour une compatibilité native directe avec Excel et LibreOffice.
              </p>
            </div>
          </div>

          {/* Choix du périmètre d'exportation */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900">
              Périmètre d'exportation :
            </label>
            <div className="space-y-2">
              {/* Option 1 : Projets sélectionnés au lancement */}
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  scope === 'selected'
                    ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                } ${selectedProjects.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="exportScope"
                  value="selected"
                  checked={scope === 'selected'}
                  disabled={selectedProjects.length === 0 || isExporting}
                  onChange={() => setScope('selected')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Seulement ceux qui sont sélectionnés ({selectedProjects.length} {selectedProjects.length > 1 ? 'projets' : 'projet'})
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedProjects.length > 0
                      ? `Exporte uniquement les ${selectedProjects.length} ${selectedProjects.length > 1 ? 'projets sélectionnés' : 'projet sélectionné'} ou pré-filtrés.`
                      : 'Aucun projet sélectionné ou pré-filtré au préalable.'}
                  </div>
                </div>
              </label>

              {/* Option 2 : Tous les projets du portefeuille */}
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="exportScope"
                  value="all"
                  checked={scope === 'all'}
                  disabled={isExporting}
                  onChange={() => setScope('all')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Tous les projets ({projects.length} {projects.length > 1 ? 'projets' : 'projet'})
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Exporte l'intégralité des projets actuellement enregistrés dans le portefeuille.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Liste récapitulative des projets ciblés */}
          {count > 0 && (
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-700">
                {count > 1 ? 'Projets qui seront exportés' : 'Projet qui sera exporté'} ({count}) :
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-slate-700 [scrollbar-width:thin]">
                {targetProjects.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 truncate">
                    <span className="font-mono font-bold text-indigo-700 shrink-0">
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
        </div>

        {/* Pied de page */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirmExport}
            disabled={count === 0 || isExporting}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-xs ${
              count === 0 || isExporting
                ? 'bg-indigo-300 cursor-not-allowed opacity-60'
                : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
            }`}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Export en cours...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Exporter au format CSV ({count})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
