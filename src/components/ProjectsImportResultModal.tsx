import React from 'react';
import {
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { ImportResult, downloadFile } from '../services/projectCsvService';

interface ProjectsImportResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ImportResult | null;
}

export const ProjectsImportResultModal: React.FC<ProjectsImportResultModalProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  if (!isOpen || !result) return null;

  const handleDownloadLogAgain = () => {
    const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(result.logContent, `journal_import_projets_${dateTag}.txt`, 'text/plain;charset=utf-8;');
  };

  const hasErrors = result.errorCount > 0;
  const hasWarnings = result.warningCount > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* En-tête (toujours visible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                hasErrors
                  ? 'bg-amber-50 border border-amber-200 text-amber-600'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
              }`}
            >
              {hasErrors ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Résultat de l'importation des projets
              </h3>
              <p className="text-xs text-slate-500">
                Synthèse et journal détaillé de l'opération d'import CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4 [scrollbar-width:thin]">
          {/* Synthèse visuelle */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              hasErrors
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            }`}
          >
            {hasErrors ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className="text-xs font-bold">
                Traitement terminé ({result.totalRows} ligne(s) analysée(s))
              </h4>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="font-semibold text-emerald-700">
                  ✓ {result.successCount} projet(s) importé(s) avec succès
                </span>
                {hasWarnings && (
                  <span className="font-semibold text-amber-700">
                    ⚠ {result.warningCount} avec avertissement(s)
                  </span>
                )}
                {hasErrors && (
                  <span className="font-semibold text-red-700">
                    ✕ {result.errorCount} échec(s)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Le fichier journal <code className="font-mono text-slate-700 bg-white/70 px-1 py-0.5 rounded border border-slate-200">journal_import_projets_*.txt</code> a été généré et téléchargé automatiquement sur votre poste.
              </p>
            </div>
          </div>

          {/* Aperçu du journal d'audit */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Journal d'audit détaillé</span>
              </span>
              <button
                type="button"
                onClick={handleDownloadLogAgain}
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer text-[11px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger à nouveau le journal (.txt)</span>
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text border border-slate-800 shadow-inner">
              {result.logContent}
            </div>
          </div>
        </div>

        {/* Pied de page fixe */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
