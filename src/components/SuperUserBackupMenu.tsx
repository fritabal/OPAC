import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Database,
  Trash2,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  exportAllApplicationData,
  downloadBackupFile,
  importAllApplicationData,
  eraseAllApplicationData,
  BackupData,
  ImportResult,
  EraseResult,
} from '../services/backupService';

interface SuperUserBackupMenuProps {
  isSuperUser: boolean;
  currentUserEmail: string;
}

export const SuperUserBackupMenu: React.FC<SuperUserBackupMenuProps> = ({
  isSuperUser,
  currentUserEmail,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Gestion de l'import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [clearExisting, setClearExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Gestion de l'effacement total
  const [eraseModalOpen, setEraseModalOpen] = useState(false);
  const [eraseConfirmText, setEraseConfirmText] = useState('');
  const [erasing, setErasing] = useState(false);
  const [eraseResult, setEraseResult] = useState<EraseResult | null>(null);
  const [eraseError, setEraseError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fermeture du menu déroulant lors d'un clic en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Si l'utilisateur n'est pas Super User, le composant ne s'affiche pas
  if (!isSuperUser) {
    return null;
  }

  // Déclenchement de l'export
  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      const backup = await exportAllApplicationData(currentUserEmail);
      downloadBackupFile(backup);
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        setIsOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Erreur export données:', err);
      alert("Erreur lors de l'export des données : " + (err?.message || 'Erreur inconnue'));
    } finally {
      setExporting(false);
    }
  };

  // Sélection du fichier d'import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParseError(null);
    setImportResult(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        if (!json || typeof json !== 'object') {
          throw new Error('Fichier JSON invalide.');
        }

        const dataBlock = json.data || json;
        if (!dataBlock || typeof dataBlock !== 'object') {
          throw new Error('Le fichier ne contient pas de données OPAC exploitables.');
        }

        setParsedBackup(json as BackupData);
        setImportModalOpen(true);
        setIsOpen(false);
      } catch (err: any) {
        setParseError(err?.message || 'Erreur lors de la lecture du fichier JSON.');
        setParsedBackup(null);
        setImportModalOpen(true);
      }
    };
    reader.readAsText(file);

    // Réinitialiser le champ pour permettre de re-sélectionner le même fichier si besoin
    e.target.value = '';
  };

  // Exécution de l'import
  const handleConfirmImport = async () => {
    if (!parsedBackup) return;
    setImporting(true);
    setImportError(null);

    try {
      const res = await importAllApplicationData(parsedBackup, {
        clearExisting,
        currentUserEmail,
      });
      setImportResult(res);
    } catch (err: any) {
      console.error('Erreur import données:', err);
      setImportError(err?.message || "Erreur lors de l'import des données.");
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setSelectedFile(null);
    setParsedBackup(null);
    setParseError(null);
    setImportResult(null);
    setImportError(null);
  };

  // Exécution de l'effacement total de la base
  const handleConfirmErase = async () => {
    if (eraseConfirmText.trim().toUpperCase() !== 'EFFACER') return;
    setErasing(true);
    setEraseError(null);

    try {
      const res = await eraseAllApplicationData(currentUserEmail);
      setEraseResult(res);
    } catch (err: any) {
      console.error('Erreur effacement données:', err);
      setEraseError(err?.message || "Erreur lors de l'effacement des données.");
    } finally {
      setErasing(false);
    }
  };

  const closeEraseModal = () => {
    setEraseModalOpen(false);
    setEraseConfirmText('');
    setEraseResult(null);
    setEraseError(null);
  };

  return (
    <div className="relative inline-flex items-center self-center" ref={menuRef}>
      {/* Input fichier masqué */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Pictogramme avec trois points superposés remplaçant la barre verticale */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Menu Super User (Export / Import de toutes les données)"
        aria-label="Menu Super User"
        aria-expanded={isOpen}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
          isOpen
            ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400 shadow-2xs'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-1.5 animate-in fade-in zoom-in-95">
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>Administration Super User</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Sauvegarde et réplication de l'application
            </p>
          </div>

          <div className="space-y-0.5">
            {/* Option 1 : Exporter toutes les données */}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-800 transition-colors flex items-start gap-2.5 group cursor-pointer disabled:opacity-50"
            >
              <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors shrink-0 mt-0.5">
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : exportSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {exporting
                    ? 'Export en cours...'
                    : exportSuccess
                    ? 'Téléchargement lancé !'
                    : 'Exporter toutes les données'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Génère un fichier .json de sauvegarde complet (projets, utilisateurs, paramètres)
                </div>
              </div>
            </button>

            {/* Option 2 : Importer toutes les données */}
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-800 transition-colors flex items-start gap-2.5 group cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors shrink-0 mt-0.5">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                  Importer toutes les données
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Restaure ou clone un jeu de données complet à l'identique depuis un fichier .json
                </div>
              </div>
            </button>

            {/* Option 3 : Effacer toutes les données */}
            <div className="pt-1 border-t border-slate-100 mt-1">
              <button
                type="button"
                onClick={() => {
                  setEraseConfirmText('');
                  setEraseResult(null);
                  setEraseError(null);
                  setEraseModalOpen(true);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-rose-50 text-rose-700 transition-colors flex items-start gap-2.5 group cursor-pointer"
              >
                <div className="p-1.5 rounded-md bg-rose-100 text-rose-600 group-hover:bg-rose-200 transition-colors shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-700 group-hover:text-rose-800 transition-colors">
                    Effacer toutes les données
                  </div>
                  <div className="text-[11px] text-rose-500 mt-0.5 leading-tight">
                    Supprime tous les projets, utilisateurs et paramètres, en conservant l'accès Super User
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMATION ET DE RESTAURATION DES DONNÉES                     */}
      {/* ========================================================================= */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            {/* En-tête */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Database className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Importation de données OPAC
                  </h3>
                  <p className="text-xs text-slate-500">
                    Restauration d'une sauvegarde complète
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeImportModal}
                disabled={importing}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps */}
            <div className="p-6 space-y-4">
              {parseError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-xs">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Fichier incompatible ou corrompu</strong>
                    <span>{parseError}</span>
                  </div>
                </div>
              ) : importResult ? (
                /* Succès de l'import */
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-900 text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-sm">
                        Importation réussie avec succès !
                      </strong>
                      <p className="mt-1">
                        Toutes les données ont été réinjectées dans la base Firestore. L'application est synchronisée à l'identique.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-800">Résumé des données importées :</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px]">
                      <div>📁 Projets : <strong>{importResult.counts.projects}</strong></div>
                      <div>👥 Utilisateurs : <strong>{importResult.counts.users}</strong></div>
                      <div>⚖️ Critères : <strong>{importResult.counts.criteria}</strong></div>
                      <div>💰 Lignes budgétaires : <strong>{importResult.counts.budgetLines}</strong></div>
                      <div>🎯 Compétences clés : <strong>{importResult.counts.keySkills}</strong></div>
                      <div>🔄 Cycle de vie : <strong>{importResult.counts.projectStates}</strong></div>
                      <div>⚙️ Paramètres projets : <strong>{importResult.counts.projectCustomParams}</strong></div>
                      <div>🔧 Configuration & bonus : <strong>{importResult.counts.settings}</strong></div>
                    </div>
                  </div>
                </div>
              ) : parsedBackup ? (
                /* Aperçu du fichier avant confirmation */
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-blue-900 text-xs">
                    <FileJson className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-blue-950">
                        {selectedFile?.name || 'Fichier de sauvegarde'}
                      </div>
                      <div className="text-[11px] text-blue-700 mt-0.5">
                        Exporté le : {parsedBackup.exportedAt ? new Date(parsedBackup.exportedAt).toLocaleString('fr-FR') : 'Date inconnue'}{' '}
                        {parsedBackup.exportedBy ? `par ${parsedBackup.exportedBy}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Statistiques du fichier */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-800">Contenu détecté dans l'archive :</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                      <div>📁 Projets : <strong>{(parsedBackup.data?.projects || []).length}</strong></div>
                      <div>👥 Utilisateurs : <strong>{(parsedBackup.data?.users || []).length}</strong></div>
                      <div>⚖️ Critères : <strong>{(parsedBackup.data?.criteria || []).length}</strong></div>
                      <div>💰 Lignes budgétaires : <strong>{(parsedBackup.data?.budgetLines || []).length}</strong></div>
                      <div>🎯 Compétences clés : <strong>{(parsedBackup.data?.keySkills || []).length}</strong></div>
                      <div>🔄 Cycle de vie : <strong>{(parsedBackup.data?.projectStates || []).length}</strong></div>
                      <div>⚙️ Paramètres personnalisés : <strong>{(parsedBackup.data?.projectCustomParams || []).length}</strong></div>
                      <div>🔧 Configuration : <strong>{(parsedBackup.data?.settings || []).length}</strong></div>
                    </div>
                  </div>

                  {/* Option : Nettoyage préalable */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearExisting}
                        onChange={(e) => setClearExisting(e.target.checked)}
                        disabled={importing}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">
                          Remplacement intégral à l'identique (recommandé)
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                          Supprime les données actuellement en base avant d'injecter la sauvegarde, évitant tout doublon ou orphelin.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Avertissement de sécurité */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      <strong>Attention :</strong> Cette opération va écraser les données de l'environnement actuel par celles de la sauvegarde.
                    </span>
                  </div>

                  {importError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Pied de modal */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              {importResult ? (
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Fermer
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeImportModal}
                    disabled={importing}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  {parsedBackup && !parseError && (
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={importing}
                      className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {importing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Importation en cours...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Confirmer et importer</span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMATION DE L'EFFACEMENT INTÉGRAL DE LA BASE                */}
      {/* ========================================================================= */}
      {eraseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            {/* En-tête */}
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl">
                  <Trash2 className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Effacer toutes les données
                  </h3>
                  <p className="text-xs text-rose-600 font-medium">
                    Opération irréversible de remise à zéro
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEraseModal}
                disabled={erasing}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps */}
            <div className="p-6 space-y-4">
              {eraseResult ? (
                /* Succès de l'effacement */
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-900 text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-sm">
                        Toutes les données ont été effacées avec succès !
                      </strong>
                      <p className="mt-1">
                        La base a été remise à zéro. Votre compte Super User a été préservé et vous permet de continuer à administrer l'application.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-800">Éléments supprimés :</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px]">
                      <div>📁 Projets : <strong>{eraseResult.deletedCounts.projects || 0}</strong></div>
                      <div>👥 Utilisateurs : <strong>{eraseResult.deletedCounts.users || 0}</strong></div>
                      <div>⚖️ Critères : <strong>{eraseResult.deletedCounts.criteria || 0}</strong></div>
                      <div>💰 Lignes budgétaires : <strong>{eraseResult.deletedCounts.budgetLines || 0}</strong></div>
                      <div>🎯 Compétences clés : <strong>{eraseResult.deletedCounts.keySkills || 0}</strong></div>
                      <div>🔄 Cycle de vie : <strong>{eraseResult.deletedCounts.projectStates || 0}</strong></div>
                      <div>⚙️ Paramètres projets : <strong>{eraseResult.deletedCounts.projectCustomParams || 0}</strong></div>
                      <div>🔧 Configuration : <strong>{eraseResult.deletedCounts.settings || 0}</strong></div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Avertissement et formulaire de confirmation */
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900 text-xs">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-sm text-rose-950">
                        Attention : action destructrice et définitive
                      </strong>
                      <p className="mt-1 leading-relaxed">
                        Cette opération va supprimer l'intégralité des <strong>projets</strong>, <strong>critères</strong>, <strong>lignes budgétaires</strong>, <strong>compétences</strong>, <strong>états du cycle de vie</strong>, <strong>paramètres personnalisés</strong>, ainsi que <strong>tous les autres comptes utilisateurs</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Garantie de préservation Super User */}
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-950 text-xs">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-emerald-900">
                        Préservation du compte Super User garantie
                      </strong>
                      <p className="mt-0.5 text-emerald-800 leading-relaxed text-[11px]">
                        Votre compte Super User (<strong>{currentUserEmail || 'stephane.labati@goood.com'}</strong>) ainsi que vos droits d'accès sont strictement protégés. Vous resterez connecté et pourrez continuer à utiliser l'application.
                      </p>
                    </div>
                  </div>

                  {/* Saisie de sécurité */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Pour confirmer l'effacement définitif, veuillez saisir le mot <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded border border-rose-200">EFFACER</span> ci-dessous :
                    </label>
                    <input
                      type="text"
                      value={eraseConfirmText}
                      onChange={(e) => setEraseConfirmText(e.target.value)}
                      placeholder="Tapez EFFACER"
                      disabled={erasing}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                    />
                  </div>

                  {eraseError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{eraseError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pied de modal */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              {eraseResult ? (
                <button
                  type="button"
                  onClick={closeEraseModal}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Fermer
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeEraseModal}
                    disabled={erasing}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmErase}
                    disabled={erasing || eraseConfirmText.trim().toUpperCase() !== 'EFFACER'}
                    className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    {erasing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Effacement en cours...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirmer la suppression intégrale</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
