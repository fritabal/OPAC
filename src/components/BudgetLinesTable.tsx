import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Coins,
  AlertCircle,
  Lock,
  CheckSquare,
  User,
  DollarSign,
  Tag,
  Palette,
  Check,
  X,
  Eye,
  Sparkles,
} from 'lucide-react';
import { BudgetLine, BudgetLineFormData } from '../types/budget';
import { BudgetLineModal } from './BudgetLineModal';
import { BUDGET_PALETTE_32 } from '../constants/colors';
import {
  addBudgetLine,
  updateBudgetLine,
  updateBudgetLineColor,
  deleteBudgetLine,
  reorderBudgetLines,
  toggleBudgetLineActive,
} from '../services/budgetService';

interface BudgetLinesTableProps {
  budgetLines: BudgetLine[];
  loading: boolean;
  isAdmin?: boolean;
  onSeedExample?: () => void;
  seeding?: boolean;
}

export const BudgetLinesTable: React.FC<BudgetLinesTableProps> = ({
  budgetLines,
  loading,
  isAdmin = true,
  onSeedExample,
  seeding = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<BudgetLine | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<BudgetLine | null>(null);
  const [activeColorPopover, setActiveColorPopover] = useState<{
    lineId: string;
    x: number;
    y: number;
    placement: 'bottom' | 'top';
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleOpenAdd = () => {
    if (!isAdmin) return;
    setSelectedLine(null);
    setIsReadOnlyModal(false);
    setModalOpen(true);
    setActionError(null);
  };

  const handleOpenEdit = (line: BudgetLine) => {
    setSelectedLine(line);
    setIsReadOnlyModal(!isAdmin);
    setModalOpen(true);
    setActionError(null);
  };

  const handleSave = async (formData: BudgetLineFormData) => {
    if (!isAdmin) {
      setActionError("Action refusée : Seul un administrateur peut gérer les lignes budgétaires.");
      return;
    }
    setActionError(null);
    if (selectedLine) {
      await updateBudgetLine(selectedLine.id, formData);
    } else {
      await addBudgetLine(formData);
    }
  };

  const handleToggleActive = async (line: BudgetLine) => {
    if (!isAdmin) return;
    setActionError(null);
    try {
      const nextState = line.isActive === false ? true : false;
      await toggleBudgetLineActive(line.id, nextState);
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors de l'activation/désactivation de la ligne budgétaire.");
    }
  };

  const handleOpenColorPopover = (e: React.MouseEvent<HTMLButtonElement>, lineId: string) => {
    if (!isAdmin) return;
    if (activeColorPopover?.lineId === lineId) {
      setActiveColorPopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 280;
    const popoverHeight = 220;

    let x = rect.left + rect.width / 2 - popoverWidth / 2;
    if (x < 16) x = 16;
    if (x + popoverWidth > window.innerWidth - 16) {
      x = window.innerWidth - popoverWidth - 16;
    }

    let y = rect.bottom + 8;
    let placement: 'bottom' | 'top' = 'bottom';
    if (rect.bottom + popoverHeight > window.innerHeight - 16) {
      y = rect.top - popoverHeight - 8;
      placement = 'top';
    }

    setActiveColorPopover({ lineId, x, y, placement });
  };

  const handleQuickColorChange = async (lineId: string, newColor: string) => {
    if (!isAdmin) return;
    setActionError(null);
    try {
      await updateBudgetLineColor(lineId, newColor);
      setActiveColorPopover(null);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors du changement de couleur.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate || !isAdmin) return;
    setProcessing(true);
    setActionError(null);
    try {
      await deleteBudgetLine(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la suppression.');
    } finally {
      setProcessing(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!isAdmin) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= budgetLines.length) return;

    setProcessing(true);
    setActionError(null);
    try {
      const reordered = [...budgetLines];
      const temp = reordered[index];
      reordered[index] = reordered[targetIndex];
      reordered[targetIndex] = temp;
      await reorderBudgetLines(reordered);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la réorganisation.');
    } finally {
      setProcessing(false);
    }
  };

  // Statistiques calculées
  const activeLines = budgetLines.filter((l) => l.isActive !== false);
  const inactiveLines = budgetLines.filter((l) => l.isActive === false);

  const totalActiveBudgetKe = activeLines.reduce((sum, l) => sum + (Number(l.budgetKe) || 0), 0);
  const totalAllBudgetKe = budgetLines.reduce((sum, l) => sum + (Number(l.budgetKe) || 0), 0);

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('fr-FR').format(val);
  };

  // Ligne active ciblée par le popover
  const activeLineForPopover = activeColorPopover
    ? budgetLines.find((l) => l.id === activeColorPopover.lineId)
    : null;

  const otherUsedColorsForPopover = activeLineForPopover
    ? budgetLines
        .filter((l) => l.id !== activeLineForPopover.id)
        .map((l) => (l.color || '').toLowerCase())
    : [];

  return (
    <div className="space-y-6">
      {/* En-tête avec titre, sous-titre et bouton d'action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-teal-600 flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-teal-600 shrink-0" />
            <span>Lignes budgétaires</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {isAdmin
              ? 'Définissez les enveloppes budgétaires en K€, attribuez les responsables et activez ou désactivez les lignes disponibles pour les projets.'
              : "Consultez les lignes budgétaires définies par l'administrateur."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin && budgetLines.length === 0 && !loading && onSeedExample && (
            <button
              onClick={onSeedExample}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{seeding ? 'Ajout en cours...' : 'Charger l’exemple « Innovation (350 K€) »'}</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une ligne budgétaire</span>
            </button>
          )}
        </div>
      </div>

      {/* Information de restriction de profil */}
      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Mode consultation :</strong> En tant que Chef de projet ou Resource Manager, vous visualisez la liste des lignes budgétaires définies par l'administrateur, mais la gestion et la modification sont réservées au profil Administrateur.
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200 shadow-2xs">
              <tr>
                {/* Ordre */}
                {isAdmin && (
                  <th scope="col" className="py-3 px-3 w-14 text-center">
                    Ordre
                  </th>
                )}
                {/* Boîte à cocher Actif */}
                <th scope="col" className="py-3 px-3 w-16 text-center">
                  <div className="flex items-center justify-center gap-1" title="Ligne budgétaire active">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Actif</span>
                  </div>
                </th>
                {/* Couleur */}
                <th scope="col" className="py-3 px-3 w-20 text-center">
                  <div className="flex items-center justify-center gap-1" title="Couleur distinctive (palette de 32 teintes uniques)">
                    <Palette className="w-3.5 h-3.5 text-slate-500" />
                    <span>Couleur</span>
                  </div>
                </th>
                {/* Nom unique */}
                <th scope="col" className="py-3 px-4 min-w-[220px]">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    <span>Nom de la ligne budgétaire</span>
                  </div>
                </th>
                {/* Budget en K€ */}
                <th scope="col" className="py-3 px-4 w-36 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                    <span>Budget (K€)</span>
                  </div>
                </th>
                {/* Responsable */}
                <th scope="col" className="py-3 px-4 min-w-[180px]">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Responsable</span>
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
                  <td colSpan={isAdmin ? 7 : 5} className="py-12 text-center text-slate-400">
                    Chargement des lignes budgétaires...
                  </td>
                </tr>
              ) : budgetLines.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Coins className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-700">Aucune ligne budgétaire définie</p>
                      {isAdmin ? (
                        <>
                          <p className="text-xs text-slate-400 max-w-sm">
                            Cliquez sur "Ajouter une ligne budgétaire" pour créer votre première enveloppe.
                          </p>
                          <button
                            onClick={handleOpenAdd}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md font-medium text-xs transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Créer une ligne maintenant</span>
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">
                          L'administrateur n'a pas encore saisi de lignes budgétaires.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                budgetLines.map((line, index) => {
                  const isActive = line.isActive !== false;
                  const colorObj = BUDGET_PALETTE_32.find(
                    (c) => c.hex.toLowerCase() === (line.color || '').toLowerCase()
                  );
                  const colorHex = line.color || BUDGET_PALETTE_32[0].hex;

                  return (
                    <tr
                      key={line.id}
                      className={`transition-colors group ${
                        isActive
                          ? 'hover:bg-slate-50/80 bg-white'
                          : 'bg-slate-50/70 hover:bg-slate-100/60 text-slate-400 italic'
                      }`}
                    >
                      {/* Boutons de réorganisation (admin) */}
                      {isAdmin && (
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
                              disabled={index === budgetLines.length - 1 || processing}
                              onClick={() => handleMove(index, 'down')}
                              className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Descendre"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}

                      {/* Boîte à cocher Actif / Inactif */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {isAdmin ? (
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={() => handleToggleActive(line)}
                              title={
                                isActive
                                  ? 'Ligne active. Cliquez pour la désactiver.'
                                  : 'Ligne désactivée. Cliquez pour la réactiver.'
                              }
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer transition-transform hover:scale-110"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isActive}
                              disabled
                              title={isActive ? 'Ligne active' : 'Ligne désactivée'}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 opacity-60 cursor-not-allowed"
                            />
                          )}
                        </div>
                      </td>

                      {/* Couleur distinctive avec sélecteur */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={(e) => handleOpenColorPopover(e, line.id)}
                              title={`Couleur : ${colorObj?.name || colorHex}. Cliquer pour réaffecter parmi les 32 couleurs.`}
                              className="w-6 h-6 rounded-full border border-black/20 shadow-2xs hover:scale-115 transition-transform cursor-pointer flex items-center justify-center"
                              style={{ backgroundColor: colorHex }}
                            >
                              <span className="sr-only">Changer la couleur</span>
                            </button>
                          ) : (
                            <span
                              className="w-5 h-5 rounded-full border border-black/15 shadow-2xs inline-block"
                              style={{ backgroundColor: colorHex }}
                              title={`Couleur : ${colorObj?.name || colorHex}`}
                            />
                          )}
                        </div>
                      </td>

                      {/* Nom unique */}
                      <td className="py-2.5 px-4 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              isActive ? 'text-slate-900 font-semibold' : 'text-slate-400 italic'
                            }
                          >
                            {line.name}
                          </span>
                          {!isActive && (
                            <span className="text-[10px] bg-slate-200/80 text-slate-500 px-1.5 py-0.5 rounded font-normal italic">
                              Désactivée
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Budget en K€ */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-bold tabular-nums ${
                            isActive ? 'text-indigo-700 font-mono text-sm' : 'text-slate-400 italic font-mono'
                          }`}
                        >
                          {formatAmount(line.budgetKe)} K€
                        </span>
                      </td>

                      {/* Responsable */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={isActive ? 'text-slate-700' : 'text-slate-400 italic'}>
                          {line.manager}
                        </span>
                      </td>

                      {/* Actions : Modifier / Supprimer (admin) ou Consulter (non-admin) */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50/80">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(line)}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              isAdmin
                                ? 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                            }`}
                            title={isAdmin ? 'Modifier cette ligne budgétaire' : 'Consulter cette ligne (Lecture seule)'}
                          >
                            {isAdmin ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteCandidate(line)}
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

        {/* Pied de tableau informatif avec total et budget cumulé */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-600 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total lignes : <strong>{budgetLines.length}</strong> (
              <strong className="text-emerald-700">{activeLines.length} active{activeLines.length > 1 ? 's' : ''}</strong>
              {inactiveLines.length > 0 && (
                <span className="text-slate-400">, {inactiveLines.length} désactivée{inactiveLines.length > 1 ? 's' : ''}</span>
              )}
              )
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 text-indigo-800 rounded border border-indigo-200 font-medium">
              Budget actif cumulé : <strong>{formatAmount(totalActiveBudgetKe)} K€</strong>
            </span>
            {inactiveLines.length > 0 && (
              <span className="text-slate-400">
                Budget total (y compris désactivé) : {formatAmount(totalAllBudgetKe)} K€
              </span>
            )}
          </div>
          <span className="text-slate-400">
            Cliquez sur la pastille couleur pour réaffecter rapidement une couleur parmi la palette des 32 teintes uniques
          </span>
        </div>
      </div>

      {/* Popover flottant de sélection des couleurs (affiché au-dessus de tout le tableau sans clipping) */}
      {isAdmin && activeColorPopover && activeLineForPopover && (
        <>
          {/* Overlay transparent pour fermer au clic à l'extérieur */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setActiveColorPopover(null)}
          />

          <div
            style={{
              position: 'fixed',
              left: `${activeColorPopover.x}px`,
              top: `${activeColorPopover.y}px`,
              width: '280px',
            }}
            className="z-50 bg-white border border-slate-300 rounded-xl shadow-2xl p-3.5 text-left animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/10"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <Palette className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span
                  className="text-xs font-bold text-slate-800 truncate"
                  title={activeLineForPopover.name}
                >
                  {activeLineForPopover.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveColorPopover(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-2.5 leading-tight">
              Sélectionnez une nouvelle couleur. Les couleurs déjà occupées par d'autres lignes sont barrées.
            </p>

            {/* Grille des 32 teintes uniques */}
            <div className="grid grid-cols-8 gap-1.5">
              {BUDGET_PALETTE_32.map((pColor) => {
                const isCurrent =
                  pColor.hex.toLowerCase() ===
                  (activeLineForPopover.color || BUDGET_PALETTE_32[0].hex).toLowerCase();
                const isTaken = otherUsedColorsForPopover.includes(
                  pColor.hex.toLowerCase()
                );

                if (isTaken) {
                  return (
                    <div
                      key={pColor.hex}
                      className="relative w-6 h-6 rounded-md overflow-hidden border border-slate-300 opacity-25 cursor-not-allowed select-none"
                      style={{ backgroundColor: pColor.hex }}
                      title={`${pColor.name} (Couleur déjà prise)`}
                    >
                      <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox="0 0 24 24"
                      >
                        <line
                          x1="0"
                          y1="0"
                          x2="24"
                          y2="24"
                          stroke="#ef4444"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        <line
                          x1="24"
                          y1="0"
                          x2="0"
                          y2="24"
                          stroke="#ef4444"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  );
                }

                return (
                  <button
                    key={pColor.hex}
                    type="button"
                    onClick={() =>
                      handleQuickColorChange(activeLineForPopover.id, pColor.hex)
                    }
                    style={{ backgroundColor: pColor.hex }}
                    title={`${pColor.name} (Cliquer pour assigner)`}
                    className={`relative w-6 h-6 rounded-md transition-transform cursor-pointer hover:scale-120 flex items-center justify-center ${
                      isCurrent
                        ? 'ring-2 ring-offset-1 ring-indigo-600 scale-110'
                        : 'border border-black/15'
                    }`}
                  >
                    {isCurrent && (
                      <Check className="w-3 h-3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal d'ajout / modification (admin) ou consultation (non-admin) */}
      <BudgetLineModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        lineToEdit={selectedLine}
        existingLines={budgetLines}
        isReadOnly={isReadOnlyModal}
      />

      {/* Confirmation de suppression (admin) */}
      {isAdmin && deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Confirmer la suppression
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Êtes-vous sûr de vouloir supprimer la ligne budgétaire{' '}
              <strong className="text-slate-900 font-semibold">« {deleteCandidate.name} »</strong> ({deleteCandidate.budgetKe} K€) ?
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
