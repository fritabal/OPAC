import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  LogIn,
  LogOut,
  Sliders,
  Users,
  Shield,
  Briefcase,
  UserCog,
  Crown,
  Lock,
  Layers,
  Sparkles,
  ArrowRightLeft,
  RotateCcw,
  Coins,
  Brain,
  GitFork,
  Euro,
  SlidersHorizontal,
  Camera,
  Upload,
} from 'lucide-react';
import { Criterion } from './types/criteria';
import { BudgetLine } from './types/budget';
import { KeySkill } from './types/skill';
import { ProjectState } from './types/lifecycle';
import { CustomProjectParam } from './types/customParam';
import { Project } from './types/project';
import { UserRole, ROLE_LABELS } from './types/user';
import { BonusConfig } from './types/bonus';
import { subscribeToCriteria, addCriterion } from './services/criteriaService';
import { subscribeToBudgetLines, addBudgetLine } from './services/budgetService';
import { subscribeToKeySkills, addKeySkill } from './services/skillService';
import { subscribeToProjectStates } from './services/lifecycleService';
import { subscribeToCustomParams } from './services/customParamService';
import { subscribeToProjects } from './services/projectService';
import { subscribeToBonusConfig, getCachedBonusConfig } from './services/bonusService';
import {
  subscribeToBranding,
  updateAppLogo,
  resetAppLogo,
  resizeImageToDataUrl,
  getCachedAppLogo,
} from './services/brandingService';
import { CriteriaTable } from './components/CriteriaTable';
import { BudgetLinesTable } from './components/BudgetLinesTable';
import { SkillsTable } from './components/SkillsTable';
import { LifecycleStatesTable } from './components/LifecycleStatesTable';
import { CustomParamsTable } from './components/CustomParamsTable';
import { ProjectsTable } from './components/ProjectsTable';
import { UserManagement } from './components/UserManagement';
import { LoginModal } from './components/LoginModal';
import { UserProfileModal, UserAvatarPictogram } from './components/UserProfileModal';
import { SuperUserBackupMenu } from './components/SuperUserBackupMenu';
import { BUDGET_PALETTE_32 } from './constants/colors';
import { getUserInitials } from './utils/userUtils';

type ActiveTab =
  | 'projects'
  | 'criteria'
  | 'budgets'
  | 'skills'
  | 'lifecycle'
  | 'custom_params'
  | 'users';

