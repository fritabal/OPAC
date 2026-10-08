import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertCircle,
  Brain,
  User,
  FileText,
  BarChart3,
  Layers,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { KeySkill, KeySkillFormData, SkillBudgetAllocation } from '../types/skill';
import { BudgetLine } from '../types/budget';
import { AppUser } from '../types/user';
import { BUDGET_PALETTE_32 } from '../constants/colors';
import { UserAutocompleteSelect } from './UserAutocompleteSelect';
import { getUserRoles } from '../utils/userUtils';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: KeySkillFormData) => Promise<void>;
  skillToEdit?: KeySkill | null;
  existingSkills: KeySkill[];
  budgetLines: BudgetLine[];
  users: AppUser[];
  currentUserId?: string;
  isReadOnly?: boolean;
}

export const SkillModal: React.FC<SkillModalProps> = ({
  isOpen,
  onClose,
  onSave,
  skillToEdit,
  existingSkills,
  budgetLines,
  users,
  currentUserId,
  isReadOnly = false,
}) => {
  const [name, setName] = useState('');
  const [resourceManagerId, setResourceManagerId] = useState('');
  const [description, setDescription] = useState('');
  const [isCapped, setIsCapped] = useState<boolean>(false);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filtrer les utilisateurs pré-filtrés avec seulement le profil de Resource Manager
  const resourceManagers = useMemo(() => {
    return users.filter((u) => {
      const userRoles = getUserRoles(u);
      return userRoles.includes('resource manager');
    });
  }, [users]);

  // Données de répartition pour le bargraph horizontal (calculé au top-level pour respecter les règles de Hooks)
  const barSlices = useMemo(() => {
    const validLines = budgetLines.filter((bl) => (allocations[bl.id] || 0) > 0);
    return validLines.map((bl, idx) => ({
      id: bl.id,
      label: bl.name,
      value: allocations[bl.id] || 0,
      color: bl.color || BUDGET_PALETTE_32[idx % BUDGET_PALETTE_32.length].hex,
    }));
  }, [budgetLines, allocations]);

  const totalPercentage = useMemo(() => {
    return Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [allocations]);

  useEffect(() => {
    if (skillToEdit) {
      setName(skillToEdit.name);
      setResourceManagerId(skillToEdit.resourceManagerId);
      setDescription(skillToEdit.description || '');
      setIsCapped(Boolean(skillToEdit.isCapped));

      // Reconstruire les allocations
      const allocMap: Record<string, number> = {};
      budgetLines.forEach((bl) => {
        allocMap[bl.id] = 0;
      });
      (skillToEdit.budgetAllocations || []).forEach((a) => {
        allocMap[a.budgetLineId] = a.percentage || 0;
      });
      setAllocations(allocMap);
    } else {
      setName('');
      // Sélectionner par défaut l'utilisateur actuel s'il est RM, sinon le 1er RM disponible
      const defaultRm =
        resourceManagers.find((u) => u.id === currentUserId) ||
        resourceManagers[0] ||
        users[0];
      setResourceManagerId(defaultRm ? defaultRm.id : '');
      setDescription('');
      setIsCapped(false);

      // Allocations par défaut (0%)
      const allocMap: Record<string, number> = {};
      budgetLines.forEach((bl) => {
        allocMap[bl.id] = 0;
      });
      setAllocations(allocMap);
    }
    setError(null);
  }, [skillToEdit, isOpen, budgetLines, users, currentUserId, resourceManagers]);

  const handleAllocationChange = (lineId: string, valStr: string) => {
    let num = Number(valStr);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;

    setAllocations((prev) => ({
      ...prev,
      [lineId]: num,
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Le nom de la compétence clé est obligatoire.');
      return;
    }

    if (!resourceManagerId) {
      setError('Veuillez sélectionner un Resource Manager responsable.');
      return;
    }

    // Vérification du nom unique (insensible à la casse)
    const isDuplicate = existingSkills.some(
      (s) =>
        s.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        s.id !== skillToEdit?.id
    );

    if (isDuplicate) {
      setError(`Une compétence clé nommée « ${trimmedName} » existe déjà. Le nom doit être unique.`);
      return;
    }

    const rmUser = users.find((u) => u.id === resourceManagerId);
    const rmName = rmUser ? rmUser.displayName : 'Inconnu';

    // Construire la liste des allocations
    // Même si isCapped est false, on conserve les allocations pour pouvoir les restaurer !
    const budgetAllocations: SkillBudgetAllocation[] = budgetLines.map((bl) => ({
      budgetLineId: bl.id,
      budgetLineName: bl.name,
      percentage: Number(allocations[bl.id]) || 0,
    }));

    setSaving(true);
    setError(null);

    try {
      const order = skillToEdit
        ? skillToEdit.order
        : existingSkills.length > 0
        ? Math.max(...existingSkills.map((s) => s.order)) + 1
        : 0;

      await onSave({
        name: trimmedName,
        resourceManagerId,
        resourceManagerName: rmName,
        description: description.trim(),
        isCapped,
        budgetAllocations,
        order,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'enregistrement de la compétence clé.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* En-tête modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl border border-rose-200 shrink-0">
              <Brain className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                {isReadOnly
                  ? `Compétence clé : ${skillToEdit?.name || ''}`
                  : skillToEdit
                  ? 'Modifier la compétence clé : ' + skillToEdit.name
                  : 'Nouvelle compétence clé'}
              </h3>
              <p className="text-xs text-slate-500">
                {isReadOnly
                  ? 'Propriétés, Resource Manager et règles de plafonnement (Mode lecture seule).'
                  : 'Définissez la compétence, son Resource Manager et sa règle de plafonnement par ligne budgétaire.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Ligne 1 : Nom et Resource Manager réduits côte-à-côte */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Nom unique */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nom de la compétence clé {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={!isReadOnly}
                disabled={isReadOnly}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Architecture Cloud & DevOps..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700 min-h-[34px]"
              />
            </div>

            {/* Resource Manager avec recherche par séquence de lettres et pré-filtré sur le profil resource manager */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Resource Manager {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <UserAutocompleteSelect
                value={resourceManagerId}
                onChange={(val) => setResourceManagerId(val)}
                users={users}
                valueKey="id"
                requiredRole="resource manager"
                placeholder="Chercher un Resource Manager..."
                required={!isReadOnly}
                disabled={isReadOnly}
                size="sm"
              />
            </div>
          </div>

          {/* Description facultative */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Description </span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <textarea
                rows={2}
                disabled={isReadOnly}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Précisez la nature de la ressource clé, sa séniorité ou les compétences techniques associées..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
              />
            </div>
          </div>

          {/* Section Répartition par ligne budgétaire */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Répartition de la capacité entre lignes budgétaires
                </h4>
              </div>

              {/* Boîte à cocher : Mode de plafonnement */}
              <label
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all select-none ${
                  isReadOnly ? 'cursor-default pointer-events-none' : 'cursor-pointer'
                } ${
                  isCapped
                    ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                    : 'bg-slate-100 border-slate-300 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={isCapped}
                  onChange={(e) => setIsCapped(e.target.checked)}
                  className={`w-4 h-4 rounded cursor-pointer transition-colors ${
                    isCapped
                      ? 'text-blue-600 border-blue-400 focus:ring-blue-500'
                      : 'text-slate-400 border-slate-300 focus:ring-slate-400'
                  }`}
                />
                <span>{isCapped ? 'Capée par ligne' : 'Non capée par ligne'}</span>
              </label>
            </div>

            {/* Avertissement / Info en mode non capé */}
            {!isCapped && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <strong>Mode non capé par ligne :</strong> Toute la capacité de cette compétence pourra être allouée sans restriction à une ou plusieurs lignes budgétaires.
                  <p className="mt-0.5 text-amber-700">
                    La répartition ci-dessous est <strong>conservée en mémoire</strong> mais grisée. Si vous réactivez « Capée par ligne budgétaire », elle sera immédiatement rétablie.
                  </p>
                </div>
              </div>
            )}

            {/* Conteneur avec état grisé si non capé */}
            <div
              className={`space-y-4 transition-all duration-200 ${
                !isCapped ? 'opacity-40 grayscale pointer-events-none select-none' : ''
              }`}
            >
              {/* Mini-tableau des lignes budgétaires (bargraph individuel supprimé, pastille de couleur ajoutée) */}
              {budgetLines.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs text-slate-500">
                  Aucune ligne budgétaire n'est encore créée. Veuillez d'abord ajouter des lignes budgétaires dans l'onglet dédié pour définir une répartition capée.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Ligne budgétaire</th>
                        <th className="py-2.5 px-3 w-40 text-right">Quota alloué (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {budgetLines.map((bl) => {
                        const lineColor = bl.color || BUDGET_PALETTE_32[0].hex;
                        return (
                          <tr key={bl.id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2.5">
                                {/* Pastille de couleur distinctive de la ligne */}
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 shadow-2xs"
                                  style={{ backgroundColor: lineColor }}
                                  title={`Couleur : ${lineColor}`}
                                />
                                <div>
                                  <span className="font-semibold text-slate-800">{bl.name}</span>
                                  <span className="text-[11px] text-slate-400 block">
                                    Resp. : {bl.manager} ({bl.budgetKe} K€)
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  disabled={!isCapped || isReadOnly}
                                  value={allocations[bl.id] ?? 0}
                                  onChange={(e) => handleAllocationChange(bl.id, e.target.value)}
                                  className="w-20 px-2 py-1 border border-slate-300 rounded text-center text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                                />
                                <span className="font-bold text-slate-500">%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-700">
                      <tr>
                        <td className="py-2.5 px-3">Total capacité allouée</td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`font-mono text-xs font-bold ${
                              totalPercentage > 100
                                ? 'text-red-600'
                                : totalPercentage === 100
                                ? 'text-emerald-700'
                                : 'text-indigo-700'
                            }`}
                          >
                            {totalPercentage}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Unique bargraph horizontal de répartition */}
              {budgetLines.length > 0 && (
                <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Répartition globale de la capacité </span>
                    </span>
                    <div className="flex items-center gap-2">
                      {totalPercentage > 100 ? (
                        <span className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Dépassement : {totalPercentage}% (&gt; 100%)</span>
                        </span>
                      ) : totalPercentage === 100 ? (
                        <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>100% alloué</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          {totalPercentage}% alloué • <strong>{100 - totalPercentage}%</strong> disponible
                        </span>
                      )}
                    </div>
                  </div>

                  {/* La barre horizontale unique avec tronçons colorés */}
                  <div className="w-full h-8 bg-slate-200 rounded-lg overflow-hidden flex border border-slate-300/80 shadow-inner">
                    {barSlices.length === 0 ? (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-400 italic">
                        0% alloué — Saisissez des pourcentages dans le tableau
                      </div>
                    ) : (
                      <>
                        {barSlices.map((slice) => {
                          // Largeur proportionnelle
                          const base = Math.max(100, totalPercentage);
                          const widthPct = (slice.value / base) * 100;

                          return (
                            <div
                              key={slice.id}
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: slice.color,
                              }}
                              className="h-full relative group transition-all duration-300 flex items-center justify-center border-r border-white/30 last:border-r-0"
                              title={`${slice.label} : ${slice.value}%`}
                            >
                              {slice.value >= 6 && (
                                <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] truncate px-1 select-none">
                                  {slice.value}%
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* Capacité restante non allouée (< 100%) */}
                        {totalPercentage < 100 && (
                          <div
                            style={{ width: `${100 - totalPercentage}%` }}
                            className="h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-medium italic select-none"
                            title={`Capacité disponible non allouée : ${100 - totalPercentage}%`}
                          >
                            {100 - totalPercentage >= 15 && (
                              <span>Dispo. {100 - totalPercentage}%</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pied modal : Boutons d'action */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Fermer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : skillToEdit ? 'Mettre à jour' : 'Ajouter la compétence clé'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
