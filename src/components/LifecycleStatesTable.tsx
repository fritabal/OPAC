import React, { useState } from 'react';
import {
  GitFork,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  UserCheck,
  SlidersHorizontal,
  Sparkles,
  AlertCircle,
  CheckCircle2,
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

  const staffingCount = states.filter((s) => s.needsStaffing).length;
  const priorizationCount = states.filter((s) => s.needsPrioritization).length;

  return (
    <div className="space-y-6">
      {/* En-tête de section avec titre, explication et boutons d'action directement sur le fond gris */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-blue-950 flex items-center gap-2.5">
            <GitFork className="w-5 h-5 text-blue-950 shrink-0" />
            <span>Cycle de vie des projets</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Définissez la séquence des états par lesquels transitent les projets. Chaque état possède un nom unique, une description facultative, et deux attributs commutables : « À prioriser » (soumis aux critères d'arbitrage) et « À staffer » (mobilisation des compétences clés).
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
              <span>{seeding ? 'Chargement...' : 'Charger cycle de vie standard (6 états)'}</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un état</span>
            </button>
          )}
        </div>
      </div>

      {/* Information de restriction de profil si non-administrateur */}
      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Mode consultation :</strong> En tant que Chef de projet ou Resource Manager, vous visualisez la liste ordonnée des états du cycle de vie et leurs règles, mais la configuration est réservée au profil Administrateur.
          </span>
        </div>
      )}

      {/* Alertes de succès / erreur */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold text-sm px-1"
          >
            ×
          </button>
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
                <th className="py-3 px-4 w-28 text-center">ORDRE</th>
                <th className="py-3 px-4 min-w-[200px]">NOM DE L'ÉTAT</th>
                <th className="py-3 px-4 min-w-[260px]">DESCRIPTION</th>
                <th className="py-3 px-4 w-36 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>À STAFFER</span>
                  </div>
                </th>
                <th className="py-3 px-4 w-36 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    <span>À PRIORISER</span>
                  </div>
                </th>
                <th className="py-3 px-4 w-28 text-right">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Chargement des états du cycle de vie...
                  </td>
                </tr>
              ) : states.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                        <GitFork className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-sm text-slate-700">Aucun état de cycle de vie défini</p>
                      <p className="text-xs text-slate-500 max-w-md">
                        Le cycle de vie permet de rythmer les étapes d’un projet (Idée, Cadrage, À staffer, En cours, Livré...).
                      </p>
                      {isAdmin && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={handleSeedDefaults}
                            disabled={seeding}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                          >
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <span>{seeding ? 'Chargement...' : 'Charger cycle de vie standard (6 états)'}</span>
                          </button>
                          <button
                            onClick={handleOpenAdd}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Créer un premier état</span>
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
                          className={`w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 ${
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
                          className={`w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 ${
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

        {/* Pied de tableau avec statistiques */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-600 text-xs flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total des états : <strong>{states.length}</strong>
            </span>
            <span className="text-emerald-700">
              États à staffer : <strong>{staffingCount}</strong>
            </span>
            <span className="text-indigo-700">
              États à prioriser : <strong>{priorizationCount}</strong>
            </span>
          </div>

          <span className="text-slate-400 text-[11px]">
            {isAdmin
              ? 'Utilisez les flèches pour modifier l’ordre séquentiel du workflow. Cochez directement les attributs dans la grille.'
              : 'Vue en lecture seule. Seul un administrateur peut modifier le cycle de vie des projets.'}
          </span>
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
                <h3 className="text-sm font-bold text-slate-900">Supprimer cet état ?</h3>
                <p className="text-xs text-slate-500">Action irréversible</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer l'état{' '}
              <strong className="text-slate-900">« {deleteCandidate.name} »</strong> du cycle de vie ?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
