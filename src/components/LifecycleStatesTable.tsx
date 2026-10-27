import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitFork,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  UserCheck,
  ListOrdered,
  SlidersHorizontal,
  Sparkles,
  AlertCircle,
  Lock,
  Layers,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { ProjectState, ProjectStateFormData } from '../types/lifecycle';
import {
  addProjectState,
  updateProjectState,
  deleteProjectState,
  reorderProjectStates,
  toggleStateStaffing,
  toggleStatePrioritization,
  seedDefaultProjectLifecycle,
} from '../services/lifecycleService';
import { LifecycleStateModal } from './LifecycleStateModal';
import { Tooltip } from './Tooltip';
import { CREATE_ITEM_BUTTON_CLASS } from '../constants/ui';

interface LifecycleStatesTableProps {
  states: ProjectState[];
  loading: boolean;
  isAdmin: boolean;
}

export const LifecycleStatesTable: React.FC<LifecycleStatesTableProps> = ({
  states,
  loading,
  isAdmin,
}) => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingState, setEditingState] = useState<ProjectState | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<ProjectState | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingState(null);
    setIsReadOnlyModal(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (state: ProjectState) => {
    setEditingState(state);
    setIsReadOnlyModal(!isAdmin);
    setModalOpen(true);
  };

  const handleSave = async (formData: ProjectStateFormData) => {
    try {
      setActionError(null);
      if (editingState) {
        await updateProjectState(editingState.id, formData);
        setActionSuccess(`L'état « ${formData.name} » a été mis à jour avec succès.`);
      } else {
        await addProjectState(formData);
        setActionSuccess(`L'état « ${formData.name} » a été ajouté au cycle de vie.`);
      }
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors de l'enregistrement de l'état.");
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      setActionError(null);
      await deleteProjectState(deleteCandidate.id);
      setActionSuccess(`L'état « ${deleteCandidate.name} » a été supprimé.`);
      setDeleteCandidate(null);
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors de la suppression de l'état.");
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!isAdmin) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= states.length) return;

    const newStates = [...states];
    const [moved] = newStates.splice(index, 1);
    newStates.splice(targetIndex, 0, moved);

    try {
      await reorderProjectStates(newStates);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors du réordonnancement des états.');
    }
  };

  const handleToggleStaffing = async (st: ProjectState) => {
    if (!isAdmin) return;
    try {
      await toggleStateStaffing(st.id, !st.needsStaffing);
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors de la mise à jour de l'attribut à staffer.");
    }
  };

  const handleTogglePrioritization = async (st: ProjectState) => {
    if (!isAdmin) return;
    try {
      await toggleStatePrioritization(st.id, !st.needsPrioritization);
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors de la mise à jour de l'attribut à prioriser.");
    }
  };

  const handleSeedDefaults = async () => {
    if (!isAdmin) return;
    setSeeding(true);
    setActionError(null);
    try {
      await seedDefaultProjectLifecycle();
      setActionSuccess('Le cycle de vie standard (6 états) a été chargé avec succès.');
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de l’initialisation du cycle de vie.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête de section avec titre, explication et boutons d'action directement sur le fond gris */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-blue-950 flex items-center gap-2.5">
            <GitFork className="w-5 h-5 text-blue-950 shrink-0" />
            <span>{t('settings.lifecycle.title')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {t('settings.lifecycle.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isAdmin && states.length === 0 && !loading && (
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{seeding ? t('settings.lifecycle.loading_defaults') : t('settings.lifecycle.load_defaults')}</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className={CREATE_ITEM_BUTTON_CLASS}
            >
              <Plus className="w-4 h-4" />
              <span>{t('settings.lifecycle.add_button')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Information de restriction de profil si non-administrateur */}
      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>{t('settings.common.consultation_mode')}</strong> {t('settings.lifecycle.consult_notice')}
          </span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-700 hover:text-red-900 cursor-pointer font-bold text-sm px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Tableau tabulaire des états */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 uppercase font-semibold tracking-wider border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-4 w-28 text-center">{t('settings.lifecycle.col_order')}</th>
                <th className="py-3 px-4 min-w-[200px]">{t('settings.lifecycle.col_name')}</th>
                <th className="py-3 px-4 min-w-[260px]">{t('settings.lifecycle.col_desc')}</th>
                <th className="py-3 px-4 w-36 text-center">
                  <Tooltip
                    content={t('settings.lifecycle.staffed_tooltip')}
                    className="w-full inline-block"
                  >
                    <div className="flex items-center justify-center gap-1 cursor-help">
                      <UserCheck className="w-3.5 h-3.5 text-rose-900" />
                      <span>{t('settings.lifecycle.staffed_header')}</span>
                    </div>
                  </Tooltip>
                </th>
                <th className="py-3 px-4 w-36 text-center">
                  <Tooltip
                    content={t('settings.lifecycle.prioritized_tooltip')}
                    className="w-full inline-block"
                  >
                    <div className="flex items-center justify-center gap-1 cursor-help">
                      <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('settings.lifecycle.prioritized_header')}</span>
                    </div>
                  </Tooltip>
                </th>
                <th className="py-3 px-4 w-28 text-right">{t('settings.lifecycle.col_actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {t('settings.common.loading')}
                  </td>
                </tr>
              ) : states.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                        <GitFork className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-sm text-slate-700">{t('settings.lifecycle.empty')}</p>
                      <p className="text-xs text-slate-500 max-w-md">
                        {t('settings.lifecycle.empty_hint')}
                      </p>
                      {isAdmin && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={handleSeedDefaults}
                            disabled={seeding}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                          >
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <span>{seeding ? t('settings.lifecycle.loading_defaults') : t('settings.lifecycle.load_defaults')}</span>
                          </button>
                          <button
                            onClick={handleOpenAdd}
                            className={CREATE_ITEM_BUTTON_CLASS}
                          >
                            <Plus className="w-4 h-4" />
                            <span>{t('settings.lifecycle.add_button')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                states.map((st, idx) => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Colonne 1 : Ordre séquentiel et boutons monter / descendre */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <span className="font-mono text-xs font-bold text-slate-500 w-6 text-center">
                          #{idx + 1}
                        </span>
                        {isAdmin && (
                          <div className="inline-flex items-center gap-0.5 ml-1">
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 rounded hover:bg-slate-100 transition-colors cursor-pointer disabled:cursor-not-allowed"
                              title="Déplacer vers le haut"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'down')}
                              disabled={idx === states.length - 1}
                              className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 rounded hover:bg-slate-100 transition-colors cursor-pointer disabled:cursor-not-allowed"
                              title="Déplacer vers le bas"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Colonne 2 : Nom de l'état */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 text-xs tracking-tight">
                        {st.name}
                      </span>
                    </td>

                    {/* Colonne 3 : Description */}
                    <td className="py-3 px-4">
                      {st.description ? (
                        <p className="text-xs text-slate-600 leading-relaxed max-w-md">
                          {st.description}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Aucune description</span>
                      )}
                    </td>

                    {/* Colonne 4 : Attribut "À staffer" */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={st.needsStaffing}
                          onChange={() => handleToggleStaffing(st)}
                          disabled={!isAdmin}
                          className={`w-4 h-4 text-rose-900 rounded border-slate-300 focus:ring-rose-800 ${
                            isAdmin ? 'cursor-pointer' : 'cursor-default opacity-80'
                          }`}
                          title={
                            isAdmin
                              ? "Cliquer pour activer / désactiver l'attribut À staffer"
                              : st.needsStaffing
                              ? 'À staffer : Oui'
                              : 'À staffer : Non'
                          }
                        />
                      </div>
                    </td>

                    {/* Colonne 5 : Attribut "À prioriser" */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={st.needsPrioritization}
                          onChange={() => handleTogglePrioritization(st)}
                          disabled={!isAdmin}
                          className={`w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 ${
                            isAdmin ? 'cursor-pointer' : 'cursor-default opacity-80'
                          }`}
                          title={
                            isAdmin
                              ? "Cliquer pour activer / désactiver l'attribut À prioriser"
                              : st.needsPrioritization
                              ? 'À prioriser : Oui'
                              : 'À prioriser : Non'
                          }
                        />
                      </div>
                    </td>

                    {/* Colonne 6 : Actions (Modifier, Supprimer pour admin ou Visualiser pour non-admin) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(st)}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            isAdmin
                              ? 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                              : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                          }`}
                          title={isAdmin ? "Modifier l'état" : "Consulter l'état (Lecture seule)"}
                        >
                          {isAdmin ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteCandidate(st)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="Supprimer l'état"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modal d'ajout / modification ou consultation */}
      <LifecycleStateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        editingState={editingState}
        existingStates={states}
        isReadOnly={isReadOnlyModal}
      />

      {/* Modal de confirmation de suppression */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t('settings.lifecycle.delete_title')}</h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              {t('settings.lifecycle.delete_desc', { name: deleteCandidate.name })}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                {t('settings.common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {t('settings.common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
