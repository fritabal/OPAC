import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sliders,
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  FileText,
  Calendar,
  Hash,
  Calculator,
  AlertCircle,
  Sparkles,
  Eye,
  Lock,
  CheckSquare,
  List,
} from 'lucide-react';
import {
  CustomProjectParam,
  CustomParamType,
  CUSTOM_PARAM_TYPE_LABELS,
} from '../types/customParam';
import {
  deleteCustomParam,
  moveCustomParam,
  addCustomParam,
  toggleCustomParamRequired,
  toggleCustomParamShowInTable,
} from '../services/customParamService';
import { CustomParamModal } from './CustomParamModal';
import { Tooltip } from './Tooltip';
import { DEFAULT_CUSTOM_PARAMS_SEED } from '../constants/defaultLpmParams';

interface CustomParamsTableProps {
  params: CustomProjectParam[];
  loading: boolean;
  isAdmin: boolean;
}

export const CustomParamsTable: React.FC<CustomParamsTableProps> = ({
  params,
  loading,
  isAdmin,
}) => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [paramToEdit, setParamToEdit] = useState<CustomProjectParam | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<CustomProjectParam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleOpenAdd = () => {
    setParamToEdit(null);
    setIsReadOnlyModal(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: CustomProjectParam) => {
    setParamToEdit(p);
    setIsReadOnlyModal(!isAdmin);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      await deleteCustomParam(deleteCandidate.id);
      setActionSuccess(`Paramètre personnalisé « ${deleteCandidate.name} » supprimé.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setDeleteCandidate(null);
    } catch (err: any) {
      alert('Erreur lors de la suppression : ' + err?.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    try {
      await moveCustomParam(params, index, direction);
    } catch (err: any) {
      alert('Erreur lors du déplacement : ' + err?.message);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      for (const d of DEFAULT_CUSTOM_PARAMS_SEED) {
        await addCustomParam(d);
      }
      setActionSuccess('Paramètres personnalisés standards chargés avec succès.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert('Erreur lors de l’initialisation : ' + err?.message);
    } finally {
      setSeeding(false);
    }
  };

  const getTypeBadge = (param: CustomProjectParam) => {
    switch (param.type) {
      case 'texte court':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
            <FileText className="w-3 h-3 text-sky-600" />
            <span>{t('settings.custom_params.types.text_short')}</span>
          </span>
        );
      case 'texte long':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
            <FileText className="w-3 h-3 text-sky-600" />
            <span>{t('settings.custom_params.types.text_long')}</span>
          </span>
        );
      case 'date':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
            <Calendar className="w-3 h-3 text-sky-600" />
            <span>{t('settings.custom_params.types.date')}</span>
          </span>
        );
      case 'nombre entier':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
            <Hash className="w-3 h-3 text-sky-600" />
            <span>{t('settings.custom_params.types.integer')}</span>
          </span>
        );
      case 'nombre avec 2 décimales':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
            <Calculator className="w-3 h-3 text-sky-600" />
            <span>{t('settings.custom_params.types.decimal')}</span>
          </span>
        );
      case 'case à cocher':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
            <CheckSquare className="w-3 h-3 text-sky-600" />
            <span>{t('settings.custom_params.types.boolean')}</span>
          </span>
        );
      case 'liste de valeurs':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
            <List className="w-3 h-3 text-sky-600" />
            <span>
              {t('settings.custom_params.types.list', {
                mode: param.allowMultiple
                  ? t('settings.custom_params.types.multi_choice')
                  : t('settings.custom_params.types.single_choice'),
              })}
            </span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec bouton d'ajout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-sky-500 flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-sky-500 shrink-0" />
            <span>{t('settings.custom_params.title')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {isAdmin
              ? t('settings.custom_params.subtitle_admin')
              : t('settings.custom_params.subtitle_consult')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin && params.length === 0 && !loading && (
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{seeding ? t('settings.custom_params.loading_defaults') : t('settings.custom_params.load_defaults')}</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('settings.custom_params.add_button')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Information de restriction de profil */}
      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>{t('settings.common.consultation_mode')}</strong> {t('settings.custom_params.consult_notice')}
          </span>
        </div>
      )}

      {/* Tableau des paramètres personnalisés */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            {t('settings.common.loading')}
          </div>
        ) : params.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Sliders className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {t('settings.custom_params.empty')}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {t('settings.custom_params.empty_hint')}
            </p>
            {isAdmin && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleSeedDefaults}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{seeding ? t('settings.custom_params.loading_defaults') : t('settings.custom_params.load_defaults')}</span>
                </button>
                <button
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('settings.custom_params.add_button')}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 uppercase font-semibold tracking-wider border-b border-slate-200 select-none">
                <tr>
                  {isAdmin && <th className="py-3 px-4 w-16 text-center">{t('settings.custom_params.col_order')}</th>}
                  <th className="py-3 px-4 min-w-[200px]">{t('settings.custom_params.col_name')}</th>
                  <th className="py-3 px-4 min-w-[180px]">{t('settings.custom_params.col_type')}</th>
                  <th className="py-3 px-4 w-28 text-center">{t('settings.custom_params.col_required')}</th>
                  <th className="py-3 px-4 w-36 text-center">{t('settings.custom_params.col_show_in_table')}</th>
                  <th className="py-3 px-4 min-w-[280px]">{t('settings.custom_params.col_desc')}</th>
                  <th className="py-3 px-4 w-28 text-right">{t('settings.custom_params.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {params.map((p, index) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Colonne 1 : Ordre séquentiel et boutons fléchés */}
                    {isAdmin && (
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'up')}
                            className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Monter"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === params.length - 1}
                            onClick={() => handleMove(index, 'down')}
                            className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Descendre"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}

                    {/* Colonne 2 : Nom du paramètre */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {p.isRequired && (
                          <span className="text-red-500 font-bold text-sm leading-none" title="Paramètre obligatoire">*</span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          ({p.name.length}/30 car.)
                        </span>
                      </div>
                    </td>

                    {/* Colonne 3 : Type */}
                    <td className="py-3 px-4">
                      {getTypeBadge(p)}
                    </td>

                    {/* Colonne 4 : Obligatoire (case à cocher seule) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={Boolean(p.isRequired)}
                          disabled={!isAdmin}
                          onChange={async () => {
                            if (!isAdmin) return;
                            try {
                              await toggleCustomParamRequired(p.id, !p.isRequired);
                            } catch (err: any) {
                              alert('Erreur : ' + err?.message);
                            }
                          }}
                          className={`w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 ${
                            isAdmin ? 'cursor-pointer' : 'cursor-default disabled:opacity-80'
                          }`}
                          title={
                            isAdmin
                              ? p.isRequired
                                ? 'Paramètre obligatoire (cliquer pour rendre facultatif)'
                                : 'Paramètre facultatif (cliquer pour rendre obligatoire)'
                              : p.isRequired
                              ? 'Paramètre obligatoire'
                              : 'Paramètre facultatif'
                          }
                        />
                      </div>
                    </td>

                    {/* Colonne 5 : Affiché dans le tableau (case à cocher seule) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={Boolean(p.showInTable)}
                          disabled={!isAdmin}
                          onChange={async () => {
                            if (!isAdmin) return;
                            try {
                              await toggleCustomParamShowInTable(p.id, !p.showInTable);
                            } catch (err: any) {
                              alert('Erreur : ' + err?.message);
                            }
                          }}
                          className={`w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 ${
                            isAdmin ? 'cursor-pointer' : 'cursor-default disabled:opacity-80'
                          }`}
                          title={
                            isAdmin
                              ? p.showInTable
                                ? 'Affiché dans le tableau des projets (cliquer pour masquer)'
                                : 'Masqué dans le tableau des projets (cliquer pour afficher)'
                              : p.showInTable
                              ? 'Affiché dans le tableau des projets'
                              : 'Masqué dans le tableau des projets'
                          }
                        />
                      </div>
                    </td>

                    {/* Colonne 6 : Description */}
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                      {p.description ? (
                        <Tooltip content={p.description}>
                          <span className="truncate block cursor-help">{p.description}</span>
                        </Tooltip>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">{t('settings.skills.no_description')}</span>
                      )}
                    </td>

                    {/* Colonne 5 : Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            isAdmin
                              ? 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                              : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                          }`}
                          title={isAdmin ? t('settings.common.edit') : t('settings.common.consult')}
                        >
                          {isAdmin ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteCandidate(p)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title={t('settings.common.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ajout / Modification ou Consultation de paramètre personnalisé */}
      <CustomParamModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        paramToEdit={paramToEdit}
        isReadOnly={isReadOnlyModal}
        onSuccess={() => {
          setActionSuccess(
            paramToEdit
              ? 'Paramètre personnalisé mis à jour avec succès.'
              : 'Nouveau paramètre personnalisé créé avec succès.'
          );
          setTimeout(() => setActionSuccess(null), 4000);
        }}
      />

      {/* Confirmation de suppression */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('settings.custom_params.delete_title')}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              {t('settings.custom_params.delete_desc', { name: deleteCandidate.name })}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                {t('settings.common.cancel')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isDeleting ? t('settings.common.loading') : t('settings.common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