function Dashboard() {
  const {
    firebaseUser,
    activeUser,
    realUser,
    impersonatedUser,
    isImpersonating,
    canImpersonate,
    impersonateUser,
    stopImpersonation,
    allUsers,
    loading: authLoading,
    isAuthenticated,
    isConceptionMode,
    enterConceptionMode,
    exitConceptionMode,
    loginAsUser,
    isSuperUser,
    assumedRole,
    effectiveRole,
    effectiveRoles,
    assumeRole,
    isAdmin,
    isProjectManager,
    isResourceManager,
    isValueManagementOfficer,
    signInWithGoogle,
    logout,
    switchActiveUser,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('projects');
  const [lastSettingsTab, setLastSettingsTab] = useState<ActiveTab>('criteria');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Détection des liens d'activation ou réinitialisation reçus par email
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'activate' || action === 'reset_password') {
      setLoginModalOpen(true);
    }
  }, []);

  const isSettingsActive = ['criteria', 'budgets', 'lifecycle', 'custom_params', 'skills'].includes(activeTab);

  // Logo personnalisé de l'application (administrable)
  const [customLogo, setCustomLogo] = useState<string | null>(getCachedAppLogo());
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubBranding = subscribeToBranding((config) => {
      setCustomLogo(config?.logoUrl || null);
    });
    return () => unsubBranding();
  }, []);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingLogo(true);
      const dataUrl = await resizeImageToDataUrl(file);
      await updateAppLogo(dataUrl, activeUser?.email || 'admin');
    } catch (err) {
      console.error('Erreur changement logo:', err);
    } finally {
      setUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleResetLogo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setUploadingLogo(true);
      await resetAppLogo();
    } catch (err) {
      console.error('Erreur réinitialisation logo:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Rediriger vers l'onglet projets si un non-administrateur tente d'accéder aux utilisateurs
  useEffect(() => {
    if (activeTab === 'users' && !isAdmin) {
      setActiveTab('projects');
    }
  }, [activeTab, isAdmin]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(true);
  const [seedingCriteria, setSeedingCriteria] = useState(false);

  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [seedingBudget, setSeedingBudget] = useState(false);

  const [skills, setSkills] = useState<KeySkill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [seedingSkill, setSeedingSkill] = useState(false);

  const [projectStates, setProjectStates] = useState<ProjectState[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);

  const [customParams, setCustomParams] = useState<CustomProjectParam[]>([]);
  const [loadingCustomParams, setLoadingCustomParams] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Configuration des bonus (priorisation & quotas)
  const [bonusConfig, setBonusConfig] = useState<BonusConfig>(getCachedBonusConfig());

  // Seul l'Administrateur (et le Super User sans rôle endossé restrictif) peut gérer les compétences clés
  const canManageSkills = isAdmin || (isSuperUser && !assumedRole);

  // Le Value Management Officer ou l'Administrateur (ou Super User sans rôle endossé restrictif) peut gérer les bonus
  const canManageBonus = isAdmin || isValueManagementOfficer || (isSuperUser && !assumedRole);

  useEffect(() => {
    const unsubCriteria = subscribeToCriteria(
      (data) => {
        setCriteria(data);
        setLoadingCriteria(false);
      },
      (error) => {
        console.error('Erreur chargement critères:', error);
        setLoadingCriteria(false);
      }
    );

    const unsubBonus = subscribeToBonusConfig(
      (data) => {
        setBonusConfig(data);
      },
      (error) => {
        console.error('Erreur chargement configuration bonus:', error);
      }
    );

    const unsubBudgets = subscribeToBudgetLines(
      (data) => {
        setBudgetLines(data);
        setLoadingBudgets(false);
      },
      (error) => {
        console.error('Erreur chargement lignes budgétaires:', error);
        setLoadingBudgets(false);
      }
    );

    const unsubSkills = subscribeToKeySkills(
      (data) => {
        setSkills(data);
        setLoadingSkills(false);
      },
      (error) => {
        console.error('Erreur chargement compétences clés:', error);
        setLoadingSkills(false);
      }
    );

    const unsubProjectStates = subscribeToProjectStates(
      (data) => {
        setProjectStates(data);
        setLoadingStates(false);
      },
      (error) => {
        console.error('Erreur chargement états cycle de vie:', error);
        setLoadingStates(false);
      }
    );

    const unsubCustomParams = subscribeToCustomParams(
      (data) => {
        setCustomParams(data);
        setLoadingCustomParams(false);
      },
      (error) => {
        console.error('Erreur chargement paramètres personnalisés:', error);
        setLoadingCustomParams(false);
      }
    );

    const unsubProjects = subscribeToProjects(
      (data) => {
        setProjects(data);
        setLoadingProjects(false);
      },
      (error) => {
        console.error('Erreur chargement projets:', error);
        setLoadingProjects(false);
      }
    );

    return () => {
      unsubCriteria();
      unsubBonus();
      unsubBudgets();
      unsubSkills();
      unsubProjectStates();
      unsubCustomParams();
      unsubProjects();
    };
  }, []);

  const handleSeedCriteriaExample = async () => {
    if (!isAdmin) return;
    setSeedingCriteria(true);
    try {
      await addCriterion({
        name: 'CA additionnel',
        type: 'VALEUR',
        weight: 5,
        isActive: true,
        levels: [
          '0 K€/an',
          'de 0 à 10 K€/an',
          'de 10 à 50 K€/an',
          'de 50 à 200 K€/an',
          'de 200 à 500 K€/an',
          'plus de 500 K€/an',
        ],
        order: 0,
      });
    } catch (error) {
      console.error('Erreur ajout exemple critère:', error);
    } finally {
      setSeedingCriteria(false);
    }
  };

  const handleSeedBudgetExample = async () => {
    if (!isAdmin) return;
    setSeedingBudget(true);
    try {
      await addBudgetLine({
        name: 'Innovation & Transformation Digitale',
        budgetKe: 350,
        manager: activeUser?.displayName || 'Stéphane Labati',
        color: BUDGET_PALETTE_32[22].hex,
        isActive: true,
        order: 0,
      });
    } catch (error) {
      console.error('Erreur ajout exemple budget:', error);
    } finally {
      setSeedingBudget(false);
    }
  };

  const handleSeedSkillExample = async () => {
    if (!canManageSkills) return;
    setSeedingSkill(true);
    try {
      const rm = allUsers.find((u) => u.role === 'resource manager') || activeUser;
      const allocs = budgetLines.map((bl, i) => ({
        budgetLineId: bl.id,
        budgetLineName: bl.name,
        percentage: i === 0 ? 60 : i === 1 ? 40 : 0,
      }));

      await addKeySkill({
        name: 'Architecture Cloud & DevOps',
        resourceManagerId: rm?.id || '',
        resourceManagerName: rm?.displayName || 'Stéphane Labati',
        description: 'Conception d’infrastructures haute disponibilité, pipelines CI/CD et sécurité cloud.',
        isCapped: budgetLines.length > 0,
        budgetAllocations: allocs,
        order: 0,
      });
    } catch (error) {
      console.error('Erreur ajout exemple compétence clé:', error);
    } finally {
      setSeedingSkill(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super user':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
            <Crown className="w-3.5 h-3.5 text-amber-600" />
            <span>Super User</span>
          </span>
        );
      case 'administrateur':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-300">
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span>Administrateur</span>
          </span>
        );
      case 'chef de projet':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-300">
            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
            <span>Chef de projet</span>
          </span>
        );
      case 'resource manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-300">
            <UserCog className="w-3.5 h-3.5 text-rose-600" />
            <span>Resource Manager</span>
          </span>
        );
      case 'value management officer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <Euro className="w-3.5 h-3.5 text-emerald-600" />
            <span>Value Management Officer</span>
          </span>
        );
    }
  };

  // Si l'utilisateur n'est pas authentifié (et pas en mode conception Super User direct), afficher la fenêtre de login
  if (!authLoading && !isAuthenticated) {
    return (
      <LoginModal
        isOpen={true}
        allUsers={allUsers}
        onLoginSuccess={(u) => loginAsUser(u)}
        onEnterConceptionMode={enterConceptionMode}
        onImpersonateDirectly={(target) => impersonateUser(target)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Barre d'usurpation active pour le Super User */}
      {isImpersonating && (
        <div className="bg-indigo-950 text-white px-4 py-2.5 text-xs shadow-md z-50 border-b border-indigo-800">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1 bg-amber-400 text-slate-950 rounded font-bold">
                <Crown className="w-3.5 h-3.5 text-slate-950" />
              </div>
              <div>
                <span>
                  <strong>Mode Usurpation Super User :</strong> Vous êtes connecté à la place de{' '}
                  <strong className="text-amber-300 underline font-bold">{activeUser?.displayName}</strong> ({activeUser?.email})
                </span>
                <span className="text-indigo-300 ml-1.5 hidden md:inline text-[11px]">
                  [Privilège exclusif Super User Stéphane Labati]
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={stopImpersonation}
                className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Quitter l'usurpation et revenir à votre compte Super User"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Quitter l'usurpation (Revenir à Stéphane Labati)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre d'endossement de rôle pour le Super User (hors usurpation) */}
      {!isImpersonating && isSuperUser && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white px-4 py-2 text-xs shadow-xs z-40">
          <div className="w-full px-2 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-200 shrink-0" />
              <span>
                <strong>Mode Super User / Concepteur :</strong>
                {assumedRole ? (
                  <span className="ml-1 text-amber-100">
                    Vous testez l'application avec le rôle endossé :{' '}
                    <strong className="bg-white/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-white">
                      {ROLE_LABELS[assumedRole]}
                    </strong>
                  </span>
                ) : (
                  <span className="ml-1 text-amber-100">
                    Plein accès débloqué sur tous les modules. Vous pouvez endosser un autre rôle pour tester :
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-amber-100 mr-1 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3" />
                Endosser :
              </span>

              <button
                onClick={() => assumeRole('administrateur')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  assumedRole === 'administrateur'
                    ? 'bg-white text-amber-900 shadow-xs ring-2 ring-white/50'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                Administrateur
              </button>

              <button
                onClick={() => assumeRole('chef de projet')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  assumedRole === 'chef de projet'
                    ? 'bg-white text-amber-900 shadow-xs ring-2 ring-white/50'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                Chef de projet
              </button>

              <button
                onClick={() => assumeRole('resource manager')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  assumedRole === 'resource manager'
                    ? 'bg-white text-amber-900 shadow-xs ring-2 ring-white/50'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                Resource Manager
              </button>

              <button
                onClick={() => assumeRole('value management officer')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  assumedRole === 'value management officer'
                    ? 'bg-white text-amber-900 shadow-xs ring-2 ring-white/50'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                Value Management Officer
              </button>

              {assumedRole && (
                <button
                  onClick={() => assumeRole(null)}
                  className="ml-2 px-2 py-1 rounded text-[11px] font-bold bg-amber-900/60 hover:bg-amber-900 text-amber-100 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                  title="Revenir à tous les droits de Super User"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Réinitialiser</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* En-tête de navigation principale (Pleine largeur fluide) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Côté gauche : Logo (modifiable par l'administrateur) & Titre OPAC */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Input file masqué pour le téléversement du logo */}
            <input
              type="file"
              ref={logoInputRef}
              onChange={handleLogoFileChange}
              accept="image/png, image/jpeg, image/svg+xml, image/webp"
              className="hidden"
            />

            {/* Logo sans bulle, directement tel quel, ne dépassant pas la hauteur du titre et sous-titre */}
            <div className="relative group shrink-0 flex items-center">
              <button
                type="button"
                onClick={() => isAdmin && logoInputRef.current?.click()}
                disabled={!isAdmin || uploadingLogo}
                title={isAdmin ? "Cliquer pour charger un logo depuis votre poste" : "OPAC"}
                className={`relative transition-all flex items-center justify-center ${
                  isAdmin
                    ? 'cursor-pointer hover:opacity-85 group'
                    : 'cursor-default'
                }`}
              >
                {customLogo ? (
                  <img
                    src={customLogo}
                    alt="Logo OPAC"
                    className="h-10 max-h-[44px] w-auto max-w-[80px] object-contain"
                  />
                ) : (
                  <Layers className="w-9 h-9 text-indigo-600 shrink-0" />
                )}

                {/* Overlay pour Administrateur au survol */}
                {isAdmin && (
                  <div className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Bouton de réinitialisation si logo personnalisé et Administrateur */}
              {isAdmin && customLogo && (
                <button
                  type="button"
                  onClick={handleResetLogo}
                  title="Rétablir le logo par défaut"
                  className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div>
              <h1 className="font-bold text-slate-900 text-[20px] leading-tight">
                OPAC  
              </h1>
              <p className="text-[14px] text-slate-600 leading-snug">
                Outil de Priorisation de portefeuille et d'Alerte Capacitaire
              </p>
            </div>
          </div>

          {/* Côté droit : les 3 onglets collés à la ligne de démarcation + bulle utilisateur */}
          <div className="flex items-end gap-3 self-stretch">
            {/* Les 3 onglets de haut niveau (Projets, Paramètres, Utilisateurs) collés à la bordure inférieure */}
            <div className="flex items-end gap-1.5 select-none -mb-px">
              {/* Onglet Haut Niveau 1 : Projets (en bleu moyen) */}
              <button
                onClick={() => setActiveTab('projects')}
                className={`px-4 py-2 rounded-t-xl border-t-2 border-x-2 border-b-0 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'projects'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-blue-50/70 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Projets</span>
              </button>

              {/* Onglet Haut Niveau 2 : Paramètres */}
              <button
                onClick={() => setActiveTab(lastSettingsTab)}
                className={`px-4 py-2 rounded-t-xl border-t-2 border-x-2 border-b-0 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isSettingsActive
                    ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
                    : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-800 border-indigo-200 hover:border-indigo-300'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Paramètres</span>
              </button>

              {/* Onglet Haut Niveau 3 : Utilisateurs (visible et accessible qu'au seul persona Administrateur) */}
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded-t-xl border-t-2 border-x-2 border-b-0 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'users'
                      ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                      : 'bg-pink-50/70 hover:bg-pink-100 text-pink-700 border-pink-200 hover:border-pink-300'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Utilisateurs</span>
                </button>
              )}
            </div>

            {/* Menu 3 points verticaux pour l'export/import de toutes les données (réservé exclusivement au Super User) */}
            {isSuperUser && (
              <SuperUserBackupMenu
                isSuperUser={isSuperUser}
                currentUserEmail={activeUser?.email || ''}
              />
            )}

            {/* Bulle utilisateur en haut à droite (dynamique selon l'état de connexion) */}
            <div className="flex items-center gap-2 shrink-0 self-center">
              {authLoading ? (
                <span className="text-xs text-slate-400">Chargement...</span>
              ) : !isAuthenticated || !activeUser ? (
                /* Cas 1 : Personne n'est connecté -> bulle avec le logo du bonhomme ouvrant la connexion */
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  title="Se connecter / Définir mon mot de passe"
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 flex items-center justify-center text-slate-700 hover:text-indigo-600 transition-all shadow-2xs cursor-pointer group"
                  aria-label="Se connecter"
                >
                  <UserAvatarPictogram className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                </button>
              ) : isSuperUser && !assumedRole && !isImpersonating ? (
                /* Cas 2 : Super User connecté sans rôle endossé ni usurpation -> logo avec la couronne sur fond jaune */
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(true)}
                  title={`Mon profil (Super User - ${activeUser.displayName})`}
                  className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-300 border-2 border-amber-500 flex items-center justify-center text-amber-950 transition-all shadow-xs cursor-pointer group hover:scale-105"
                  aria-label="Mon profil (Super User)"
                >
                  <Crown className="w-5 h-5 text-amber-950 fill-amber-200/60 transition-transform group-hover:scale-110" />
                </button>
              ) : (
                /* Cas 3 : Utilisateur classique connecté, OU Super User ayant endossé un rôle (ses propres initiales), OU Super User ayant pris l'identité d'un utilisateur (initiales de cet utilisateur) -> initiales sur fond rose */
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(true)}
                  title={
                    isImpersonating
                      ? `Connecté en tant que ${activeUser.displayName} (${activeUser.email})`
                      : assumedRole
                      ? `Mon profil (${activeUser.displayName} - rôle endossé : ${ROLE_LABELS[assumedRole] || assumedRole})`
                      : `Mon profil utilisateur (${activeUser.displayName})`
                  }
                  className="w-10 h-10 rounded-full bg-pink-500 hover:bg-pink-600 border-2 border-pink-400 flex items-center justify-center text-white font-bold text-xs tracking-wider transition-all shadow-xs cursor-pointer group hover:scale-105"
                  aria-label={`Mon profil utilisateur (${activeUser.displayName})`}
                >
                  <span>{getUserInitials(activeUser.displayName, activeUser.email)}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARRE 2 (SOUS-ONGLETS DE L'ONGLET PARAMÈTRES)                            */}
        {/* Ordre : Critères, Lignes budgétaires, Cycle de vie,                      */}
        {/* Paramètres projets, Compétences clés                                     */}
        {/* ========================================================================= */}
        {isSettingsActive && (
          <div className="bg-slate-100/90 border-t border-slate-200 pt-1.5 transition-all">
            <div className="w-full px-4 sm:px-6 lg:px-8 flex items-end gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden select-none">
              {/* 1. Critères (en vert) */}
              <button
                onClick={() => {
                  setActiveTab('criteria');
                  setLastSettingsTab('criteria');
                }}
                className={`px-3 py-1.5 rounded-t-xl border-t-2 border-x-2 border-b-0 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'criteria'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs -mb-[1px] pb-[7px]'
                    : 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border-emerald-200 hover:border-emerald-300'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Critères</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'criteria' ? 'bg-emerald-700 text-white' : 'bg-emerald-200/80 text-emerald-900'
                  }`}
                >
                  {criteria.length}
                </span>
              </button>

              {/* 2. Lignes budgétaires (en turquoise) */}
              <button
                onClick={() => {
                  setActiveTab('budgets');
                  setLastSettingsTab('budgets');
                }}
                className={`px-3 py-1.5 rounded-t-xl border-t-2 border-x-2 border-b-0 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'budgets'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs -mb-[1px] pb-[7px]'
                    : 'bg-teal-50/80 hover:bg-teal-100 text-teal-800 border-teal-200 hover:border-teal-300'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Lignes budgétaires</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'budgets' ? 'bg-teal-700 text-white' : 'bg-teal-200/80 text-teal-900'
                  }`}
                >
                  {budgetLines.length}
                </span>
              </button>

              {/* 3. Cycle de vie (en bleu foncé) */}
              <button
                onClick={() => {
                  setActiveTab('lifecycle');
                  setLastSettingsTab('lifecycle');
                }}
                className={`px-3 py-1.5 rounded-t-xl border-t-2 border-x-2 border-b-0 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'lifecycle'
                    ? 'bg-blue-950 text-white border-blue-950 shadow-xs -mb-[1px] pb-[7px]'
                    : 'bg-slate-200/80 hover:bg-slate-300 text-slate-800 border-slate-300 hover:border-slate-400'
                }`}
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Cycle de vie</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'lifecycle' ? 'bg-slate-800 text-white' : 'bg-slate-300 text-slate-900'
                  }`}
                >
                  {projectStates.length}
                </span>
                {!isAdmin && <Lock className="w-3 h-3 ml-0.5" />}
              </button>

              {/* 4. Paramètres projets (en bleu ciel) */}
              <button
                onClick={() => {
                  setActiveTab('custom_params');
                  setLastSettingsTab('custom_params');
                }}
                className={`px-3 py-1.5 rounded-t-xl border-t-2 border-x-2 border-b-0 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'custom_params'
                    ? 'bg-sky-500 text-white border-sky-500 shadow-xs -mb-[1px] pb-[7px]'
                    : 'bg-sky-50/80 hover:bg-sky-100 text-sky-800 border-sky-200 hover:border-sky-300'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Paramètres projets</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'custom_params' ? 'bg-sky-600 text-white' : 'bg-sky-200/80 text-sky-900'
                  }`}
                >
                  {customParams.length}
                </span>
                {!isAdmin && <Lock className="w-3 h-3 ml-0.5" />}
              </button>

              {/* 5. Compétences clés (en rouge) */}
              <button
                onClick={() => {
                  setActiveTab('skills');
                  setLastSettingsTab('skills');
                }}
                className={`px-3 py-1.5 rounded-t-xl border-t-2 border-x-2 border-b-0 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'skills'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs -mb-[1px] pb-[7px]'
                    : 'bg-rose-50/80 hover:bg-rose-100 text-rose-800 border-rose-200 hover:border-rose-300'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Compétences clés</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'skills' ? 'bg-rose-700 text-white' : 'bg-rose-200/80 text-rose-900'
                  }`}
                >
                  {skills.length}
                </span>
                {!canManageSkills && <Lock className="w-3 h-3 ml-0.5" />}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Contenu principal (Pleine largeur fluide) */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Onglet 1 : Projets */}
        {activeTab === 'projects' && (
          <ProjectsTable
            projects={projects}
            loading={loadingProjects}
            activeUser={activeUser}
            isSuperUser={isSuperUser && !assumedRole}
            isAdmin={isAdmin}
            isProjectManager={isProjectManager}
            isResourceManager={isResourceManager}
            isValueManagementOfficer={isValueManagementOfficer}
            effectiveRole={effectiveRole}
            projectStates={projectStates}
            budgetLines={budgetLines}
            criteria={criteria}
            customParams={customParams}
            users={allUsers}
            bonusConfig={bonusConfig}
          />
        )}
        {/* Onglet 1 : Critères de priorisation */}
        {activeTab === 'criteria' && (
          <div className="space-y-6">
            <CriteriaTable
              criteria={criteria}
              loading={loadingCriteria}
              isAdmin={isAdmin}
              canManageBonus={canManageBonus}
              bonusConfig={bonusConfig}
              currentUserEmail={activeUser?.email || ''}
              roleLabel={effectiveRole}
              onSeedExample={handleSeedCriteriaExample}
              seeding={seedingCriteria}
            />
          </div>
        )}

        {/* Onglet 2 : Lignes budgétaires */}
        {activeTab === 'budgets' && (
          <div className="space-y-6">
            <BudgetLinesTable
              budgetLines={budgetLines}
              loading={loadingBudgets}
              isAdmin={isAdmin}
              onSeedExample={handleSeedBudgetExample}
              seeding={seedingBudget}
            />
          </div>
        )}

        {/* Onglet 3 : Compétences clés (Resource Manager) */}
        {activeTab === 'skills' && (
          <div className="space-y-6">
            <SkillsTable
              skills={skills}
              loading={loadingSkills}
              budgetLines={budgetLines}
              users={allUsers}
              canManage={canManageSkills}
              currentUserId={activeUser?.id}
              onSeedExample={handleSeedSkillExample}
              seeding={seedingSkill}
            />
          </div>
        )}

        {/* Onglet 5 : Cycle de vie des projets (États & Workflow) */}
        {activeTab === 'lifecycle' && (
          <div className="space-y-6">
            <LifecycleStatesTable
              states={projectStates}
              loading={loadingStates}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {/* Onglet 6 : Paramètres personnalisés de projet */}
        {activeTab === 'custom_params' && (
          <div className="space-y-6">
            <CustomParamsTable
              params={customParams}
              loading={loadingCustomParams}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {/* Onglet 7 : Gestion des utilisateurs */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {!isAdmin ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center max-w-lg mx-auto shadow-xs">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Accès restreint à l'Administrateur &amp; Super User
                </h3>
                <p className="text-xs text-slate-600 mb-4">
                  Le rôle actuellement endossé est <strong>{ROLE_LABELS[effectiveRole]}</strong>. Ce persona n'a pas les droits d'administration des utilisateurs.
                </p>
                {isSuperUser && assumedRole && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-4">
                    <span>
                      En tant que <strong>Super User</strong>, vous testez les restrictions réelles de ce rôle. Vous pouvez revenir à la vue Super User à tout moment :
                    </span>
                    <button
                      onClick={() => assumeRole(null)}
                      className="mt-2 block w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold transition-colors cursor-pointer"
                    >
                      Revenir à la vue complète Super User
                    </button>
                  </div>
                )}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setActiveTab('criteria')}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    Retourner aux critères
                  </button>
                </div>
              </div>
            ) : (
              <UserManagement
                users={allUsers}
                activeUser={activeUser}
                isSuperUser={isSuperUser}
                onImpersonateUser={impersonateUser}
              />
            )}
          </div>
        )}
      {/* Fenêtre Profil Utilisateur (affichée au clic sur le pictogramme bonhomme) */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        activeUser={activeUser}
        effectiveRoles={effectiveRoles}
        getRoleBadge={getRoleBadge}
        onLogout={isConceptionMode ? exitConceptionMode : logout}
        allUsers={allUsers}
        onSwitchUser={switchActiveUser}
        isSuperUser={isSuperUser}
        assumedRole={assumedRole}
        isImpersonating={isImpersonating}
      />

      {/* Fenêtre de Connexion / Définition du mot de passe / Activation */}
      <LoginModal
        isOpen={loginModalOpen}
        allUsers={allUsers}
        onLoginSuccess={(user) => {
          loginAsUser(user);
          setLoginModalOpen(false);
        }}
        onEnterConceptionMode={() => {
          enterConceptionMode();
          setLoginModalOpen(false);
        }}
        onImpersonateDirectly={(target) => {
          impersonateUser(target);
          setLoginModalOpen(false);
        }}
      />
    </main>
  </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
