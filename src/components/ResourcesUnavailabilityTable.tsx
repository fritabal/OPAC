import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Search,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Lock,
} from 'lucide-react';
import { Resource, ResourceFormData, getRolling12Months } from '../types/resource';
import { KeySkill } from '../types/skill';
import { AppUser } from '../types/user';
import { ResourceModal } from './ResourceModal';
import { Tooltip } from './Tooltip';
import {
  CREATE_ITEM_BUTTON_CLASS,
  PRIMARY_ACTION_HEADER_BUTTON_CLASS,
  MY_FILTER_BUTTON_ACTIVE_CLASS,
  MY_FILTER_BUTTON_INACTIVE_CLASS,
  TABLE_FROZEN_DIVIDER_CLASS,
} from '../constants/ui';
import {
  addResource,
  updateResource,
  updateResourceUnavailability,
  deleteResource,
} from '../services/resourceService';

interface ResourcesUnavailabilityTableProps {
  resources: Resource[];
  skills: KeySkill[];
  loading: boolean;
  activeUser: AppUser | null;
  isSuperUser: boolean;
  isAdmin: boolean;
  isResourceManager: boolean;
  effectiveRole?: string;
  allUsers: AppUser[];
}

export const ResourcesUnavailabilityTable: React.FC<ResourcesUnavailabilityTableProps> = ({
  resources,
  skills,
  loading,
  activeUser,
  isSuperUser,
  isAdmin,
  isResourceManager,
  effectiveRole,
  allUsers,
}) => {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string>('all');
  const [myResourcesOnly, setMyResourcesOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState<'name' | 'skillName' | null>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Resource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // État local réactif pour la saisie directe dans la grille
  const [localUnavailabilities, setLocalUnavailabilities] = useState<Record<string, Record<string, number | null>>>({});
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    return () => {
      Object.values(saveTimeoutRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // 12 mois glissants internationalisés (à partir et incluant le mois courant)
  const rollingMonths = useMemo(() => {
    return getRolling12Months(new Date(), i18n.language);
  }, [i18n.language]);

  // Détermination des compétences clés relevant de la responsabilité directe de l'utilisateur actif
  const myManagedSkills = useMemo(() => {
    if (!activeUser) return [];

    const currentUserId = activeUser.id;
    const currentUserEmail = (activeUser.email || '').trim().toLowerCase();

    return skills.filter((s) => {
      // 1. Correspondance directe par email (clé unique)
      const rmEmail = (s.resourceManagerId || '').trim().toLowerCase();
      if (rmEmail && rmEmail === currentUserEmail) return true;

      // 2. Correspondance par id de document (rétro-compatibilité)
      if (s.resourceManagerId && s.resourceManagerId === currentUserId) return true;

      // 3. Correspondance si resourceManagerId pointait vers un id résolvant vers cet email
      const matchThroughId = allUsers.some(
        (u) =>
          u.id === s.resourceManagerId &&
          (u.email || '').trim().toLowerCase() === currentUserEmail
      );
      if (matchThroughId) return true;

      return false;
    });
  }, [skills, activeUser, allUsers]);

  const myManagedSkillIds = useMemo(() => {
    return new Set(myManagedSkills.map((s) => s.id));
  }, [myManagedSkills]);

  // Vérifie si l'utilisateur connecté est habilité à éditer une ressource donnée (et son tableau d'indisponibilité) :
  // Les indisponibilités ne doivent être modifiables que par les Resource Managers
  // et seulement pour les lignes concernant la ou les compétences clé de l'utilisateur Resource Manager connecté.
  // (Le Super User dispose également des droits de gestion).
  const canEditResource = (resource: Resource): boolean => {
    if (isSuperUser) return true;
    if (isResourceManager) {
      return myManagedSkillIds.has(resource.skillId);
    }
    return false;
  };

  const handleSort = (col: 'name' | 'skillName') => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (col: 'name' | 'skillName') => {
    if (sortColumn !== col) {
      return (
        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
      );
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-rose-900 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-rose-900 font-bold shrink-0" />
    );
  };

  // Filtrage et tri des ressources affichées dans le tableau
  const filteredResources = useMemo(() => {
    const list = resources.filter((r) => {
      // Filtre "Mes ressources" (ressources des compétences dont l'utilisateur a la responsabilité)
      if (myResourcesOnly) {
        if (!myManagedSkillIds.has(r.skillId)) {
          return false;
        }
      }

      // Filtre par compétence clé sélectionnée dans la liste
      if (selectedSkillFilter !== 'all' && r.skillId !== selectedSkillFilter) {
        return false;
      }

      // Recherche textuelle
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = r.name.toLowerCase().includes(query);
        const matchDesc = (r.description || '').toLowerCase().includes(query);
        const matchSkill = (r.skillName || '').toLowerCase().includes(query);
        if (!matchName && !matchDesc && !matchSkill) return false;
      }
      return true;
    });

    if (sortColumn) {
      list.sort((a, b) => {
        let comparison = 0;
        if (sortColumn === 'name') {
          comparison = (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
        } else if (sortColumn === 'skillName') {
          comparison = (a.skillName || '').localeCompare(b.skillName || '', 'fr', { sensitivity: 'base' });
          if (comparison === 0) {
            comparison = (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
          }
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return list;
  }, [resources, myResourcesOnly, myManagedSkillIds, selectedSkillFilter, searchQuery, sortColumn, sortDirection]);

  // Droit global de créer une ressource : Resource Manager (qui gère au moins une compétence), Admin ou Super User
  const canCreate = isSuperUser || isAdmin || (isResourceManager && myManagedSkills.length > 0);

  // Récupération de la valeur courante d'indisponibilité pour une ressource et un mois donné
  const getCellValue = (resource: Resource, monthKey: string): string => {
    const localVal = localUnavailabilities[resource.id]?.[monthKey];
    if (localVal !== undefined) {
      return localVal === null ? '' : String(localVal);
    }
    const storedVal = resource.unavailability?.[monthKey];
    if (storedVal !== undefined && storedVal !== null) {
      return String(storedVal);
    }
    return '';
  };

  // Gestion de la saisie numérique directe dans les cellules du tableau
  const handleCellChange = (resource: Resource, monthKey: string, rawVal: string) => {
    // Vérification stricte : modification uniquement sur les lignes relevant du périmètre du RM
    if (!canEditResource(resource)) return;

    // Autoriser uniquement les chiffres positifs (avec éventuelle virgule/décimale pour demi-journées ex 0.5 ou 1)
    const normalized = rawVal.replace(',', '.');
    let numVal: number | null = null;

    if (normalized.trim() !== '') {
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed) && parsed >= 0) {
        // Plafond logique à 31 jours par mois
        numVal = Math.min(31, Math.round(parsed * 10) / 10);
      }
    }

    setLocalUnavailabilities((prev) => ({
      ...prev,
      [resource.id]: {
        ...(prev[resource.id] || {}),
        [monthKey]: numVal,
      },
    }));

    // Débouncing pour persistance Firestore (600ms)
    const timeoutKey = `${resource.id}_${monthKey}`;
    if (saveTimeoutRef.current[timeoutKey]) {
      clearTimeout(saveTimeoutRef.current[timeoutKey]);
    }

    saveTimeoutRef.current[timeoutKey] = setTimeout(async () => {
      try {
        await updateResourceUnavailability(resource.id, monthKey, numVal);
      } catch (err) {
        console.error('Erreur sauvegarde indisponibilité:', err);
      } finally {
        delete saveTimeoutRef.current[timeoutKey];
      }
    }, 600);
  };

  const handleCellBlur = async (resource: Resource, monthKey: string) => {
    if (!canEditResource(resource)) return;
    const timeoutKey = `${resource.id}_${monthKey}`;
    if (saveTimeoutRef.current[timeoutKey]) {
      clearTimeout(saveTimeoutRef.current[timeoutKey]);
      delete saveTimeoutRef.current[timeoutKey];
    }
    const val = localUnavailabilities[resource.id]?.[monthKey];
    if (val !== undefined) {
      try {
        await updateResourceUnavailability(resource.id, monthKey, val);
      } catch (err) {
        console.error('Erreur sauvegarde indisponibilité au blur:', err);
      }
    }
  };

  // Actions modales
  const handleOpenCreate = () => {
    setSelectedResource(null);
    setIsReadOnlyModal(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (r: Resource) => {
    setSelectedResource(r);
    setIsReadOnlyModal(!canEditResource(r));
    setModalOpen(true);
  };

  const handleSaveResource = async (formData: ResourceFormData) => {
    if (selectedResource) {
      await updateResource(selectedResource.id, formData);
      setActionSuccess(`Ressource « ${formData.name} » mise à jour avec succès.`);
    } else {
      await addResource(formData);
      setActionSuccess(`Ressource « ${formData.name} » créée avec succès.`);
    }
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleDeleteResource = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      await deleteResource(deleteCandidate.id);
      setActionSuccess(`Ressource « ${deleteCandidate.name} » supprimée.`);
      setDeleteCandidate(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la suppression.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Totaux statistiques
  const totalETP = useMemo(() => {
    return filteredResources.reduce((sum, r) => sum + (r.fte || 0), 0);
  }, [filteredResources]);

  return (
    <div className="space-y-4">
      {/* En-tête de section directement sur le fond de page (comme Projets) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-rose-900 flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-rose-900 shrink-0" />
            <span>{t('unavailabilities.title')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            {t('unavailabilities.subtitle')}
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className={CREATE_ITEM_BUTTON_CLASS}
          >
            <Plus className="w-4 h-4" />
            <span>{t('unavailabilities.new_resource')}</span>
          </button>
        )}
      </div>

      {/* Messages d'alerte / succès */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            {t('settings.common.cancel')}
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-700 font-bold hover:underline cursor-pointer"
          >
            {t('settings.common.cancel')}
          </button>
        </div>
      )}

      {/* Barre de filtres et recherche avec le bouton "Mes ressources" */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Recherche texte */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('unavailabilities.search_placeholder')}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-800 bg-white"
            />
          </div>

          {/* Filtre par compétence clé */}
          <div className="sm:col-span-4">
            <select
              value={selectedSkillFilter}
              onChange={(e) => setSelectedSkillFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-rose-800"
            >
              <option value="all">
                {t('unavailabilities.all_skills_filter')} ({skills.length})
              </option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bouton bascule "Mes ressources" (reprend le design du bouton Mes projets) */}
          <div className="sm:col-span-3 flex items-center">
            <button
              type="button"
              onClick={() => setMyResourcesOnly(!myResourcesOnly)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                myResourcesOnly
                  ? MY_FILTER_BUTTON_ACTIVE_CLASS
                  : MY_FILTER_BUTTON_INACTIVE_CLASS
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('unavailabilities.my_resources_only')} ({myManagedSkills.length} comp.)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grille principale des indisponibilités (12 mois glissants) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              {/* Ligne 1 d'en-tête */}
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                <th
                  scope="col"
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 font-bold sticky left-0 bg-slate-100 z-20 w-[220px] min-w-[220px] max-w-[220px] border-r border-slate-200 cursor-pointer select-none group hover:bg-slate-200/70 transition-colors"
                >
                  <Tooltip content="Cliquer pour trier par ressource" className="w-full inline-block">
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('unavailabilities.col_resource')}</span>
                      {renderSortIcon('name')}
                    </div>
                  </Tooltip>
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort('skillName')}
                  className={`px-3 py-3 font-bold sticky left-[220px] bg-slate-100 z-20 w-[160px] min-w-[160px] max-w-[160px] ${TABLE_FROZEN_DIVIDER_CLASS} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] cursor-pointer select-none group hover:bg-slate-200/70 transition-colors`}
                >
                  <Tooltip content="Cliquer pour trier par compétence clé" className="w-full inline-block">
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('unavailabilities.col_skill')}</span>
                      {renderSortIcon('skillName')}
                    </div>
                  </Tooltip>
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 font-bold text-center min-w-[65px] border-r border-slate-200"
                >
                  <Tooltip content="Équivalent Temps Plein (ETP)" className="w-full inline-block">
                    <span className="cursor-help">{t('unavailabilities.col_fte')}</span>
                  </Tooltip>
                </th>

                {/* 12 colonnes mensuelles glissantes */}
                {rollingMonths.map((m, idx) => {
                  const isCurrentMonth = idx === 0;
                  return (
                    <th
                      key={m.key}
                      scope="col"
                      className={`px-2 py-2.5 font-bold text-center min-w-[82px] border-r border-slate-200 ${
                        isCurrentMonth
                          ? 'bg-rose-50 text-rose-900 border-rose-200'
                          : 'text-slate-700'
                      }`}
                    >
                      <div className="text-[11px] font-bold leading-tight">
                        {m.label}
                      </div>
                    </th>
                  );
                })}

                <th
                  scope="col"
                  className="px-3 py-3 font-bold text-center min-w-[80px]"
                >
                  {t('unavailabilities.col_actions')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={16}
                    className="px-6 py-12 text-center text-slate-400 italic"
                  >
                    {t('settings.common.loading')}
                  </td>
                </tr>
              ) : filteredResources.length === 0 ? (
                <tr>
                  <td
                    colSpan={16}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <div className="max-w-md mx-auto space-y-2">
                      <Users className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700">
                        {t('unavailabilities.empty_title')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {myResourcesOnly
                          ? "Aucune ressource ne correspond à vos compétences clés ou au filtre actif."
                          : t('unavailabilities.empty_desc')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredResources.map((resource) => {
                  const isEditable = canEditResource(resource);

                  return (
                    <tr
                      key={resource.id}
                      className="hover:bg-slate-50/70 transition-colors group bg-white"
                    >
                      {/* Nom + description (colonne 1 figée) */}
                      <td className="px-4 py-2.5 font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50/70 z-10 w-[220px] min-w-[220px] max-w-[220px] border-r border-slate-200">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(resource)}
                            className="font-bold text-slate-900 hover:text-rose-900 text-left cursor-pointer transition-colors"
                          >
                            {resource.name}
                          </button>
                          {resource.description && (
                            <span
                              className="text-[11px] text-slate-500 line-clamp-1 mt-0.5"
                              title={resource.description}
                            >
                              {resource.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Compétence clé (colonne 2 figée avec double filet vertical) */}
                      <td className={`px-3 py-2.5 text-slate-700 sticky left-[220px] bg-white group-hover:bg-slate-50/70 z-10 w-[160px] min-w-[160px] max-w-[160px] ${TABLE_FROZEN_DIVIDER_CLASS} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]`}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <span className="truncate max-w-[130px]" title={resource.skillName}>
                            {resource.skillName || '—'}
                          </span>
                        </span>
                      </td>

                      {/* ETP */}
                      <td className="px-2 py-2.5 text-center font-bold text-slate-700 border-r border-slate-200">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-mono">
                          {Number(resource.fte || 1.0).toFixed(1)}
                        </span>
                      </td>

                      {/* 12 cellules mensuelles d'indisponibilité (en jours) */}
                      {rollingMonths.map((m, idx) => {
                        const cellVal = getCellValue(resource, m.key);
                        const numVal = cellVal !== '' ? parseFloat(cellVal) : 0;
                        const hasIndisp = numVal > 0;
                        const isCurrentMonth = idx === 0;

                        return (
                          <td
                            key={m.key}
                            className={`p-1 text-center border-r border-slate-200 transition-colors ${
                              isCurrentMonth ? 'bg-rose-50/20' : ''
                            }`}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={!isEditable}
                              value={cellVal}
                              placeholder="0"
                              onChange={(e) => handleCellChange(resource, m.key, e.target.value)}
                              onBlur={() => handleCellBlur(resource, m.key)}
                              className={`w-full text-center px-1.5 py-1 text-xs rounded transition-all ${
                                hasIndisp
                                  ? 'font-bold text-amber-900 bg-transparent'
                                  : 'text-slate-600 bg-transparent'
                              } border-transparent hover:border-slate-300 focus:border-rose-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-800 disabled:bg-transparent disabled:cursor-not-allowed`}
                              title={`${resource.name} - ${m.label} : ${cellVal || '0'} j d'indisponibilité${!isEditable ? ' (Lecture seule - Hors de votre périmètre RM)' : ''}`}
                            />
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(resource)}
                            title={isEditable ? 'Modifier les paramètres' : 'Voir les détails (Lecture seule)'}
                            className="p-1.5 text-slate-400 hover:text-rose-900 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            {isEditable ? (
                              <Pencil className="w-3.5 h-3.5" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => setDeleteCandidate(resource)}
                              title="Supprimer la ressource"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
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
      </div>

      {/* Modal Création / Modification de Ressource */}
      <ResourceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveResource}
        resourceToEdit={selectedResource}
        existingResources={resources}
        availableSkills={isResourceManager && !isSuperUser ? myManagedSkills : skills}
        defaultSkillId={selectedSkillFilter !== 'all' ? selectedSkillFilter : myManagedSkills[0]?.id || skills[0]?.id}
        isReadOnly={isReadOnlyModal}
        users={allUsers}
      />

      {/* Modal Confirmation de suppression */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('unavailabilities.delete_title')}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              {t('unavailabilities.delete_desc', { name: deleteCandidate.name })}
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
                onClick={handleDeleteResource}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
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
