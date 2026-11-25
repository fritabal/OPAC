import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Menu,
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
  Sparkles,
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
import { IS_DEV_DB_ENV } from '../lib/firebase';
import {
  previewDevRupDemoSeed,
  applyDevRupDemoSeed,
  DevDemoSeedPreview,
  DevDemoSeedResult,
} from '../services/devDemoSeedService';
import {
  CHECKBOX_INPUT_CLASS,
  CHECKBOX_TITLE_CLASS,
  CHECKBOX_DESCRIPTION_CLASS,
  MODAL_CANCEL_BUTTON_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
} from '../constants/ui';

interface SuperUserBackupMenuProps {
  isSuperUser: boolean;
  currentUserEmail: string;
}

export const SuperUserBackupMenu: React.FC<SuperUserBackupMenuProps> = ({
  isSuperUser,
  currentUserEmail,
}) => {
  const { t, i18n } = useTranslation();
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

  // Gestion du générateur de données de démo RUP (strictement réservé à l'environnement DEV)
  const [rupModalOpen, setRupModalOpen] = useState(false);
  const [rupPreviewLoading, setRupPreviewLoading] = useState(false);
  const [rupPreview, setRupPreview] = useState<DevDemoSeedPreview | null>(null);
  const [rupApplying, setRupApplying] = useState(false);
  const [rupResult, setRupResult] = useState<DevDemoSeedResult | null>(null);
  const [rupError, setRupError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  const updatePosition = () => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
  };

  // Fermeture du menu déroulant lors d'un clic en dehors et repositionnement dynamique
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize, true);
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
      alert(t('superuser_backup.export.error', { error: err?.message || 'Erreur inconnue' }));
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
          throw new Error(t('superuser_backup.import.invalid_json'));
        }

        const dataBlock = json.data || json;
        if (!dataBlock || typeof dataBlock !== 'object') {
          throw new Error(t('superuser_backup.import.no_data'));
        }

        setParsedBackup(json as BackupData);
        setImportModalOpen(true);
        setIsOpen(false);
      } catch (err: any) {
        setParseError(err?.message || t('superuser_backup.import.read_error'));
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
      setImportError(err?.message || t('superuser_backup.import.error', { error: err?.message || '' }));
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

  const confirmKeyword = t('superuser_backup.erase.confirm_keyword').toUpperCase();
  const inputUpper = eraseConfirmText.trim().toUpperCase();
  const isEraseConfirmed = inputUpper === confirmKeyword || inputUpper === 'EFFACER' || inputUpper === 'DELETE' || inputUpper === 'ELIMINA';

  // Exécution de l'effacement total de la base
  const handleConfirmErase = async () => {
    if (!isEraseConfirmed) return;
    setErasing(true);
    setEraseError(null);

    try {
      const res = await eraseAllApplicationData(currentUserEmail);
      setEraseResult(res);
    } catch (err: any) {
      console.error('Erreur effacement données:', err);
      setEraseError(err?.message || t('superuser_backup.erase.error', { error: err?.message || '' }));
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

  // Ouverture et prévisualisation du générateur RUP (Dev uniquement)
  const handleOpenRupModal = async () => {
    if (!IS_DEV_DB_ENV) return;
    setIsOpen(false);
    setRupModalOpen(true);
    setRupPreview(null);
    setRupResult(null);
    setRupError(null);
    setRupPreviewLoading(true);
    try {
      const preview = await previewDevRupDemoSeed();
      setRupPreview(preview);
    } catch (err: any) {
      setRupError(err?.message || "Erreur lors de l'analyse de la base de développement.");
    } finally {
      setRupPreviewLoading(false);
    }
  };

  const handleApplyRupSeed = async () => {
    if (!IS_DEV_DB_ENV) return;
    setRupApplying(true);
    setRupError(null);
    try {
      const res = await applyDevRupDemoSeed();
      setRupResult(res);
    } catch (err: any) {
      setRupError(err?.message || 'Erreur lors du peuplement RUP des projets.');
    } finally {
      setRupApplying(false);
    }
  };

  const closeRupModal = () => {
    if (rupApplying) return;
    setRupModalOpen(false);
    setRupPreview(null);
    setRupResult(null);
    setRupError(null);
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

      {/* Pictogramme burger menu grossi de 50% */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={t('superuser_backup.menu_tooltip')}
        aria-label={t('superuser_backup.menu_label')}
        aria-expanded={isOpen}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
          isOpen
            ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400 shadow-2xs'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Menu déroulant téléporté en premier plan absolu (body portal à z-[9999]) */}
      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              right: `${coords.right}px`,
              zIndex: 9999,
            }}
            className="w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 animate-in fade-in zoom-in-95"
          >
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-600" />
                <span>{t('superuser_backup.title')}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {t('superuser_backup.subtitle')}
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
                      ? t('superuser_backup.export.in_progress')
                      : exportSuccess
                      ? t('superuser_backup.export.success')
                      : t('superuser_backup.export.button')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    {t('superuser_backup.export.desc')}
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
                    {t('superuser_backup.import.button')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    {t('superuser_backup.import.desc')}
                  </div>
                </div>
              </button>


              {/* Option DEV uniquement : Enrichissement RUP des projets existants */}
              {IS_DEV_DB_ENV && (
                <div className="pt-1 border-t border-slate-100 mt-1">
                  <button
                    type="button"
                    onClick={handleOpenRupModal}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-teal-50 text-teal-900 transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <div className="p-1.5 rounded-md bg-teal-100 text-teal-700 group-hover:bg-teal-200 transition-colors shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-teal-900 group-hover:text-teal-700 transition-colors flex items-center gap-1.5">
                        <span>Enrichir projets (Démo RUP)</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">
                          DEV
                        </span>
                      </div>
                      <div className="text-[11px] text-teal-700/80 mt-0.5 leading-tight">
                        Remplit critères, historique 12m, staffing 12m, RAT et budgets sur les projets existants
                      </div>
                    </div>
                  </button>
                </div>
              )}

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
                      {t('superuser_backup.erase.button')}
                    </div>
                    <div className="text-[11px] text-rose-500 mt-0.5 leading-tight">
                      {t('superuser_backup.erase.desc')}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>,
          document.body
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
                    {t('superuser_backup.import.modal_title')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('superuser_backup.import.modal_subtitle')}
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
                    <strong className="block font-bold">{t('superuser_backup.import.corrupted_title')}</strong>
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
                        {t('superuser_backup.import.success_title')}
                      </strong>
                      <p className="mt-1">
                        {t('superuser_backup.import.success_desc')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-800">{t('superuser_backup.import.summary_title')}</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px]">
                      <div>📁 {t('superuser_backup.entities.projects')} : <strong>{importResult.counts.projects}</strong></div>
                      <div>👥 {t('superuser_backup.entities.users')} : <strong>{importResult.counts.users}</strong></div>
                      <div>⚖️ {t('superuser_backup.entities.criteria')} : <strong>{importResult.counts.criteria}</strong></div>
                      <div>💰 {t('superuser_backup.entities.budget_lines')} : <strong>{importResult.counts.budgetLines}</strong></div>
                      <div>🎯 {t('superuser_backup.entities.key_skills')} : <strong>{importResult.counts.keySkills}</strong></div>
                      <div>📅 {t('superuser_backup.entities.resources')} : <strong>{importResult.counts.resources}</strong></div>
                      <div>🔄 {t('superuser_backup.entities.lifecycle')} : <strong>{importResult.counts.projectStates}</strong></div>
                      <div>⚙️ {t('superuser_backup.entities.custom_params')} : <strong>{importResult.counts.projectCustomParams}</strong></div>
                      <div>🔧 {t('superuser_backup.entities.settings')} : <strong>{importResult.counts.settings}</strong></div>
                      <div>🌐 {t('superuser_backup.entities.i18n')} : <strong>{(importResult.counts as any)?.i18n || 1158}</strong></div>
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
                        {selectedFile?.name || t('superuser_backup.import.fallback_filename')}
                      </div>
                      <div className="text-[11px] text-blue-700 mt-0.5">
                        {t('superuser_backup.import.exported_on', {
                          date: parsedBackup.exportedAt
                            ? new Date(parsedBackup.exportedAt).toLocaleString(
                                i18n.language === 'en' ? 'en-US' : i18n.language === 'it' ? 'it-IT' : 'fr-FR'
                              )
                            : t('superuser_backup.import.unknown_date'),
                        })}{' '}
                        {parsedBackup.exportedBy ? t('superuser_backup.import.exported_by', { by: parsedBackup.exportedBy }) : ''}
                      </div>
                    </div>
                  </div>

                  {/* Statistiques du fichier */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-800">{t('superuser_backup.import.preview_title')}</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                      <div>📁 {t('superuser_backup.entities.projects')} : <strong>{(parsedBackup.data?.projects || []).length}</strong></div>
                      <div>👥 {t('superuser_backup.entities.users')} : <strong>{(parsedBackup.data?.users || []).length}</strong></div>
                      <div>⚖️ {t('superuser_backup.entities.criteria')} : <strong>{(parsedBackup.data?.criteria || []).length}</strong></div>
                      <div>💰 {t('superuser_backup.entities.budget_lines')} : <strong>{(parsedBackup.data?.budgetLines || []).length}</strong></div>
                      <div>🎯 {t('superuser_backup.entities.key_skills')} : <strong>{(parsedBackup.data?.keySkills || []).length}</strong></div>
                      <div>📅 {t('superuser_backup.entities.resources')} : <strong>{(parsedBackup.data?.resources || []).length}</strong></div>
                      <div>🔄 {t('superuser_backup.entities.lifecycle')} : <strong>{(parsedBackup.data?.projectStates || []).length}</strong></div>
                      <div>⚙️ {t('superuser_backup.entities.custom_params')} : <strong>{(parsedBackup.data?.projectCustomParams || []).length}</strong></div>
                      <div>🔧 {t('superuser_backup.entities.settings')} : <strong>{(parsedBackup.data?.settings || []).length}</strong></div>
                      <div>🌐 {t('superuser_backup.entities.i18n')} : <strong>{parsedBackup.data?.i18n?.totalKeys || (parsedBackup.counts as any)?.i18n || 1158}</strong></div>
                    </div>
                  </div>

                  {/* Option : Nettoyage préalable */}
                  <div className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 transition-colors group">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={clearExisting}
                        onChange={(e) => setClearExisting(e.target.checked)}
                        disabled={importing}
                        className={`mt-0.5 ${CHECKBOX_INPUT_CLASS}`}
                      />
                      <div className="flex-1">
                        <span className={`block ${CHECKBOX_TITLE_CLASS}`}>
                          {t('superuser_backup.import.replace_all_label')}
                        </span>
                        <span className={`block mt-0.5 ${CHECKBOX_DESCRIPTION_CLASS}`}>
                          {t('superuser_backup.import.replace_all_desc')}
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Avertissement de sécurité */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-bold">{t('common.warning', { defaultValue: 'Attention :' })}</strong> {t('superuser_backup.import.security_warning')}
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
                  className={MODAL_CLOSE_BUTTON_CLASS}
                >
                  {t('common.close', { defaultValue: 'Fermer' })}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeImportModal}
                    disabled={importing}
                    className={MODAL_CANCEL_BUTTON_CLASS}
                  >
                    {t('common.cancel', { defaultValue: 'Annuler' })}
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
                          <span>{t('superuser_backup.import.in_progress')}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>{t('superuser_backup.import.confirm_button')}</span>
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
                    {t('superuser_backup.erase.modal_title')}
                  </h3>
                  <p className="text-xs text-rose-600 font-medium">
                    {t('superuser_backup.erase.modal_subtitle')}
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
                        {t('superuser_backup.erase.success_title')}
                      </strong>
                      <p className="mt-1">
                        {t('superuser_backup.erase.success_desc')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-800">{t('superuser_backup.erase.summary_title')}</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px]">
                      <div>📁 {t('superuser_backup.entities.projects')} : <strong>{eraseResult.deletedCounts.projects || 0}</strong></div>
                      <div>👥 {t('superuser_backup.entities.users')} : <strong>{eraseResult.deletedCounts.users || 0}</strong></div>
                      <div>⚖️ {t('superuser_backup.entities.criteria')} : <strong>{eraseResult.deletedCounts.criteria || 0}</strong></div>
                      <div>💰 {t('superuser_backup.entities.budget_lines')} : <strong>{eraseResult.deletedCounts.budgetLines || 0}</strong></div>
                      <div>🎯 {t('superuser_backup.entities.key_skills')} : <strong>{eraseResult.deletedCounts.keySkills || 0}</strong></div>
                      <div>🔄 {t('superuser_backup.entities.lifecycle')} : <strong>{eraseResult.deletedCounts.projectStates || 0}</strong></div>
                      <div>⚙️ {t('superuser_backup.entities.custom_params')} : <strong>{eraseResult.deletedCounts.projectCustomParams || 0}</strong></div>
                      <div>🔧 {t('superuser_backup.entities.settings')} : <strong>{eraseResult.deletedCounts.settings || 0}</strong></div>
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
                        {t('superuser_backup.erase.warning_title')}
                      </strong>
                      <p className="mt-1 leading-relaxed">
                        {t('superuser_backup.erase.warning_desc')}
                      </p>
                    </div>
                  </div>

                  {/* Garantie de préservation Super User */}
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-950 text-xs">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-emerald-900">
                        {t('superuser_backup.erase.superuser_preserved_title')}
                      </strong>
                      <p className="mt-0.5 text-emerald-800 leading-relaxed text-[11px]">
                        {t('superuser_backup.erase.superuser_preserved_desc', { email: currentUserEmail || 'stephane.labati@goood.com' })}
                      </p>
                    </div>
                  </div>

                  {/* Saisie de sécurité */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {t('superuser_backup.erase.confirm_prompt', { keyword: '' })}{' '}
                      <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                        {confirmKeyword}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={eraseConfirmText}
                      onChange={(e) => setEraseConfirmText(e.target.value)}
                      placeholder={t('superuser_backup.erase.placeholder')}
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
                  className={MODAL_CLOSE_BUTTON_CLASS}
                >
                  {t('common.close', { defaultValue: 'Fermer' })}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeEraseModal}
                    disabled={erasing}
                    className={MODAL_CANCEL_BUTTON_CLASS}
                  >
                    {t('common.cancel', { defaultValue: 'Annuler' })}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmErase}
                    disabled={erasing || !isEraseConfirmed}
                    className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    {erasing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('superuser_backup.erase.in_progress')}</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('superuser_backup.erase.confirm_button')}</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE GÉNÉRATION DE DONNÉES DE DÉMO RUP (ENVIRONNEMENT DEV UNIQUEMENT) */}
      {/* ========================================================================= */}
      {IS_DEV_DB_ENV && rupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* En-tête */}
            <div className="px-6 py-4 bg-teal-50/70 border-b border-teal-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
                  <Sparkles className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Enrichissement RUP des projets existants</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-300">
                      Base DEV (dev__*)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Critères aléatoires, répartition RUP 12m passés / 12m à venir, RAT et budgets marché (aucun projet créé)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRupModal}
                disabled={rupApplying}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {rupPreviewLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                  <span>Analyse des projets, critères, états et compétences dans dev__*...</span>
                </div>
              ) : rupError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Erreur</strong>
                    <span>{rupError}</span>
                  </div>
                </div>
              ) : rupResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-sm">
                        {rupResult.updatedCount} projets existants mis à jour avec succès dans la base DEV !
                      </strong>
                      <p className="mt-1 text-emerald-800">
                        Critère de charge utilisé : <strong>{rupResult.primaryCostCriterionName}</strong>.
                        {rupResult.sapProjects.length > 0 && (
                          <> Expertise SAP affectée à : <strong>{rupResult.sapProjects.join(', ')}</strong>.</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-slate-600">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Projet</th>
                            <th className="py-2 px-2 font-semibold">État</th>
                            <th className="py-2 px-2 font-semibold text-right">Charge (jh)</th>
                            <th className="py-2 px-2 font-semibold text-right">Budget (K€)</th>
                            <th className="py-2 px-2 font-semibold text-right">ROI</th>
                            <th className="py-2 px-2 font-semibold text-right">Passé 12m</th>
                            <th className="py-2 px-2 font-semibold text-right">Futur 12m</th>
                            <th className="py-2 px-3 font-semibold text-right">RAT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rupResult.projects.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/60">
                              <td className="py-1.5 px-3 font-medium text-slate-900">
                                #{p.projectNumber} {p.name}
                                {p.hasSap && (
                                  <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                    SAP
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-slate-600">
                                {p.stateName}
                                {p.completedMonthsAgo !== undefined && (
                                  <span className="ml-1 text-[10px] text-slate-400">
                                    ({p.completedMonthsAgo === 0 ? 'ce mois' : `-${p.completedMonthsAgo}m`})
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono">{p.totalWorkloadDays}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{p.estimatedBudgetKe}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{p.roi ?? '-'}</td>
                              <td className="py-1.5 px-2 text-right font-mono text-slate-600">{p.sumPast12mDays} j</td>
                              <td className="py-1.5 px-2 text-right font-mono text-indigo-700">{p.sumNext12mDays} j</td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{p.ratDays} j</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : rupPreview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <div className="font-bold text-slate-800">
                        Périmètre détecté ({rupPreview.projectCount} projets existants)
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-600">
                        {rupPreview.statesBreakdown.map((st, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span>{st.stateName}</span>
                            <span className="font-mono font-semibold text-slate-800">{st.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <div className="font-bold text-slate-800">
                        Tranches détectées — {rupPreview.primaryCostCriterionName || 'Critère coût manquant'}
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-600">
                        {rupPreview.parsedCostRanges.map((r) => (
                          <div key={r.coefficient} className="flex items-center justify-between gap-2">
                            <span className="truncate">Coeff {r.coefficient} ({r.label})</span>
                            <span className="font-mono font-semibold text-slate-800 shrink-0">
                              {r.minDays}–{r.maxDays} jh
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="font-bold text-slate-800">
                      Compétences & TJM marché appliqués ({rupPreview.skillsDetected.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rupPreview.skillsDetected.map((sk) => (
                        <span
                          key={sk.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700"
                        >
                          <span className="font-medium">{sk.name}</span>
                          <span className="font-mono text-teal-700 font-semibold">{sk.marketTjmEur} €/j</span>
                        </span>
                      ))}
                    </div>
                    {rupPreview.sapCandidateProjects.length > 0 && (
                      <p className="text-[11px] text-slate-600 pt-1">
                        Expertise SAP ciblée sur : <strong>{rupPreview.sapCandidateProjects.join(', ')}</strong> (0 sur les autres projets ; SEO & Data présents sur tous les projets).
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    Cette action écrase les valorisations de critères, budgets estimés, historiques 12 mois, plans de staffing 12 mois et RAT des <strong>{rupPreview.projectCount} projets existants</strong> de la base DEV uniquement (aucun nouveau projet ne sera créé).
                  </div>
                </div>
              ) : null}
            </div>

            {/* Pied de modal */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              {rupResult ? (
                <button
                  type="button"
                  onClick={closeRupModal}
                  className={MODAL_CLOSE_BUTTON_CLASS}
                >
                  {t('common.close', { defaultValue: 'Fermer' })}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeRupModal}
                    disabled={rupApplying}
                    className={MODAL_CANCEL_BUTTON_CLASS}
                  >
                    {t('common.cancel', { defaultValue: 'Annuler' })}
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyRupSeed}
                    disabled={rupApplying || rupPreviewLoading || !rupPreview || rupPreview.projectCount === 0}
                    className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    {rupApplying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Mise à jour en cours...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Appliquer sur la base DEV</span>
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
