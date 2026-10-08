import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Brain,
  AlertCircle,
  Lock,
  User,
  Layers,
  FileText,
  Tag,
  PieChart,
  Eye,
  Sparkles,
} from 'lucide-react';
import { KeySkill, KeySkillFormData } from '../types/skill';
import { BudgetLine } from '../types/budget';
import { AppUser } from '../types/user';
import { SkillModal } from './SkillModal';
import {
  addKeySkill,
  updateKeySkill,
  deleteKeySkill,
  reorderKeySkills,
} from '../services/skillService';

interface SkillsTableProps {
  skills: KeySkill[];
  loading: boolean;
  budgetLines: BudgetLine[];
  users: AppUser[];
  canManage?: boolean;
  currentUserId?: string;
  onSeedExample?: () => void;
  seeding?: boolean;
}

export const SkillsTable: React.FC<SkillsTableProps> = ({
  skills,
  loading,
  budgetLines,
  users,
  canManage = true,
  currentUserId,
  onSeedExample,
  seeding = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<KeySkill | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<KeySkill | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleOpenAdd = () => {
    if (!canManage) return;
    setSelectedSkill(null);
    setIsReadOnlyModal(false);
    setModalOpen(true);
    setActionError(null);
  };

  const handleOpenEdit = (skill: KeySkill) => {
    setSelectedSkill(skill);
    setIsReadOnlyModal(!canManage);
    setModalOpen(true);
    setActionError(null);
  };

  const handleSave = async (formData: KeySkillFormData) => {
    if (!canManage) {
      setActionError("Action refusée : Seul un Resource Manager ou un Administrateur peut modifier les compétences clés.");
      return;
    }
    setActionError(null);
    if (selectedSkill) {
      await updateKeySkill(selectedSkill.id, formData);
    } else {
      await addKeySkill(formData);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate || !canManage) return;
    setProcessing(true);
    setActionError(null);
    try {
      await deleteKeySkill(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la suppression.');
    } finally {
      setProcessing(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!canManage) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= skills.length) return;

    setProcessing(true);
    setActionError(null);
    try {
      const reordered = [...skills];
      const temp = reordered[index];
      reordered[index] = reordered[targetIndex];
      reordered[targetIndex] = temp;
      await reorderKeySkills(reordered);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la réorganisation.');
    } finally {
      setProcessing(false);
    }
  };

  const cappedCount = skills.filter((s) => s.isCapped).length;
  const uncappedCount = skills.filter((s) => !s.isCapped).length;

  return (
    <div className="space-y-6">
      {/* En-tête avec titre, sous-titre et bouton d'action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-rose-600 flex items-center gap-2.5">
            <Brain className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Compétences clés</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {canManage
              ? 'Identifiez les compétences critiques susceptibles de bloquer les projets, désignez le Resource Manager et gérez le plafonnement de capacité par ligne budgétaire.'
              : 'Consultez le référentiel des compétences clés défini par l’administrateur.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManage && skills.length === 0 && !loading && onSeedExample && (
            <button
              onClick={onSeedExample}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{seeding ? 'Ajout en cours...' : 'Charger l’exemple « Architecture Cloud & DevOps »'}</span>
            </button>
          )}

          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une compétence clé</span>
            </button>
          )}
        </div>
      </div>

      {/* Information de restriction de profil */}
      {!canManage && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Mode consultation :</strong> En tant que Chef de projet ou Resource Manager, vous visualisez la liste des compétences clés, leurs Resource Managers et leur statut de plafonnement par ligne budgétaire. La gestion est réservée au profil Administrateur.
          </span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tableau tabulaire avec ascenseur horizontal et vertical */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200 shadow-2xs">
              <tr>
                {/* Ordre */}
                {canManage && (
                  <th scope="col" className="py-3 px-3 w-14 text-center">
                    Ordre
                  </th>
                )}
                {/* Nom unique */}
                <th scope="col" className="py-3 px-4 min-w-[200px]">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    <span>Compétence clé</span>
                  </div>
                </th>
                {/* Resource Manager */}
                <th scope="col" className="py-3 px-4 min-w-[180px]">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Resource Manager</span>
                  </div>
                </th>
                {/* Description */}
                <th scope="col" className="py-3 px-4 min-w-[240px]">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Description</span>
                  </div>
                </th>
                {/* Indicateur de répartition */}
                <th scope="col" className="py-3 px-4 w-44 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Répartition</span>
                  </div>
                </th>
                {/* Actions */}
                <th scope="col" className="py-3 px-4 w-24 text-right sticky right-0 bg-slate-100">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-12 text-center text-slate-400">
                    Chargement des compétences clés...
                  </td>
                </tr>
              ) : skills.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Brain className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-700">Aucune compétence clé définie</p>
                      {canManage ? (
                        <>
                          <p className="text-xs text-slate-400 max-w-sm">
                            Cliquez sur "Ajouter une compétence clé" pour déclarer les ressources critiques susceptibles de devenir des goulets d’étranglement.
                          </p>
                          <button
                            onClick={handleOpenAdd}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md font-medium text-xs transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Déclarer une compétence maintenant</span>
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Le Resource Manager n'a pas encore saisi de compétences clés.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                skills.map((skill, index) => {
                  return (
                    <tr
                      key={skill.id}
                      className="hover:bg-slate-50/80 transition-colors group bg-white"
                    >
                      {/* Boutons de réorganisation */}
                      {canManage && (
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0 || processing}
                              onClick={() => handleMove(index, 'up')}
                              className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Monter"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === skills.length - 1 || processing}
                              onClick={() => handleMove(index, 'down')}
                              className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Descendre"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}

                      {/* Nom unique */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 block">
                          {skill.name}
                        </span>
                      </td>

                      {/* Resource Manager */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="text-slate-800 font-medium truncate block max-w-[200px]">
                          {skill.resourceManagerName}
                        </span>
                      </td>

                      {/* Description facultative */}
                      <td className="py-2.5 px-4 text-slate-600 max-w-[320px] truncate">
                        {skill.description ? (
                          <span title={skill.description}>{skill.description}</span>
                        ) : (
                          <span className="text-slate-300 italic">Aucune description</span>
                        )}
                      </td>

                      {/* Indicateur de plafonnement : "capée par ligne" ou "non capée par ligne" */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        {skill.isCapped ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                            title="Capacité plafonnée par ligne budgétaire. Cliquez sur modifier pour consulter le mini-tableau et le camembert."
                          >
                            <PieChart className="w-3 h-3 text-indigo-500" />
                            <span>Capée par ligne</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                            title="Non capée par ligne budgétaire : toute la capacité peut être allouée sur une même ligne."
                          >
                            <span>Non capée par ligne</span>
                          </span>
                        )}
                      </td>

                      {/* Actions : Modifier / Consulter fiche */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50/80">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(skill)}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              canManage
                                ? 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                            }`}
                            title={canManage ? 'Modifier / Consulter la fiche' : 'Consulter la fiche (Lecture seule)'}
                          >
                            {canManage ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setDeleteCandidate(skill)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pied de tableau informatif */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-600 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total compétences clés : <strong>{skills.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded border border-indigo-200 font-medium">
              Capées par ligne : <strong>{cappedCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium">
              Non capées : <strong>{uncappedCount}</strong>
            </span>
          </div>
          <span className="text-slate-400">
            {canManage
              ? "Cliquez sur l'icône crayon pour modifier la fiche ou consulter le camembert"
              : "Cliquez sur l'icône œil pour consulter la fiche de la ressource et visualiser le camembert"}
          </span>
        </div>
      </div>

      {/* Modal d'ajout / modification ou consultation */}
      <SkillModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        skillToEdit={selectedSkill}
        existingSkills={skills}
        budgetLines={budgetLines}
        users={users}
        currentUserId={currentUserId}
        isReadOnly={isReadOnlyModal}
      />

      {/* Confirmation de suppression */}
      {canManage && deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Confirmer la suppression
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Êtes-vous sûr de vouloir supprimer la compétence clé{' '}
              <strong className="text-slate-900 font-semibold">« {deleteCandidate.name} »</strong> ?
              Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {processing ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
