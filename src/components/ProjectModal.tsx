import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Briefcase,
  AlertCircle,
  HelpCircle,
  Maximize2,
  Check,
  User,
  Shield,
  Coins,
  SlidersHorizontal,
  Info,
  Layers,
  FileText,
  FilePenLine,
  Scale,
  MoreHorizontal,
  Search,
  ChevronDown,
  Pencil,
  Eye,
} from 'lucide-react';
import { Project, ProjectFormData } from '../types/project';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { Criterion, CRITERION_POINTS } from '../types/criteria';
import { CustomProjectParam } from '../types/customParam';
import { AppUser } from '../types/user';
import { BonusConfig } from '../types/bonus';
import { createProject, updateProject } from '../services/projectService';
import { calculateProjectRoi, formatRoi } from '../utils/roiCalculator';
import { UserAutocompleteSelect } from './UserAutocompleteSelect';
import { getUserRoles } from '../utils/userUtils';

/**
 * Pictogramme volant de direction (Pilotage)
 */
const SteeringWheelIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Volant de pilotage"
  >
    {/* Anneau extérieur du volant */}
    <circle cx="12" cy="12" r="9" />
    {/* Moyeu central */}
    <circle cx="12" cy="12" r="2.5" />
    {/* Rayons du volant */}
    <line x1="12" y1="3" x2="12" y2="9.5" />
    <line x1="4.2" y1="16.5" x2="9.8" y2="13.2" />
    <line x1="19.8" y1="16.5" x2="14.2" y2="13.2" />
  </svg>
);

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
  currentUserEmail: string;
  isReadOnly?: boolean;
  projectStates: ProjectState[];
  budgetLines: BudgetLine[];
  criteria: Criterion[];
  customParams: CustomProjectParam[];
  users: AppUser[];
  bonusConfig?: BonusConfig;
  onSuccess: (savedProject?: Project) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projectToEdit,
  currentUserEmail,
  isReadOnly = false,
  projectStates,
  budgetLines,
  criteria,
  customParams,
  users,
  bonusConfig,
  onSuccess,
}) => {
  // Encart a) "Description"
  const [name, setName] = useState('');
  const [stateId, setStateId] = useState('');
  const [description, setDescription] = useState('');

  // Encart b) "Pilotage"
  const [createdByEmail, setCreatedByEmail] = useState('');
  const [projectManagerEmail, setProjectManagerEmail] = useState('');
  const [deputyEmail, setDeputyEmail] = useState('');

  // Encart c) "Priorisation"
  const [budgetLineId, setBudgetLineId] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState<number | ''>('');
  const [criteriaValues, setCriteriaValues] = useState<Record<string, number>>({});
  const [bonus, setBonus] = useState<number | ''>('');

  // Encart d) "Autres" (Paramètres personnalisés)
  const [customParamValues, setCustomParamValues] = useState<Record<string, any>>({});

  // Mini-fenêtre pour texte long
  const [longTextParamTarget, setLongTextParamTarget] = useState<CustomProjectParam | null>(null);
  const [longTextDraft, setLongTextDraft] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialisation du formulaire
  useEffect(() => {
    if (!isOpen) return;

    if (projectToEdit) {
      setName(projectToEdit.name || '');
      setStateId(projectToEdit.stateId || (projectStates[0]?.id ?? ''));
      setDescription(projectToEdit.description || '');

      setCreatedByEmail(projectToEdit.createdByEmail || '');
      setProjectManagerEmail(projectToEdit.projectManagerEmail || '');
      setDeputyEmail(projectToEdit.deputyEmail || '');

      setBudgetLineId(projectToEdit.budgetLineId || (budgetLines[0]?.id ?? ''));
      setEstimatedBudget(typeof projectToEdit.estimatedBudget === 'number' ? projectToEdit.estimatedBudget : '');
      setCriteriaValues(projectToEdit.criteriaValues || {});
      setBonus(typeof projectToEdit.bonus === 'number' ? projectToEdit.bonus : '');

      setCustomParamValues(projectToEdit.customParamValues || {});
    } else {
      // Nouveau projet
      setName('');
      setStateId(projectStates[0]?.id || '');
      setDescription('');

      setCreatedByEmail(currentUserEmail);
      // Par défaut utilisateur connecté s'il est chef de projet, sinon le premier chef de projet éligible
      const eligiblePms = users.filter((u) => getUserRoles(u).includes('chef de projet'));
      const defaultPm =
        eligiblePms.find((u) => u.email.toLowerCase() === currentUserEmail.toLowerCase())?.email ||
        eligiblePms[0]?.email ||
        currentUserEmail ||
        users[0]?.email ||
        '';
      setProjectManagerEmail(defaultPm);
      setDeputyEmail('');

      setBudgetLineId(budgetLines.find((b) => b.isActive)?.id || budgetLines[0]?.id || '');
      setEstimatedBudget('');

      // Pré-remplir les critères avec 0 pour chaque critère actif
      const initialCriteria: Record<string, number> = {};
      criteria.forEach((c) => {
        initialCriteria[c.id] = 0;
      });
      setCriteriaValues(initialCriteria);
      setBonus('');

      setCustomParamValues({});
    }
    setError(null);
  }, [isOpen, projectToEdit, currentUserEmail, projectStates, budgetLines, criteria, users]);

  // État actuellement sélectionné et vérification de l'attribut « à prioriser »
  const selectedState = useMemo(() => {
    return projectStates.find((s) => s.id === stateId);
  }, [projectStates, stateId]);

  const isStatePrioritized = Boolean(selectedState?.needsPrioritization);

  // Calcul dynamique du ROI : uniquement si l'état a « à prioriser » à VRAI
  const computedRoi = useMemo(() => {
    const parsedBonus = bonus === '' ? null : Number(bonus);
    return calculateProjectRoi(
      criteriaValues,
      criteria,
      isStatePrioritized,
      parsedBonus,
      bonusConfig?.isBonusActive ?? true
    );
  }, [criteriaValues, criteria, isStatePrioritized, bonus, bonusConfig?.isBonusActive]);

  if (!isOpen) return null;

  const handleOpenLongTextModal = (param: CustomProjectParam) => {
    setLongTextParamTarget(param);
    setLongTextDraft(String(customParamValues[param.id] ?? ''));
  };

  const handleSaveLongTextModal = () => {
    if (longTextParamTarget) {
      setCustomParamValues((prev) => ({
        ...prev,
        [longTextParamTarget.id]: longTextDraft,
      }));
    }
    setLongTextParamTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom court du projet est obligatoire.');
      return;
    }
    if (trimmedName.length > 30) {
      setError('Le nom court ne peut pas dépasser 30 caractères.');
      return;
    }

    if (!stateId) {
      setError('Veuillez sélectionner un état dans le cycle de vie.');
      return;
    }

    if (description.length > 3000) {
      setError('La description détaillée ne peut pas dépasser 3000 caractères.');
      return;
    }

    if (!projectManagerEmail) {
      setError('Le chef de projet est obligatoire.');
      return;
    }

    if (!budgetLineId) {
      setError('La ligne budgétaire est obligatoire.');
      return;
    }

    // Vérifier que tous les critères sont valorisés
    for (const crit of criteria) {
      if (criteriaValues[crit.id] === undefined) {
        setError(`Veuillez valoriser le critère « ${crit.name} ». Tous les critères sont obligatoires.`);
        return;
      }
    }

    const selectedState = projectStates.find((s) => s.id === stateId);

    setSaving(true);
    try {
      const formData: ProjectFormData = {
        name: trimmedName,
        stateId,
        stateName: selectedState?.name || '',
        description: description.trim(),
        createdByEmail: projectToEdit ? projectToEdit.createdByEmail : currentUserEmail,
        projectManagerEmail: projectManagerEmail.trim().toLowerCase(),
        deputyEmail: deputyEmail.trim() ? deputyEmail.trim().toLowerCase() : null,
        budgetLineId,
        estimatedBudget: Number(estimatedBudget) || 0,
        criteriaValues,
        bonus: bonus === '' ? null : Math.round(Number(bonus)),
        roi: computedRoi,
        customParamValues,
      };

      if (projectToEdit) {
        await updateProject(projectToEdit.id, formData);
        onSuccess({
          ...projectToEdit,
          ...formData,
        });
      } else {
        const created = await createProject(formData);
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de l’enregistrement du projet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* En-tête de la fenêtre */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl border border-blue-200">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  {isReadOnly
                    ? `Projet : ${projectToEdit?.name || ''}`
                    : projectToEdit
                    ? 'Modifier le projet : ' + projectToEdit.name
                    : 'Nouveau projet'}
                </h3>
                {isReadOnly && (
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                    Lecture seule
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {isReadOnly
                  ? 'Fiche descriptive, cotation et attributs du projet (Mode lecture seule).'
                  : projectToEdit
                  ? 'Modifiez la fiche descriptive, la ligne budgétaire et la cotation du projet.'
                  : 'Définissez les propriétés, la ligne budgétaire et la cotation initiale du projet.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilable avec les 4 encarts */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* ENCART Description */}
          {/* ======================================================== */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FilePenLine className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Description</span>
              </h4>
              <span className="text-[11px] text-slate-500">Identité &amp; cycle de vie</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Identifiant unique (non modifiable) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Identifiant
                </label>
                <div className="px-3 py-2 bg-slate-200/80 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 flex items-center justify-between select-none">
                  <span>{projectToEdit ? `#${projectToEdit.projectNumber}` : '(auto.)'}</span>
                </div>
              </div>

              {/* Nom court (max 30 car.) */}
              <div className="md:col-span-6">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Nom court du projet <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-[10px] font-mono ${name.length > 30 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                    {name.length}/30
                  </span>
                </div>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  maxLength={30}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Refonte Portail Client"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                />
              </div>

              {/* État (cycle de vie) */}
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  État<span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={isReadOnly}
                  value={stateId}
                  onChange={(e) => setStateId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                >
                  {projectStates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description détaillée sur 3000 car. max */}
              <div className="md:col-span-12">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Description détaillée du projet
                  </label>
                  <span className={`text-[10px] font-mono ${description.length > 3000 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                    {description.length}/3000 car.
                  </span>
                </div>
                <textarea
                  rows={3}
                  disabled={isReadOnly}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Objectifs stratégiques, livrables attendus, périmètre et hypothèses de réalisation..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* ENCART Pilotage */}
          {/* ======================================================== */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <SteeringWheelIcon className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Pilotage</span>
              </h4>
              <span className="text-[11px] text-slate-500">Acteurs &amp; responsabilités</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Créateur (non modifiable) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Créé par
                </label>
                <div className="px-3 py-2 bg-slate-200/80 border border-slate-300 rounded-lg text-xs font-mono text-slate-700 truncate select-none" title={createdByEmail}>
                  {createdByEmail || '(Enregistré à la validation)'}
                </div>
              </div>

              {/* Chef de projet (obligatoire, modifiable) avec recherche par séquence de lettres et pré-filtre chef de projet */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Chef de projet <span className="text-red-500">*</span>
                </label>
                <UserAutocompleteSelect
                  value={projectManagerEmail}
                  onChange={(email) => setProjectManagerEmail(email)}
                  users={users}
                  valueKey="email"
                  requiredRole="chef de projet"
                  required={true}
                  disabled={isReadOnly}
                  placeholder="Rechercher un chef de projet..."
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Seul autorisé à modifier le projet.
                </p>
              </div>

              {/* Adjoint au chef de projet (facultatif, modifiable) avec recherche par séquence de lettres et pré-filtre chef de projet */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Adjoint au chef de projet
                  </label>
                </div>
                <UserAutocompleteSelect
                  value={deputyEmail}
                  onChange={(email) => setDeputyEmail(email)}
                  users={users}
                  valueKey="email"
                  requiredRole="chef de projet"
                  required={false}
                  disabled={isReadOnly}
                  excludeValue={projectManagerEmail}
                  allowClear={true}
                  placeholder="Aucun adjoint (saisir pour chercher)..."
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Facultatif : hérite des mêmes droits que le chef de projet en son absence.
                </p>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* ENCART Priorisation */}
          {/* ======================================================== */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Priorisation</span>
              </h4>
              <span className="text-[11px] text-slate-500">Budget, critères &amp; scoring</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Ligne budgétaire */}
              <div className="md:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Ligne budgétaire associée <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={isReadOnly}
                  value={budgetLineId}
                  onChange={(e) => setBudgetLineId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 truncate"
                >
                  <option value="">Sélectionner une ligne budgétaire...</option>
                  {budgetLines.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.budgetKe} K€) {!b.isActive ? '- [Inactive]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Budget global estimatif (K€) */}
              <div className="md:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Budget global estimatif (K€)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={isReadOnly}
                    value={estimatedBudget}
                    onChange={(e) => setEstimatedBudget(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex : 120"
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">K€</span>
                </div>
              </div>

              {/* Grille valorisée de TOUS les critères de priorisation */}
              <div className="md:col-span-12 pt-2">
                <div className="mb-2">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Critères de priorisation <span className="text-red-500">*</span></span>
                    <span className="text-[11px] font-normal text-slate-500 lowercase">
                      {criteria.length} critère{criteria.length > 1 ? 's' : ''} obligatoire{criteria.length > 1 ? 's' : ''}
                    </span>
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    Sélectionnez pour chaque critère l’échelon correspondant à l’impact ou au coût du projet.
                  </p>
                </div>

                {criteria.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    Aucun critère n’a encore été défini dans l’onglet « Critères de priorisation ».
                  </div>
                ) : (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                    {criteria.map((crit) => {
                      const selectedVal = criteriaValues[crit.id] ?? 0;
                      return (
                        <div
                          key={crit.id}
                          className="p-3 rounded-lg border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                crit.type === 'VALEUR'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {crit.type}
                            </span>
                            <span className="font-bold text-xs text-slate-900">{crit.name}</span>
                          </div>

                          {/* Sélecteur des 6 échelons textuels : uniquement la valeur textuelle sans les points ni le poids */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                            {CRITERION_POINTS.map((points, idx) => {
                              const isStepSelected = selectedVal === points;
                              const label = crit.levels?.[idx] || '';
                              return (
                                <button
                                  key={points}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() =>
                                    setCriteriaValues((prev) => ({
                                      ...prev,
                                      [crit.id]: points,
                                    }))
                                  }
                                  className={`p-2.5 rounded-lg text-left text-[11px] transition-all cursor-pointer border flex items-center min-h-[52px] ${
                                    isStepSelected
                                      ? crit.type === 'VALEUR'
                                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400 text-emerald-950 font-bold shadow-2xs'
                                        : 'bg-rose-50 border-rose-500 ring-2 ring-rose-400 text-rose-950 font-bold shadow-2xs'
                                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                  } ${isReadOnly ? 'cursor-default' : ''}`}
                                >
                                  <span className="line-clamp-3 leading-snug text-[11px]">
                                    {label || <span className="italic text-slate-400">Échelon {idx + 1}</span>}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ligne sous le tableau des critères : Bonus (à gauche) et ROI calculé non modifiable (à droite) */}
              <div className="md:col-span-12 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  {/* Bonus (points entiers) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Bonus (Points)
                      </label>
                      {bonusConfig && (
                        <span className={`text-[10px] font-semibold ${bonusConfig.isBonusActive ? 'text-teal-700' : 'text-slate-400'}`}>
                          {bonusConfig.isBonusActive ? '✓ Actif dans le ROI' : '✕ Ignoré dans le ROI'}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="1"
                      disabled={isReadOnly}
                      value={bonus}
                      onChange={(e) => setBonus(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Facultatif (ex : 5)"
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 ${
                        bonusConfig?.checkQuotas &&
                        bonusConfig?.maxBonusPointsPerProject !== null &&
                        Number(bonus) > (bonusConfig.maxBonusPointsPerProject || 0)
                          ? 'border-amber-400 bg-amber-50/50'
                          : 'border-slate-300'
                      }`}
                    />
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[10px] text-slate-400">
                        {bonusConfig && !bonusConfig.isBonusActive
                          ? 'Paramètre « Bonus actifs » désactivé : ce bonus ne modifie pas le ROI.'
                          : 'Nombre entier de points de valeur additionnels.'}
                      </p>
                      {bonusConfig?.checkQuotas && bonusConfig?.maxBonusPointsPerProject !== null && (
                        <p className={`text-[10px] ${
                          Number(bonus) > bonusConfig.maxBonusPointsPerProject
                            ? 'text-amber-700 font-semibold'
                            : 'text-slate-400'
                        }`}>
                          {Number(bonus) > bonusConfig.maxBonusPointsPerProject
                            ? `⚠️ Dépassement : le quota configuré est de ${bonusConfig.maxBonusPointsPerProject} pts max par projet`
                            : `Plafond configuré : ${bonusConfig.maxBonusPointsPerProject} pts max par projet`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ROI calculé (non modifiable) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        ROI (Valeur / Coût)
                      </label>
                      <span className={`text-[10px] font-medium ${isStatePrioritized ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {isStatePrioritized ? 'Calculé automatiquement' : 'État non priorisé'}
                      </span>
                    </div>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={computedRoi !== null ? formatRoi(computedRoi) : '-'}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono font-bold cursor-not-allowed select-none ${
                        computedRoi !== null
                          ? 'border-slate-200 text-indigo-700 bg-indigo-50/70'
                          : 'border-slate-200 text-slate-400 bg-slate-100'
                      }`}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      {isStatePrioritized
                        ? 'Somme pondérée des critères de valeur / Somme pondérée des critères de coût'
                        : `Non applicable : l’état « ${selectedState?.name || 'sélectionné'} » n’a pas le statut « à prioriser »`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* ENCART Autres (Paramètres personnalisés) */}
          {/* ======================================================== */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MoreHorizontal className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Autres</span>
              </h4>
              <span className="text-[11px] text-slate-500">Paramètres personnalisés</span>
            </div>

            {customParams.length === 0 ? (
              <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                Aucun paramètre personnalisé n’a été configuré par l’administrateur pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {customParams.map((param) => {
                  const currentValue = customParamValues[param.id] ?? '';

                  return (
                    <div
                      key={param.id}
                      className={`p-3.5 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-3 ${
                        param.type === 'texte long' ? 'sm:items-start' : 'sm:items-center'
                      }`}
                    >
                      {/* Nom du paramètre avec pictogramme point d'interrogation dans un cercle */}
                      <div className={`flex items-center gap-2 sm:w-1/3 shrink-0 ${param.type === 'texte long' ? 'pt-1.5' : ''}`}>
                        <span className="text-xs font-bold text-slate-900">{param.name}</span>
                        {param.description && (
                          <div className="group relative inline-flex items-center cursor-help">
                            <HelpCircle className="w-4 h-4 text-indigo-500 hover:text-indigo-600 transition-colors" />
                            <div className="absolute left-6 -top-2 hidden group-hover:block z-50 w-64 p-2.5 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl leading-snug">
                              {param.description}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Champ de saisie adapté au type */}
                      <div className="flex-1 w-full">
                        {param.type === 'texte court' && (
                          <div className="relative">
                            <input
                              type="text"
                              maxLength={50}
                              disabled={isReadOnly}
                              value={String(currentValue)}
                              onChange={(e) =>
                                setCustomParamValues((prev) => ({
                                  ...prev,
                                  [param.id]: e.target.value,
                                }))
                              }
                              placeholder="Texte court (50 car. max)"
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                            />
                            <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-mono">
                              {String(currentValue).length}/50
                            </span>
                          </div>
                        )}

                        {param.type === 'texte long' && (
                          <div className="flex items-start gap-2">
                            <textarea
                              rows={2}
                              disabled={isReadOnly}
                              maxLength={1000}
                              value={String(currentValue)}
                              onChange={(e) =>
                                setCustomParamValues((prev) => ({
                                  ...prev,
                                  [param.id]: e.target.value,
                                }))
                              }
                              placeholder="Saisissez ici le texte détaillé (1000 car. max)..."
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 font-sans"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenLongTextModal(param)}
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors cursor-pointer shrink-0"
                              title={isReadOnly ? 'Consulter dans la mini-fenêtre' : 'Agrandir / Saisir dans la mini-fenêtre'}
                            >
                              {isReadOnly ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                            </button>
                          </div>
                        )}

                        {param.type === 'date' && (
                          <input
                            type="date"
                            disabled={isReadOnly}
                            value={String(currentValue)}
                            onChange={(e) =>
                              setCustomParamValues((prev) => ({
                                ...prev,
                                [param.id]: e.target.value,
                              }))
                            }
                            className="w-full sm:w-48 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100"
                          />
                        )}

                        {param.type === 'nombre entier' && (
                          <input
                            type="number"
                            step="1"
                            disabled={isReadOnly}
                            value={currentValue !== null && currentValue !== undefined ? String(currentValue) : ''}
                            onChange={(e) =>
                              setCustomParamValues((prev) => ({
                                ...prev,
                                [param.id]: e.target.value === '' ? null : Math.round(Number(e.target.value)),
                              }))
                            }
                            placeholder="Nombre entier (ex : 42)"
                            className="w-full sm:w-48 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                          />
                        )}

                        {param.type === 'nombre avec 2 décimales' && (
                          <input
                            type="number"
                            step="0.01"
                            disabled={isReadOnly}
                            value={currentValue !== null && currentValue !== undefined ? String(currentValue) : ''}
                            onChange={(e) =>
                              setCustomParamValues((prev) => ({
                                ...prev,
                                [param.id]: e.target.value === '' ? null : Number(parseFloat(e.target.value).toFixed(2)),
                              }))
                            }
                            placeholder="Ex : 12.50"
                            className="w-full sm:w-48 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pied de page modal */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {isReadOnly ? 'Fermer' : 'Annuler'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Enregistrement...' : projectToEdit ? 'Enregistrer les modifications' : 'Créer le projet'}</span>
              </button>
            )}
          </div>
        </form>

        {/* ======================================================== */}
        {/* MINI-FENÊTRE DE SAISIE POUR TEXTE LONG (1000 car. max) */}
        {/* ======================================================== */}
        {longTextParamTarget && (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-lg w-full p-6 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-sky-100 text-sky-500 rounded-lg border border-sky-200">
                    <SlidersHorizontal className="w-4 h-4 text-sky-500" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-900">
                      Saisie du paramètre « {longTextParamTarget.name} »
                    </h5>
                    <p className="text-[11px] text-slate-500">Texte long (1000 caractères max)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLongTextParamTarget(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {longTextParamTarget.description && (
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-indigo-900 text-xs mb-3 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{longTextParamTarget.description}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Contenu textuel détaillé :</span>
                  <span className={`font-mono ${longTextDraft.length > 1000 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                    {longTextDraft.length} / 1000 car.
                  </span>
                </div>
                <textarea
                  rows={8}
                  disabled={isReadOnly}
                  maxLength={1000}
                  value={longTextDraft}
                  onChange={(e) => setLongTextDraft(e.target.value)}
                  placeholder="Saisissez ici le texte détaillé de ce paramètre..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLongTextParamTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleSaveLongTextModal}
                    className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    Valider le texte
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
