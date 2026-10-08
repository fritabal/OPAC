import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Briefcase,
  UserCog,
  Crown,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
  KeyRound,
  Lock,
  Check,
  Plus,
  Send,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  Filter,
  RotateCcw,
  Search,
  LogIn,
  Euro,
  Copy,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { AppUser, AppUserFormData, UserRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../types/user';
import {
  addAuthorizedUser,
  updateUserRoles,
  updateUser,
  deleteAuthorizedUser,
  resetUserPasswordByAdmin,
  resendAccountActivationEmail,
  setUserActiveStatus,
  SUPER_ADMIN_EMAIL,
} from '../services/userService';
import {
  sendUserActivationNotification,
  sendPasswordResetNotification,
  requestGoogleAccessToken,
  isGmailAuthorized,
} from '../services/emailService';

interface UserManagementProps {
  users: AppUser[];
  activeUser: AppUser | null;
  isSuperUser?: boolean;
  onImpersonateUser?: (user: AppUser) => void;
}

const ALL_ROLES: UserRole[] = [
  'chef de projet',
  'resource manager',
  'value management officer',
  'administrateur',
  'super user',
];

type SortField = 'active' | 'name' | 'email' | 'roles' | 'status';
type SortDirection = 'asc' | 'desc';

// Normalise une chaîne pour une recherche insensible à la casse, aux accents et aux caractères spéciaux (ex: ø -> o, æ -> ae, é -> e)
const normalizeForSearch = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[ß]/g, 'ss')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐ]/g, 'd')
    .replace(/[ðÐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  activeUser,
  isSuperUser = false,
  onImpersonateUser,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AppUser | null>(null);
  const [resetCandidate, setResetCandidate] = useState<AppUser | null>(null);

  // Formulaire d'édition / fiche détaillée
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(['chef de projet']);
  const [modalIsActive, setModalIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Gestion des emails transactionnels Gmail
  const [sendEmailOnCreation, setSendEmailOnCreation] = useState(true);
  const [gmailReady, setGmailReady] = useState(false);
  const [authorizingGmail, setAuthorizingGmail] = useState(false);
  const [resendCandidate, setResendCandidate] = useState<AppUser | null>(null);
  const [generatedLinkData, setGeneratedLinkData] = useState<{
    title: string;
    description: string;
    email: string;
    url: string;
    token?: string;
    emailSent: boolean;
    emailError?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  React.useEffect(() => {
    isGmailAuthorized().then(setGmailReady);
  }, []);

  const handleAuthorizeGmail = async () => {
    try {
      setAuthorizingGmail(true);
      await requestGoogleAccessToken();
      const ready = await isGmailAuthorized();
      setGmailReady(ready);
      if (ready) {
        setActionSuccess(`Connexion Gmail réussie ! L'application est autorisée à envoyer des emails depuis ${SUPER_ADMIN_EMAIL}.`);
      }
    } catch (err: any) {
      alert(`Erreur de connexion Google : ${err?.message || 'Autorisation refusée'}`);
    } finally {
      setAuthorizingGmail(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyToken = (tok: string) => {
    navigator.clipboard.writeText(tok);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 3000);
  };

  // Tri du tableau
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filtre par rôles (mécanisme de va-et-vient au clic sur les encarts)
  const [selectedRoleFilters, setSelectedRoleFilters] = useState<UserRole[]>([]);

  // Recherche par nom
  const [nameSearchInput, setNameSearchInput] = useState('');
  const [appliedNameSearch, setAppliedNameSearch] = useState('');

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedNameSearch(nameSearchInput.trim());
  };

  const handleClearSearch = () => {
    setNameSearchInput('');
    setAppliedNameSearch('');
  };

  const toggleRoleFilter = (role: UserRole) => {
    setSelectedRoleFilters((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const clearRoleFilters = () => {
    setSelectedRoleFilters([]);
  };

  const getUserRoles = (u: AppUser): UserRole[] => {
    if (u.roles && Array.isArray(u.roles) && u.roles.length > 0) {
      return u.roles;
    }
    if (u.role) return [u.role];
    return ['chef de projet'];
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
    );
  };

  // Liste filtrée par rôles et par nom puis triée des utilisateurs
  const sortedUsers = useMemo(() => {
    const filtered = users.filter((u) => {
      // Filtre par rôles : l'utilisateur doit avoir au moins un des rôles sélectionnés
      if (selectedRoleFilters.length > 0) {
        const uRoles = getUserRoles(u);
        const matchesRole = selectedRoleFilters.some((r) => uRoles.includes(r));
        if (!matchesRole) return false;
      }

      // Filtre par nom : insensible à la casse, aux accents et caractères étrangers (ø, æ, etc.)
      if (appliedNameSearch !== '') {
        const normalizedTarget = normalizeForSearch(u.displayName || '');
        const normalizedQuery = normalizeForSearch(appliedNameSearch);
        if (!normalizedTarget.includes(normalizedQuery)) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'active') {
        const aActive = a.isActive !== false ? 1 : 0;
        const bActive = b.isActive !== false ? 1 : 0;
        comparison = aActive - bActive;
      } else if (sortField === 'name') {
        comparison = a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
      } else if (sortField === 'email') {
        comparison = a.email.localeCompare(b.email, 'fr', { sensitivity: 'base' });
      } else if (sortField === 'roles') {
        const aRoles = getUserRoles(a).map((r) => ROLE_LABELS[r]).join(', ');
        const bRoles = getUserRoles(b).map((r) => ROLE_LABELS[r]).join(', ');
        comparison = aRoles.localeCompare(bRoles, 'fr', { sensitivity: 'base' });
      } else if (sortField === 'status') {
        const getStatusOrder = (u: AppUser) => {
          if (u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return '0_concepteur';
          if (u.isActive === false) return '3_inactif';
          if (u.mustResetPassword || !u.passwordHash) return '2_nouveau_mot_de_passe';
          return '1_actif';
        };
        comparison = getStatusOrder(a).localeCompare(getStatusOrder(b));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [users, selectedRoleFilters, appliedNameSearch, sortField, sortDirection]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setEmail('');
    setDisplayName('');
    setSelectedRoles(['chef de projet']);
    setModalIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setDisplayName(user.displayName);
    setSelectedRoles(getUserRoles(user));
    setModalIsActive(user.isActive !== false);
    setFormError(null);
    setModalOpen(true);
  };

  const handleToggleModalRole = (role: UserRole) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length === 1) {
        setFormError('Un utilisateur doit posséder au moins un rôle attribué.');
        return;
      }
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setFormError("L'adresse email est requise.");
      return;
    }

    if (selectedRoles.length === 0) {
      setFormError('Veuillez sélectionner au moins un rôle pour cet utilisateur.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          displayName: displayName.trim(),
          roles: selectedRoles,
          role: selectedRoles[0],
          isActive: modalIsActive,
        });
        setActionSuccess(`L'utilisateur « ${displayName.trim()} » a été mis à jour avec succès.`);
        setModalOpen(false);
      } else {
        const newUser = await addAuthorizedUser({
          email: cleanEmail,
          displayName: displayName.trim() || cleanEmail.split('@')[0],
          roles: selectedRoles,
          role: selectedRoles[0],
          isActive: modalIsActive,
        });

        const currentOrigin = window.location.origin;
        const activationUrl = `${currentOrigin}?action=activate&email=${encodeURIComponent(cleanEmail)}&token=${newUser.activationToken || ''}`;

        let emailSent = false;
        let emailError: string | undefined;

        if (sendEmailOnCreation && cleanEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
          const rolesList = selectedRoles.map((r) => ROLE_LABELS[r]).join(', ');
          const sendRes = await sendUserActivationNotification({
            toEmail: cleanEmail,
            displayName: displayName.trim() || cleanEmail.split('@')[0],
            rolesList,
            activationToken: newUser.activationToken || undefined,
            appUrl: currentOrigin,
          });

          emailSent = sendRes.success;
          emailError = sendRes.error;
          if (emailSent) {
            setGmailReady(true);
          }
        }

        setModalOpen(false);

        setGeneratedLinkData({
          title: `Compte créé pour « ${cleanEmail} »`,
          description: emailSent
            ? `L'email d'invitation et d'activation a été expédié avec succès depuis votre compte Google (${SUPER_ADMIN_EMAIL}) via l'API Gmail.`
            : sendEmailOnCreation
            ? `Le compte a été créé dans OPAC. Toutefois, l'envoi de l'email via Gmail a rencontré une difficulté (${emailError || 'Autorisation requise'}). Vous pouvez copier le lien ci-dessous et le transmettre directement au collaborateur.`
            : `Le compte a été créé. Vous pouvez copier le lien d'accès ci-dessous et le transmettre au collaborateur.`,
          email: cleanEmail,
          url: activationUrl,
          token: newUser.activationToken || undefined,
          emailSent,
          emailError,
        });

        setActionSuccess(
          emailSent
            ? `L'utilisateur « ${cleanEmail} » a été créé et son email d'activation a été envoyé depuis ${SUPER_ADMIN_EMAIL} !`
            : `L'utilisateur « ${cleanEmail} » a été créé avec succès.`
        );
      }
    } catch (err: any) {
      setFormError(err?.message || "Erreur lors de l'enregistrement de l'utilisateur.");
    } finally {
      setSaving(false);
    }
  };

  // Bascule directe d'état actif/inactif depuis la 1ère colonne du tableau
  const handleToggleActiveDirect = async (user: AppUser, nextActive: boolean) => {
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && !nextActive) {
      alert("Le Super User / Concepteur de l'application ne peut pas être désactivé.");
      return;
    }

    setSaving(true);
    try {
      await setUserActiveStatus(user.id, user.email, nextActive);
      setActionSuccess(
        nextActive
          ? `L'accès pour « ${user.displayName} » est maintenant réactivé.`
          : `L'accès pour « ${user.displayName} » a été désactivé. Toutes ses informations et rôles sont conservés.`
      );
    } catch (err: any) {
      alert("Erreur lors de la mise à jour de l'état : " + err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmResendActivation = async () => {
    if (!resendCandidate) return;
    setSaving(true);
    try {
      const { activationToken } = await resendAccountActivationEmail(resendCandidate.id, resendCandidate.email);
      const currentOrigin = window.location.origin;
      const activationUrl = `${currentOrigin}?action=activate&email=${encodeURIComponent(resendCandidate.email)}&token=${activationToken}`;

      const uRoles = getUserRoles(resendCandidate);
      const rolesList = uRoles.map((r) => ROLE_LABELS[r]).join(', ');

      const sendRes = await sendUserActivationNotification({
        toEmail: resendCandidate.email,
        displayName: resendCandidate.displayName,
        rolesList,
        activationToken,
        appUrl: currentOrigin,
      });

      const emailSent = sendRes.success;
      const emailError = sendRes.error;
      if (emailSent) {
        setGmailReady(true);
      }

      const target = resendCandidate;
      setResendCandidate(null);

      setGeneratedLinkData({
        title: `Lien d'activation renvoyé pour « ${target.displayName} »`,
        description: emailSent
          ? `L'email d'invitation et d'activation a été expédié avec succès à « ${target.email} » depuis ${SUPER_ADMIN_EMAIL} via l'API Gmail.`
          : `L'activation a été renouvelée. L'envoi de l'email via Gmail a rencontré un problème (${emailError || 'Autorisation requise'}). Vous pouvez copier le lien ci-dessous.`,
        email: target.email,
        url: activationUrl,
        token: activationToken,
        emailSent,
        emailError,
      });

      setActionSuccess(
        emailSent
          ? `L'email d'activation a été renvoyé avec succès à « ${target.email} » depuis votre compte Google !`
          : `Lien d'activation renouvelé pour « ${target.email} ».`
      );
    } catch (err: any) {
      alert("Erreur lors de l'envoi de l'email d'activation : " + err?.message);
    } finally {
      setSaving(false);
    }
  };

  // Toggle rapide d'un rôle directement dans la ligne du tableau
  const handleToggleRoleDirect = async (user: AppUser, roleToToggle: UserRole) => {
    const isSuperAdminAccount = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const currentRoles = getUserRoles(user);

    if (currentRoles.includes(roleToToggle)) {
      if (currentRoles.length === 1) {
        alert('Un utilisateur doit posséder au moins un rôle attribué.');
        return;
      }
      if (isSuperAdminAccount && roleToToggle === 'super user') {
        alert("Le rôle Super User ne peut pas être retiré du compte concepteur principal.");
        return;
      }
      const nextRoles = currentRoles.filter((r) => r !== roleToToggle);
      try {
        await updateUserRoles(user.id, nextRoles);
        setActionSuccess(`Rôle « ${ROLE_LABELS[roleToToggle]} » retiré pour ${user.displayName}.`);
      } catch (err: any) {
        alert('Erreur : ' + err?.message);
      }
    } else {
      const nextRoles = [...currentRoles, roleToToggle];
      try {
        await updateUserRoles(user.id, nextRoles);
        setActionSuccess(`Rôle « ${ROLE_LABELS[roleToToggle]} » ajouté pour ${user.displayName}.`);
      } catch (err: any) {
        alert('Erreur : ' + err?.message);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    setSaving(true);
    try {
      await deleteAuthorizedUser(deleteCandidate.id, deleteCandidate.email);
      setDeleteCandidate(null);
      setActionSuccess(`L'utilisateur « ${deleteCandidate.displayName} » a été supprimé.`);
    } catch (err: any) {
      alert('Erreur lors de la suppression : ' + err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmResetPassword = async (sendEmail: boolean) => {
    if (!resetCandidate) return;
    setSaving(true);
    try {
      const { resetToken } = await resetUserPasswordByAdmin(resetCandidate.id);
      const currentOrigin = window.location.origin;
      const resetUrl = `${currentOrigin}?action=reset_password&email=${encodeURIComponent(resetCandidate.email)}&token=${resetToken}`;

      let emailSent = false;
      let emailError: string | undefined;

      if (sendEmail) {
        const sendRes = await sendPasswordResetNotification({
          toEmail: resetCandidate.email,
          displayName: resetCandidate.displayName,
          resetToken,
          appUrl: currentOrigin,
        });
        emailSent = sendRes.success;
        emailError = sendRes.error;
        if (emailSent) {
          setGmailReady(true);
        }
      }

      const targetCandidate = resetCandidate;
      setResetCandidate(null);

      setGeneratedLinkData({
        title: `Mot de passe réinitialisé pour « ${targetCandidate.displayName} »`,
        description: emailSent
          ? `L'ancien mot de passe a été effacé et l'email de notification a été expédié avec succès depuis ${SUPER_ADMIN_EMAIL} via l'API Gmail.`
          : sendEmail
          ? `Le mot de passe a été effacé. Cependant, l'envoi de l'email via Gmail a rencontré une difficulté (${emailError || 'Autorisation requise'}). Vous pouvez copier le lien ci-dessous.`
          : `Le mot de passe actuel a été effacé avec succès. Dès sa prochaine connexion, l'utilisateur devra créer son nouveau mot de passe.`,
        email: targetCandidate.email,
        url: resetUrl,
        token: resetToken,
        emailSent,
        emailError,
      });

      setActionSuccess(
        emailSent
          ? `Le mot de passe de « ${targetCandidate.displayName} » a été réinitialisé et l'email envoyé depuis ${SUPER_ADMIN_EMAIL} !`
          : `Le mot de passe de « ${targetCandidate.displayName} » a été réinitialisé.`
      );
    } catch (err: any) {
      alert('Erreur lors de la réinitialisation du mot de passe : ' + err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSeedPersonas = async () => {
    setSeeding(true);
    try {
      const personas: AppUserFormData[] = [
        {
          email: 'alice.durand@entreprise.com',
          displayName: 'Alice Durand',
          roles: ['resource manager', 'chef de projet'],
          role: 'resource manager',
          isActive: true,
        },
        {
          email: 'marc.lefevre@entreprise.com',
          displayName: 'Marc Lefebvre',
          roles: ['resource manager'],
          role: 'resource manager',
          isActive: true,
        },
        {
          email: 'claire.bernard@entreprise.com',
          displayName: 'Claire Bernard',
          roles: ['administrateur', 'chef de projet'],
          role: 'administrateur',
          isActive: false, // Compte désactivé / en attente d'activation
        },
        {
          email: 'victor.moreau@entreprise.com',
          displayName: 'Victor Moreau',
          roles: ['value management officer'],
          role: 'value management officer',
          isActive: true,
        },
      ];

      for (const p of personas) {
        const exists = users.some((u) => u.email.toLowerCase() === p.email.toLowerCase());
        if (!exists) {
          await addAuthorizedUser(p);
        }
      }
      setActionSuccess('Comptes de test créés avec succès (dont un compte inactif).');
    } catch (e) {
      console.error('Erreur seed personas:', e);
    } finally {
      setSeeding(false);
    }
  };

  // Helper pour obtenir l'icône standard du rôle (conforme au bandeau en haut)
  const getRoleIcon = (role: UserRole, className: string = 'w-3.5 h-3.5') => {
    switch (role) {
      case 'super user':
        return <Crown className={className} />;
      case 'administrateur':
        return <Shield className={className} />;
      case 'chef de projet':
        return <Briefcase className={className} />;
      case 'resource manager':
        return <UserCog className={className} />;
      case 'value management officer':
        return <Euro className={className} />;
    }
  };

  // Badges harmonisés selon la charte demandée :
  // - Super User : Jaune doré (amber)
  // - Administrateur : Violet (purple)
  // - Chef de projet : Bleu (blue)
  // - Resource Manager : Rose (rose)
  // - Value Management Officer : Vert (emerald) avec pictogramme €
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super user':
        return (
          <span
            key={role}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs whitespace-nowrap"
          >
            {getRoleIcon('super user', 'w-3.5 h-3.5 text-amber-600')}
            <span>Super User</span>
          </span>
        );
      case 'administrateur':
        return (
          <span
            key={role}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-300 whitespace-nowrap"
          >
            {getRoleIcon('administrateur', 'w-3.5 h-3.5 text-purple-600')}
            <span>Administrateur</span>
          </span>
        );
      case 'chef de projet':
        return (
          <span
            key={role}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-300 whitespace-nowrap"
          >
            {getRoleIcon('chef de projet', 'w-3.5 h-3.5 text-blue-600')}
            <span>Chef de projet</span>
          </span>
        );
      case 'resource manager':
        return (
          <span
            key={role}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-300 whitespace-nowrap"
          >
            {getRoleIcon('resource manager', 'w-3.5 h-3.5 text-rose-600')}
            <span>Resource Manager</span>
          </span>
        );
      case 'value management officer':
        return (
          <span
            key={role}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap"
          >
            {getRoleIcon('value management officer', 'w-3.5 h-3.5 text-emerald-600')}
            <span>Value Management Officer</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Encart Gestion des utilisateurs contenant le titre, les actions et les 4 boîtes des rôles */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        {/* En-tête : Titre et boutons d'actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-pink-600 flex items-center gap-2.5">
              <Users className="w-5 h-5 text-pink-600 shrink-0" />
              <span>Gestion des utilisateurs</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Activez ou désactivez les comptes, assignez les rôles directement et filtrez la liste en cliquant sur les encarts ci-dessous.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Statut et connexion Gmail */}
            <button
              type="button"
              onClick={handleAuthorizeGmail}
              disabled={authorizingGmail}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-2xs ${
                gmailReady
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              }`}
              title={
                gmailReady
                  ? `Gmail connecté (${SUPER_ADMIN_EMAIL}) - Prêt à envoyer les notifications`
                  : `Connecter Google Workspace pour autoriser l'envoi depuis ${SUPER_ADMIN_EMAIL}`
              }
            >
              <Mail className={`w-3.5 h-3.5 ${gmailReady ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span>
                {authorizingGmail
                  ? 'Connexion...'
                  : gmailReady
                  ? 'Gmail connecté'
                  : 'Connecter Gmail'}
              </span>
            </button>

            {users.length <= 1 && (
              <button
                onClick={handleSeedPersonas}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>{seeding ? 'Création...' : 'Créer comptes tests (avec compte inactif)'}</span>
              </button>
            )}

            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Autoriser un utilisateur</span>
            </button>
          </div>
        </div>

        {/* 4 boîtes décrivant les rôles et filtrage en va-et-vient au clic */}
        <div className="space-y-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
            <span className="font-semibold flex items-center gap-1.5 text-slate-700">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filtrer les utilisateurs par rôle (cliquez sur un ou plusieurs encarts) :</span>
            </span>
            {selectedRoleFilters.length > 0 && (
              <button
                type="button"
                onClick={clearRoleFilters}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Effacer le filtre ({selectedRoleFilters.length} sélectionné{selectedRoleFilters.length > 1 ? 's' : ''})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {ALL_ROLES.map((r) => {
              const count = users.filter((u) => getUserRoles(u).includes(r)).length;
              const isSelected = selectedRoleFilters.includes(r);

              // Boîte non sélectionnée : fond gris léger (comme l'en-tête du tableau bg-slate-100/90)
              // Boîte sélectionnée : couleur spécifique
              const getCardClasses = () => {
                if (!isSelected) {
                  return 'bg-slate-100/90 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 shadow-2xs';
                }
                switch (r) {
                  case 'super user':
                    return 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/50 shadow-xs text-amber-950';
                  case 'administrateur':
                    return 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-400/50 shadow-xs text-purple-950';
                  case 'chef de projet':
                    return 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-400/50 shadow-xs text-blue-950';
                  case 'resource manager':
                    return 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-400/50 shadow-xs text-rose-950';
                  case 'value management officer':
                    return 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-400/50 shadow-xs text-emerald-950';
                }
              };

              const getCountClasses = () => {
                if (!isSelected) {
                  return 'text-slate-600 font-mono text-[11px] font-semibold bg-white/70 border border-slate-200/80 px-2 py-0.5 rounded-full';
                }
                switch (r) {
                  case 'super user':
                    return 'text-amber-900 bg-amber-100/90 border border-amber-300 font-mono text-[11px] font-bold px-2 py-0.5 rounded-full';
                  case 'administrateur':
                    return 'text-purple-900 bg-purple-100/90 border border-purple-300 font-mono text-[11px] font-bold px-2 py-0.5 rounded-full';
                  case 'chef de projet':
                    return 'text-blue-900 bg-blue-100/90 border border-blue-300 font-mono text-[11px] font-bold px-2 py-0.5 rounded-full';
                  case 'resource manager':
                    return 'text-rose-900 bg-rose-100/90 border border-rose-300 font-mono text-[11px] font-bold px-2 py-0.5 rounded-full';
                  case 'value management officer':
                    return 'text-emerald-900 bg-emerald-100/90 border border-emerald-300 font-mono text-[11px] font-bold px-2 py-0.5 rounded-full';
                }
              };

              // Texte décrivant les rôles : gris foncé lisible quand non sélectionné
              const getDescriptionClasses = () => {
                if (!isSelected) return 'text-slate-600';
                switch (r) {
                  case 'super user':
                    return 'text-amber-950/90';
                  case 'administrateur':
                    return 'text-purple-950/90';
                  case 'chef de projet':
                    return 'text-blue-950/90';
                  case 'resource manager':
                    return 'text-rose-950/90';
                  case 'value management officer':
                    return 'text-emerald-950/90';
                }
              };

              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRoleFilter(r)}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative group h-full ${getCardClasses()}`}
                  title={
                    isSelected
                      ? `Filtre actif : cliquer pour retirer le filtre ${ROLE_LABELS[r]}`
                      : `Cliquer pour filtrer les utilisateurs ayant le rôle ${ROLE_LABELS[r]}`
                  }
                >
                  <div className="w-full">
                    {/* Nom du persona occupant toute la largeur */}
                    <div className="mb-2 flex items-center">
                      {getRoleBadge(r)}
                    </div>
                    <p className={`text-xs leading-relaxed ${getDescriptionClasses()}`}>
                      {ROLE_DESCRIPTIONS[r]}
                    </p>
                  </div>

                  {/* Boîte avec le nombre de titulaires déplacée en bas de la boîte */}
                  <div className="pt-2.5 mt-2.5 border-t border-slate-200/50 flex items-center justify-between w-full">
                    <span className={getCountClasses()}>
                      {count} titulaire{count > 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Ligne de recherche par nom d'utilisateur */}
          <form
            onSubmit={handleSearchSubmit}
            className="pt-3 border-t border-slate-200/80 flex flex-col md:flex-row md:items-center gap-3"
          >
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Rechercher un utilisateur par son nom
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={nameSearchInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNameSearchInput(val);
                    if (val.trim() === '') {
                      setAppliedNameSearch('');
                    }
                  }}
                  placeholder="Entrez tout ou partie du nom..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all pr-7"
                />
                {nameSearchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title="Effacer la recherche"
                    aria-label="Effacer la recherche"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0 inline-flex items-center justify-center"
                title="Rechercher"
                aria-label="Rechercher"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Tableau des utilisateurs avec tri et sans redondance de colonne */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 uppercase font-semibold tracking-wider border-b border-slate-200 select-none">
              <tr>
                {/* Colonne 1 : Nom avec Tri */}
                <th className="py-3 px-4 min-w-[190px]">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="group inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-700 hover:text-indigo-600 cursor-pointer"
                    title="Trier par nom d'utilisateur"
                  >
                    <span>NOM</span>
                    {getSortIcon('name')}
                  </button>
                </th>

                {/* Colonne 2 : Email avec Tri */}
                <th className="py-3 px-4 min-w-[170px]">
                  <button
                    type="button"
                    onClick={() => handleSort('email')}
                    className="group inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-700 hover:text-indigo-600 cursor-pointer"
                    title="Trier par adresse email"
                  >
                    <span>EMAIL</span>
                    {getSortIcon('email')}
                  </button>
                </th>

                {/* Colonne 3 : Rôles associés (avec bascule directe et tri sur les rôles) */}
                <th className="py-3 px-4 min-w-[200px]">
                  <button
                    type="button"
                    onClick={() => handleSort('roles')}
                    className="group inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-700 hover:text-indigo-600 cursor-pointer"
                    title="Trier par rôles attribués"
                  >
                    <span>RÔLES ASSOCIÉS</span>
                    {getSortIcon('roles')}
                  </button>
                </th>

                {/* Colonne 4 : ACTIF avec Tri (placée juste avant STATUT) */}
                <th className="py-3 px-4 w-24 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('active')}
                    className="group inline-flex items-center justify-center gap-1.5 font-semibold uppercase tracking-wider text-slate-700 hover:text-indigo-600 cursor-pointer"
                    title="Trier par compte actif ou inactif"
                  >
                    <span>ACTIF</span>
                    {getSortIcon('active')}
                  </button>
                </th>

                {/* Colonne 5 : Statut avec Tri */}
                <th className="py-3 px-4 min-w-[190px]">
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className="group inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-700 hover:text-indigo-600 cursor-pointer"
                    title="Trier par statut de compte et mot de passe"
                  >
                    <span>STATUT</span>
                    {getSortIcon('status')}
                  </button>
                </th>

                {/* Colonne 6 : Actions */}
                <th className="py-3 px-4 w-28 text-right uppercase tracking-wider font-semibold">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-sm text-slate-700">Aucun utilisateur trouvé</p>
                      <p className="text-xs text-slate-500 max-w-md">
                        {appliedNameSearch && selectedRoleFilters.length > 0
                          ? `Aucun utilisateur ne contient « ${appliedNameSearch} » dans son nom avec les rôles sélectionnés.`
                          : appliedNameSearch
                          ? `Aucun utilisateur ne contient « ${appliedNameSearch} » dans son nom.`
                          : `Aucun utilisateur ne possède l'un des rôles sélectionnés (${selectedRoleFilters.map((r) => ROLE_LABELS[r]).join(', ')}).`}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {appliedNameSearch && (
                          <button
                            type="button"
                            onClick={handleClearSearch}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Effacer la recherche</span>
                          </button>
                        )}
                        {selectedRoleFilters.length > 0 && (
                          <button
                            type="button"
                            onClick={clearRoleFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Effacer les filtres de rôle</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : sortedUsers.map((u) => {
                const isCurrent =
                  activeUser?.id === u.id ||
                  activeUser?.email.toLowerCase() === u.email.toLowerCase();
                const isSuperAdminAccount =
                  u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                const uRoles = getUserRoles(u);
                const isSuper = uRoles.includes('super user') || isSuperAdminAccount;
                const isActive = u.isActive !== false;
                const needsPasswordReset =
                  !isSuperAdminAccount && (u.mustResetPassword === true || !u.passwordHash);

                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCurrent ? 'bg-indigo-50/40' : !isActive ? 'bg-slate-50/50 opacity-90' : ''
                    }`}
                  >
                    {/* Colonne 1 : Nom (sans bulle d'initiale) */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span className={!isActive ? 'text-slate-500' : ''}>{u.displayName}</span>
                      </div>
                    </td>

                    {/* Colonne 2 : Email */}
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>

                    {/* Colonne 3 : Rôles associés (boîtes compactes avec pictogrammes sur une même ligne) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {ALL_ROLES.map((r) => {
                          const hasRole = uRoles.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleToggleRoleDirect(u, r)}
                              title={
                                hasRole
                                  ? `Rôle ${ROLE_LABELS[r]} actif. Cliquer pour le retirer.`
                                  : `Cliquer pour attribuer le rôle ${ROLE_LABELS[r]}`
                              }
                              aria-label={`${ROLE_LABELS[r]} : ${hasRole ? 'Actif' : 'Inactif'}`}
                              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer border ${
                                hasRole
                                  ? r === 'super user'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs ring-1 ring-amber-400/40'
                                    : r === 'administrateur'
                                    ? 'bg-purple-100 text-purple-900 border-purple-300 shadow-2xs ring-1 ring-purple-400/40'
                                    : r === 'chef de projet'
                                    ? 'bg-blue-100 text-blue-900 border-blue-300 shadow-2xs ring-1 ring-blue-400/40'
                                    : r === 'resource manager'
                                    ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-2xs ring-1 ring-rose-400/40'
                                    : 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs ring-1 ring-emerald-400/40'
                                  : 'bg-slate-50/80 hover:bg-slate-100 text-slate-300 hover:text-slate-500 border-slate-200 border-dashed'
                              }`}
                            >
                              {r === 'super user' && <Crown className="w-3.5 h-3.5" />}
                              {r === 'administrateur' && <Shield className="w-3.5 h-3.5" />}
                              {r === 'chef de projet' && <Briefcase className="w-3.5 h-3.5" />}
                              {r === 'resource manager' && <UserCog className="w-3.5 h-3.5" />}
                              {r === 'value management officer' && <Euro className="w-3.5 h-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Colonne 4 : ACTIF (uniquement la boîte à cocher, sans encadrement vert ou gris ni texte) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isActive}
                        disabled={isSuperAdminAccount || saving}
                        onChange={(e) => handleToggleActiveDirect(u, e.target.checked)}
                        title={
                          isSuperAdminAccount
                            ? 'Le compte Concepteur / Super User reste toujours actif'
                            : isActive
                            ? 'Actif (coché). Cliquer pour désactiver'
                            : 'Inactif (décoché). Cliquer pour activer'
                        }
                        aria-label={`Compte ${u.displayName} : ${isActive ? 'Actif' : 'Non actif'}`}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </td>

                    {/* Colonne 5 : STATUT (uniquement l'explication sans préciser Actif/Non actif ni pictogramme) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isSuperAdminAccount ? (
                        <span className="text-xs text-slate-700 font-medium">
                          Mot de passe défini
                        </span>
                      ) : !u.passwordHash ? (
                        <span className="text-xs text-slate-500 font-medium">
                          En attente de mot de passe
                        </span>
                      ) : u.mustResetPassword ? (
                        <span className="text-xs text-amber-700 font-medium">
                          Nouveau mot de passe requis
                        </span>
                      ) : (
                        <span className="text-xs text-slate-700 font-medium">
                          Mot de passe défini
                        </span>
                      )}
                    </td>

                    {/* Colonne 6 : Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Privilège Super User : Se connecter à la place de cet utilisateur */}
                        {isSuperUser && !isCurrent && onImpersonateUser && (
                          <button
                            type="button"
                            onClick={() => onImpersonateUser(u)}
                            className="p-1.5 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md transition-colors cursor-pointer"
                            title={`Se connecter à la place de ${u.displayName} (Privilège Super User)`}
                          >
                            <LogIn className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Pour un utilisateur non actif : renvoyer l'email d'activation */}
                        {!isSuperAdminAccount && !isActive && (
                          <button
                            type="button"
                            onClick={() => setResendCandidate(u)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            title="Renvoyer l'email d'activation et de définition du mot de passe"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Pour un utilisateur actif : réinitialiser le mot de passe */}
                        {!isSuperAdminAccount && isActive && (
                          <button
                            type="button"
                            onClick={() => setResetCandidate(u)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                            title="Réinitialiser le mot de passe (effacer pour forcer un nouveau mot de passe)"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                          title="Modifier la fiche détaillée et les rôles"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {!isSuperAdminAccount && (
                          <button
                            type="button"
                            onClick={() => setDeleteCandidate(u)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="Révoquer l'accès"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-500 text-xs flex justify-between items-center flex-wrap gap-2">
          <span>
            {selectedRoleFilters.length > 0 || appliedNameSearch ? (
              <>
                Affichage filtré : <strong className="text-indigo-700">{sortedUsers.length}</strong> utilisateur{sortedUsers.length > 1 ? 's' : ''} sur <strong>{users.length}</strong> au total
              </>
            ) : (
              <>
                Total des comptes : <strong>{users.length}</strong> (dont{' '}
                <strong className="text-emerald-700">
                  {users.filter((u) => u.isActive !== false).length} actif(s)
                </strong>{' '}
                et{' '}
                <strong className="text-amber-700">
                  {users.filter((u) => u.isActive === false).length} non actif(s)
                </strong>
                )
              </>
            )}
          </span>
          <span className="text-slate-400">
            {(selectedRoleFilters.length > 0 || appliedNameSearch) && (
              <button
                type="button"
                onClick={() => {
                  clearRoleFilters();
                  handleClearSearch();
                }}
                className="text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer mr-2"
              >
                Réinitialiser les filtres
              </button>
            )}
            Cliquez sur un en-tête pour trier. Cochez/décochez les rôles ou l'état actif/inactif directement dans le tableau.
          </span>
        </div>
      </div>

      {/* Modal Réinitialisation de mot de passe par l'administrateur */}
      {resetCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <KeyRound className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Réinitialiser le mot de passe
                </h3>
                <p className="text-xs text-slate-500">
                  Effacement et obligation d'un nouveau mot de passe
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Voulez-vous réinitialiser le mot de passe de{' '}
              <strong className="text-slate-900 font-semibold">{resetCandidate.displayName}</strong>{' '}
              ({resetCandidate.email}) ?
            </p>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs mb-6 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Conséquence immédiate :</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                Le mot de passe actuel sera <strong>effacé</strong>. Dès sa prochaine tentative de connexion avec son email, l'utilisateur sera invité à définir un nouveau mot de passe conforme aux règles de sécurité (au moins 20 caractères, avec majuscule, minuscule, chiffre et symbole).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 flex-wrap pt-2">
              <button
                type="button"
                onClick={() => setResetCandidate(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleConfirmResetPassword(false)}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Effacer le mot de passe sans envoyer d'email"
              >
                {saving ? 'Traitement...' : 'Réinitialiser sans email'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleConfirmResetPassword(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{saving ? 'Traitement...' : 'Réinitialiser & envoyer via Gmail'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation de renvoi d'activation */}
      {resendCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-blue-600 mb-3">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Renvoyer l'invitation d'activation
                </h3>
                <p className="text-xs text-slate-500">
                  Expédition par Gmail depuis {SUPER_ADMIN_EMAIL}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Voulez-vous renvoyer l'email d'invitation et d'activation à{' '}
              <strong className="text-slate-900 font-semibold">{resendCandidate.displayName}</strong>{' '}
              ({resendCandidate.email}) depuis votre compte Google <strong className="text-slate-900 font-mono">{SUPER_ADMIN_EMAIL}</strong> ?
            </p>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs mb-6">
              <p className="text-[11px] leading-relaxed">
                Le collaborateur recevra un email officiel OPAC contenant son lien sécurisé pour définir son mot de passe et activer son compte.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setResendCandidate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmResendActivation}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{saving ? 'Envoi en cours...' : 'Confirmer et expédier via Gmail'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Affichage du lien généré & confirmation d'envoi d'email */}
      {generatedLinkData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${generatedLinkData.emailSent ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {generatedLinkData.emailSent ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Mail className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {generatedLinkData.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {generatedLinkData.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeneratedLinkData(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              generatedLinkData.emailSent
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : generatedLinkData.emailError
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              {generatedLinkData.description}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Lien direct d'activation / réinitialisation :
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLinkData.url}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-700 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(generatedLinkData.url)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    copiedLink
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                  }`}
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier le lien</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Vous pouvez également coller ce lien dans Teams, Slack ou un email manuel si nécessaire.
              </p>
            </div>

            {generatedLinkData.token && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Code de sécurité (Jeton) :</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">À renseigner si le lien affiche une erreur 403</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedLinkData.token}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyToken(generatedLinkData.token!)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      copiedToken
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier le code</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  💡 <strong>Astuce :</strong> Si le collaborateur ouvre le lien depuis sa messagerie externe et rencontre une restriction réseau (Erreur 403 propre à Google Cloud Run), transmettez-lui simplement son code. Il pourra le saisir directement dans OPAC depuis <em>« Saisir un code de sécurité »</em>.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGeneratedLinkData(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fiche détaillée de l'utilisateur (avec boîte à cocher compte actif et rôles colorés/grisés) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-pink-100 text-pink-600 rounded-xl border border-pink-200 shrink-0">
                  <Users className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-base">
                    {editingUser ? 'Fiche détaillée de l’utilisateur' : 'Autoriser un nouvel utilisateur'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingUser
                      ? 'Consultez ou modifiez les habilitations, rôles et accès de cet utilisateur.'
                      : 'Invitez un collaborateur et définissez ses rôles et droits d’accès.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Boîte à cocher État du compte dans la fiche détaillée */}
              <div
                onClick={() => {
                  if (editingUser?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return;
                  setModalIsActive(!modalIsActive);
                }}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer select-none transition-all ${
                  modalIsActive
                    ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/50'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                } ${
                  editingUser?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
                    ? 'cursor-not-allowed opacity-80'
                    : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={modalIsActive}
                    disabled={editingUser?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                    onChange={(e) => setModalIsActive(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer pointer-events-none"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Compte actif (autoriser l'accès)</span>
                      {modalIsActive ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                          Actif
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                          Non actif
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      {modalIsActive
                        ? 'L’utilisateur peut se connecter à la plateforme.'
                        : 'L’accès est suspendu sans perte des rôles ni des informations associées.'}
                    </p>
                  </div>
                </div>

                <div>
                  {modalIsActive ? (
                    <ToggleRight className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Adresse Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingUser)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="utilisateur@entreprise.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                />
                {!editingUser && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Un email sera envoyé avec un lien pour activer son compte et définir son mot de passe.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nom Complet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex : Alice Durand"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Sélection multiple de rôles avec couleurs dédiées si sélectionnés, gris sinon */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Rôles &amp; Profils attribués (Cumulables) <span className="text-red-500">*</span></span>
                  <span className="text-[11px] text-indigo-600 font-semibold normal-case">
                    {selectedRoles.length} rôle{selectedRoles.length > 1 ? 's' : ''} sélectionné{selectedRoles.length > 1 ? 's' : ''}
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Cochez un ou plusieurs rôles pour cet utilisateur (par exemple : Resource Manager ET Chef de projet).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_ROLES.map((roleKey) => {
                    const isChecked = selectedRoles.includes(roleKey);

                    // Style dynamique : couleurs demandées si sélectionné, gris neutre si non sélectionné
                    const getCardStyle = () => {
                      if (!isChecked) {
                        return 'bg-slate-50/60 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100/60';
                      }
                      switch (roleKey) {
                        case 'super user':
                          return 'bg-amber-50 border-amber-300 ring-1 ring-amber-400 text-amber-950 shadow-2xs';
                        case 'administrateur':
                          return 'bg-purple-50 border-purple-300 ring-1 ring-purple-400 text-purple-950 shadow-2xs';
                        case 'chef de projet':
                          return 'bg-blue-50 border-blue-300 ring-1 ring-blue-400 text-blue-950 shadow-2xs';
                        case 'resource manager':
                          return 'bg-rose-50 border-rose-300 ring-1 ring-rose-400 text-rose-950 shadow-2xs';
                        case 'value management officer':
                          return 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400 text-emerald-950 shadow-2xs';
                      }
                    };

                    const getRoleIconColor = () => {
                      if (!isChecked) return 'text-slate-400';
                      switch (roleKey) {
                        case 'super user':
                          return 'text-amber-600';
                        case 'administrateur':
                          return 'text-purple-600';
                        case 'chef de projet':
                          return 'text-blue-600';
                        case 'resource manager':
                          return 'text-rose-600';
                        case 'value management officer':
                          return 'text-emerald-600';
                      }
                    };

                    const getCheckboxColor = () => {
                      if (!isChecked) return 'text-slate-400 border-slate-300';
                      switch (roleKey) {
                        case 'super user':
                          return 'text-amber-600 focus:ring-amber-500 border-amber-400';
                        case 'administrateur':
                          return 'text-purple-600 focus:ring-purple-500 border-purple-400';
                        case 'chef de projet':
                          return 'text-blue-600 focus:ring-blue-500 border-blue-400';
                        case 'resource manager':
                          return 'text-rose-600 focus:ring-rose-500 border-rose-400';
                        case 'value management officer':
                          return 'text-emerald-600 focus:ring-emerald-500 border-emerald-400';
                      }
                    };

                    return (
                      <div
                        key={roleKey}
                        onClick={() => handleToggleModalRole(roleKey)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 ${getCardStyle()}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // géré par le clic sur la carte parente
                          className={`w-4 h-4 mt-0.5 rounded cursor-pointer pointer-events-none ${getCheckboxColor()}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            {getRoleIcon(roleKey, `w-4 h-4 shrink-0 ${getRoleIconColor()}`)}
                            <span className="text-xs font-bold">{ROLE_LABELS[roleKey]}</span>
                          </div>
                          <p className={`text-[10px] leading-tight ${isChecked ? 'text-slate-600' : 'text-slate-400'}`}>
                            {ROLE_DESCRIPTIONS[roleKey]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Boîte à cocher : Envoyer une invitation par email via Gmail */}
              {!editingUser && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendEmailOnCreation}
                      onChange={(e) => setSendEmailOnCreation(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Envoyer un email d'invitation avec le lien d'activation depuis mon compte Google</span>
                      </span>
                      <p className="text-[11px] text-indigo-700/80 mt-0.5 leading-relaxed">
                        L'email sera expédié depuis <strong>{SUPER_ADMIN_EMAIL}</strong> via l'API Gmail avec les instructions d'activation et de définition du mot de passe.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || selectedRoles.length === 0}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : editingUser ? 'Mettre à jour' : 'Autoriser le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation de suppression */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Confirmer la révocation du compte
            </h3>
            <p className="text-xs text-slate-600 mb-6">
              Êtes-vous sûr de vouloir révoquer l’accès de{' '}
              <strong className="text-slate-900">{deleteCandidate.displayName}</strong> ({deleteCandidate.email}) ?
              L’utilisateur ne pourra plus accéder à l’application.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {saving ? 'Révocation...' : 'Révoquer l’accès'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
