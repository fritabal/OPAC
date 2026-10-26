import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Project } from '../types/project';
import {
  ReferenceData,
  ImportMode,
  ImportResult,
  importProjectsFromCsv,
  generateProjectsCsvTemplate,
  downloadFile,
} from '../services/projectCsvService';

interface ProjectsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  refs: ReferenceData;
  currentProjects: Project[];
  currentUserEmail: string;
  onSuccess: (result: ImportResult) => void;
}

export const ProjectsImportModal: React.FC<ProjectsImportModalProps> = ({
  isOpen,
  onClose,
  refs,
  currentProjects,
  currentUserEmail,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [detectedLines, setDetectedLines] = useState<number>(0);
  const [importMode, setImportMode] = useState<ImportMode>('update_or_create');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Réinitialisation automatique de l'état chaque fois que la modale s'ouvre
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setFileContent(null);
      setDetectedLines(0);
      setImportMode('update_or_create');
      setIsProcessing(false);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processSelectedFile(selected);
  };

  const processSelectedFile = (selected: File) => {
    setError(null);
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      // Estimation du nombre de lignes (hors en-tête)
      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      setDetectedLines(Math.max(0, lines.length - 1));
    };
    reader.onerror = () => {
      setError('Impossible de lire le fichier sélectionné.');
    };
    reader.readAsText(selected, 'UTF-8');
  };

  const handleDownloadTemplate = () => {
    const templateCsv = generateProjectsCsvTemplate(refs);
    downloadFile(templateCsv, 'modele_import_projets.csv');
  };

  const handleLaunchImport = async () => {
    if (!fileContent) {
      setError('Veuillez sélectionner un fichier CSV valide.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await importProjectsFromCsv(
        fileContent,
        importMode,
        refs,
        currentProjects,
        currentUserEmail
      );

      // Téléchargement automatique du fichier journal (.txt)
      const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadFile(result.logContent, `journal_import_projets_${dateTag}.txt`, 'text/plain;charset=utf-8;');

      // Fermeture de cette fenêtre de lancement et transmission du résultat pour ouverture de la fenêtre dédiée
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue lors de l\'importation.');
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileContent(null);
    setDetectedLines(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* En-tête (toujours visible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Importer des projets (CSV)
              </h3>
              <p className="text-xs text-slate-500">
                Séparateur barre verticale (<code className="font-mono font-bold text-indigo-600">|</code>) et clés visibles du référentiel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4 [scrollbar-width:thin]">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Notice explicative & téléchargement modèle */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">Format d'importation attendu</p>
              <p className="text-slate-600">
                Les colonnes utilisent les noms de vos critères, lignes budgétaires, compétences, etc.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Modèle CSV vierge</span>
            </button>
          </div>

          {/* Sélecteur de fichier */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,text/csv,text/plain"
              disabled={isProcessing}
              className="hidden"
              id="projects-csv-file-input"
            />
            {!file ? (
              <label
                htmlFor="projects-csv-file-input"
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/30 rounded-xl cursor-pointer transition-colors group ${
                  isProcessing ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <FileSpreadsheet className="w-10 h-10 text-slate-400 group-hover:text-indigo-600 mb-2 transition-colors" />
                <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
                  Cliquez pour choisir un fichier CSV (|)
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  ou glissez-déposez votre fichier ici
                </span>
              </label>
            ) : (
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-indigo-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 truncate max-w-xs">{file.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {(file.size / 1024).toFixed(1)} Ko • ~{detectedLines} {detectedLines > 1 ? 'projets détectés' : 'projet détecté'}
                    </p>
                  </div>
                </div>
                {!isProcessing && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                  >
                    Changer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mode d'importation */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
            <p className="text-xs font-bold text-slate-900">Mode de traitement :</p>
            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="update_or_create"
                  checked={importMode === 'update_or_create'}
                  onChange={() => setImportMode('update_or_create')}
                  disabled={isProcessing}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-800">
                    Mettre à jour les projets existants et créer les nouveaux
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Si le numéro de projet (colonne <code>Numéro</code>) correspond à un projet existant, il est mis à jour. Sinon, un nouveau projet est créé.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="create_all_new"
                  checked={importMode === 'create_all_new'}
                  onChange={() => setImportMode('create_all_new')}
                  disabled={isProcessing}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-800">
                    Créer systématiquement tous les projets en tant que nouveaux
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Chaque ligne donnera lieu à un nouveau projet avec un nouvel identifiant séquentiel unique.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Pied de page fixe */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleLaunchImport}
            disabled={!fileContent || isProcessing}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-xs ${
              !fileContent || isProcessing
                ? 'bg-indigo-400 cursor-not-allowed opacity-70'
                : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importation en cours...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Lancer l'importation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
