import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Check,
  Save,
  UserCheck,
  Crown,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, changeAppLanguage, SupportedLanguage } from '../i18n';
import { AppUser, UserRole, ROLE_LABELS, getRoleLabel } from '../types/user';
import {
  updateUser,
  setUserNewPassword,
  requestPasswordResetLink,
  SUPER_ADMIN_EMAIL,
} from '../services/userService';
import { sendPasswordResetNotification } from '../services/emailService';
import { validatePassword, hashPassword } from '../utils/passwordSecurity';
import { getUserInitials } from '../utils/userUtils';
import { LanguageFlag } from './Flags';

export const UserAvatarPictogram: React.FC<{
  className?: string;
  headClassName?: string;
  bodyClassName?: string;
}> = ({
  className = 'w-6 h-6',
  headClassName = 'fill-current',
  bodyClassName = 'fill-current',
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Pictogramme utilisateur"
  >
    {/* Un rond pour la tête */}
    <circle cx="16" cy="10" r="5" className={headClassName} />
    {/* Un demi rectangle vertical à bord arrondi */}
    <rect x="8" y="18" width="16" height="11" rx="5.5" className={bodyClassName} />
  </svg>
);

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: AppUser | null;
  effectiveRoles: UserRole[];
  getRoleBadge: (role: UserRole) => React.ReactNode;
  onLogout: () => void;
  allUsers?: AppUser[];
  onSwitchUser?: (u: AppUser) => void;
  isSuperUser?: boolean;
  assumedRole?: UserRole | null;
  isImpersonating?: boolean;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  activeUser,
  effectiveRoles,
  getRoleBadge,
  onLogout,
  allUsers = [],
  onSwitchUser,
  isSuperUser = false,
  assumedRole = null,
  isImpersonating = false,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = ((i18n.language || 'fr').slice(0, 2)) as SupportedLanguage;
  const [displayName, setDisplayName] = useState('');
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(currentLang);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Nouveaux états pour la modification du mot de passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // État de l'envoi de l'email de réinitialisation
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeUser) {
      setDisplayName(activeUser.displayName || '');
      const userLang = ((activeUser.preferredLanguage as SupportedLanguage) || currentLang) as SupportedLanguage;
      setSelectedLang(userLang);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setSendingResetEmail(false);
      setResetEmailSent(false);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [activeUser, isOpen, currentLang]);

  if (!isOpen || !activeUser) return null;

  // Récupérer les informations à jour de l'utilisateur (incluant son passwordHash)
  const userInList = allUsers.find(
    (u) => u.id === activeUser.id || u.email.toLowerCase() === activeUser.email.toLowerCase()
  );
  const userTarget = userInList || activeUser;
  const hasExistingPassword = Boolean(userTarget.passwordHash);

  const isNameChanged =
    displayName.trim() !== '' && displayName.trim() !== (activeUser.displayName || '').trim();
  const userSavedLang = ((activeUser.preferredLanguage as SupportedLanguage) || currentLang) as SupportedLanguage;
  const isLangChanged = selectedLang !== userSavedLang || selectedLang !== currentLang;
  const isPasswordEntered = newPassword.length > 0 || confirmPassword.length > 0;
  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isCurrentPasswordFilled = currentPassword.length > 0;

  const isPasswordValid =
    !isPasswordEntered ||
    ((!hasExistingPassword || isCurrentPasswordFilled) &&
      passwordValidation.isValid &&
      passwordsMatch);

  const isModified = isNameChanged || isLangChanged || isPasswordEntered;
  const canSave = displayName.trim() !== '' && isModified && isPasswordValid;

  const handleCancel = () => {
    if (activeUser) {
      setDisplayName(activeUser.displayName || '');
      const userLang = ((activeUser.preferredLanguage as SupportedLanguage) || currentLang) as SupportedLanguage;
      setSelectedLang(userLang);
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setSendingResetEmail(false);
    setResetEmailSent(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSendResetEmail = async () => {
    if (!activeUser?.email) return;
    setSendingResetEmail(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { resetToken } = await requestPasswordResetLink(activeUser.email);
      const targetLang = (selectedLang || activeUser.preferredLanguage || currentLang || 'fr') as
        | 'fr'
        | 'en'
        | 'it'
        | 'de';

      const sendResult = await sendPasswordResetNotification({
        toEmail: activeUser.email,
        displayName: activeUser.displayName,
        resetToken,
        language: targetLang,
        requestedBySelf: true,
      });

      if (sendResult.success) {
        setResetEmailSent(true);
        setSuccessMessage(
          t(
            'profile.password_section.reset_email_sent',
            'Un email contenant le lien de réinitialisation vous a été envoyé.'
          )
        );
      } else {
        setErrorMessage(
          sendResult.error ||
            t(
              'profile.password_section.reset_email_error',
              "Impossible d'envoyer l'email de réinitialisation. Veuillez vérifier la configuration de messagerie."
            )
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          t(
            'profile.password_section.reset_email_error',
            "Impossible d'envoyer l'email de réinitialisation. Veuillez vérifier la configuration de messagerie."
          )
      );
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMessage(t('profile.empty_name_error', 'Le nom ne peut pas être vide.'));
      return;
    }

    if (isPasswordEntered) {
      // 1. Si un mot de passe existe déjà pour cet utilisateur, vérifier l'ancien mot de passe
      if (hasExistingPassword) {
        if (!currentPassword) {
          setErrorMessage(
            t(
              'profile.password_section.current_password_required',
              "Veuillez renseigner votre ancien mot de passe avant d'en définir un nouveau."
            )
          );
          return;
        }

        const attemptHash = await hashPassword(currentPassword, activeUser.email);
        if (attemptHash !== userTarget.passwordHash) {
          setErrorMessage(
            t(
              'profile.password_section.current_password_error',
              "L'ancien mot de passe saisi est incorrect."
            )
          );
          return;
        }
      }

      // 2. Vérifier les critères de sécurité du nouveau mot de passe
      if (!passwordValidation.isValid) {
        setErrorMessage(
          passwordValidation.errors[0] ||
            t('profile.password_section.error_invalid', 'Le mot de passe ne respecte pas les critères de sécurité.')
        );
        return;
      }
      if (!passwordsMatch) {
        setErrorMessage(
          t('profile.password_section.passwords_mismatch', 'Les deux mots de passe ne sont pas identiques.')
        );
        return;
      }
    }

    if (!isModified) {
      onClose();
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isNameChanged || isLangChanged) {
        await updateUser(activeUser.id, {
          displayName: displayName.trim(),
          preferredLanguage: selectedLang,
        });

        // Le changement de langue ne prend effet qu'après enregistrement effectif
        if (selectedLang !== currentLang) {
          changeAppLanguage(selectedLang);
        }
      }

      if (isPasswordEntered) {
        await setUserNewPassword(activeUser.id, activeUser.email, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || t('profile.save_error', 'Erreur lors de la mise à jour du profil.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête avec pictogramme bonhomme (toujours visible) */}
        <div className="bg-slate-900 text-white p-6 relative shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={t('modals.common.close', 'Fermer')}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                isSuperUser && !assumedRole && !isImpersonating
                  ? 'bg-amber-400 border-2 border-amber-500 text-amber-950 font-bold'
                  : activeUser
                  ? 'bg-pink-500 border-2 border-pink-400 text-white font-bold text-lg'
                  : 'bg-indigo-500/20 border border-indigo-400/30 text-indigo-300'
              }`}
            >
              {isSuperUser && !assumedRole && !isImpersonating ? (
                <Crown className="w-8 h-8 text-amber-950 fill-amber-300" />
              ) : activeUser ? (
                <span>{getUserInitials(activeUser.displayName, activeUser.email)}</span>
              ) : (
                <UserAvatarPictogram className="w-8 h-8 text-indigo-300" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{activeUser.displayName}</span>
              </h2>
              <p className="text-xs text-slate-300 font-mono mt-0.5">{activeUser.email}</p>
            </div>
          </div>
        </div>

        {/* Formulaire complet reliant les champs et le bandeau d'actions fixe en bas */}
        <form onSubmit={handleSaveProfile} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Corps défilable avec ascenseur vertical */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5 [scrollbar-width:thin]">
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Champ 1 : Nom et Langue d'interface (Modifiables et enregistrés ensemble) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('profile.display_name', "Nom d'affichage")}{' '}
                  <span className="text-indigo-600 font-normal">
                    ({t('profile.modifiable', 'Modifiable')})
                  </span>
                </label>
                {isModified && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    {t('profile.unsaved_changes', 'Modifications non enregistrées')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  placeholder={t('profile.display_name_placeholder', 'Votre nom complet')}
                  className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {/* Menu déroulant avec drapeaux SVG */}
                <div className="relative shrink-0" ref={langDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setLangDropdownOpen((prev) => !prev)}
                    className="h-[38px] px-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs transition-colors"
                    title={SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label || "Langue de l'interface"}
                    aria-label="Sélectionner la langue"
                  >
                    <LanguageFlag code={selectedLang} className="w-5 h-3.5" />
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                        langDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {langDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[150px] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
                      {SUPPORTED_LANGUAGES.map((lang) => {
                        const isCurrentSelected = selectedLang === lang.code;
                        return (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => {
                              setSelectedLang(lang.code);
                              setLangDropdownOpen(false);
                              setSuccessMessage(null);
                              setErrorMessage(null);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-xs font-semibold cursor-pointer transition-colors ${
                              isCurrentSelected
                                ? 'bg-indigo-50 text-indigo-700 font-bold'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <LanguageFlag code={lang.code} className="w-5 h-3.5" />
                            <span>{lang.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {t('profile.save_hint', "Vous pouvez modifier votre nom d'affichage et votre langue d'interface.")}
              </p>
            </div>

            {/* Champ 2 : Email (Identifiant unique - Non modifiable) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Adresse Email <span className="text-slate-400 font-normal">(Identifiant unique)</span>
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Non modifiable</span>
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="email"
                  disabled
                  value={activeUser.email}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg text-sm font-mono cursor-not-allowed select-all"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                L'adresse email constitue votre identifiant unique sur la plateforme et ne peut être modifiée.
              </p>
            </div>

            {/* Champ 3 : Modifier le mot de passe (Ancien mot de passe + 2 champs nouveau mot de passe + Réinitialiser) */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t('profile.password_section.title', 'Modifier le mot de passe')}</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t(
                    'profile.password_section.subtitle',
                    'Laissez ces champs vides si vous ne souhaitez pas changer votre mot de passe.'
                  )}
                </p>
              </div>

              {/* Grille 2 colonnes parfaitement alignée :
                  - Colonne gauche : Ancien mot de passe (ligne 1) puis Nouveau mot de passe (ligne 2)
                  - Colonne droite : Bouton Réinitialiser (ligne 1) puis Confirmer le nouveau mot de passe (ligne 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Ancien mot de passe (gauche, même dimension que nouveau mot de passe) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('profile.password_section.current_password', 'Ancien mot de passe')}
                    {hasExistingPassword && isPasswordEntered && (
                      <span className="text-red-500 ml-1 font-semibold">*</span>
                    )}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder={t(
                        'profile.password_section.current_password_placeholder',
                        'Saisissez votre ancien mot de passe...'
                      )}
                      className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                      aria-label={showCurrentPassword ? 'Masquer' : 'Afficher'}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 2. Bloc Réinitialisation (aligné par la droite avec la zone de saisie en dessous) */}
                <div className="flex flex-col justify-end">
                  <span
                    className="block text-xs font-medium text-transparent mb-1 hidden sm:block select-none"
                    aria-hidden="true"
                  >
                    &nbsp;
                  </span>
                  <div className="flex items-center justify-end gap-2.5 min-h-[38px]">
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {t('profile.password_section.forgot_password_question', 'Mot de passe oublié ?')}
                    </span>
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      disabled={sendingResetEmail}
                      className="h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
                      title={t(
                        'profile.password_section.reset_btn_tooltip',
                        "M'envoyer un email de réinitialisation de mon mot de passe."
                      )}
                    >
                      {sendingResetEmail ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          <span>{t('profile.password_section.sending_reset', 'Envoi en cours...')}</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{t('profile.password_section.reset_btn', 'Réinitialiser')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 3. Nouveau mot de passe (gauche) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('profile.password_section.new_password', 'Nouveau mot de passe')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder={t('profile.password_section.placeholder', 'Au moins 20 caractères...')}
                      className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                      aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 4. Confirmer le nouveau mot de passe (droite, 2e occurrence) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('profile.password_section.confirm_password', 'Confirmer le nouveau mot de passe')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder={t('profile.password_section.confirm_placeholder', 'Retapez votre mot de passe...')}
                      className={`w-full pl-9 pr-10 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                        confirmPassword.length > 0
                          ? passwordsMatch
                            ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/20'
                            : 'border-red-300 focus:ring-red-500 bg-red-50/20'
                          : 'border-slate-300 focus:ring-indigo-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Panneau de validation et indicateurs lors de la saisie */}
              {isPasswordEntered && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between font-semibold flex-wrap gap-2">
                    <span className="text-slate-700">
                      {t('profile.password_section.rules_title', 'Critères de sécurité (obligatoires) :')}
                    </span>
                    {confirmPassword.length > 0 && (
                      <span className={`inline-flex items-center gap-1 font-bold ${passwordsMatch ? 'text-emerald-700' : 'text-red-600'}`}>
                        {passwordsMatch ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t('profile.password_section.passwords_match', 'Les mots de passe correspondent')}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            <span>{t('profile.password_section.passwords_mismatch', 'Les deux mots de passe ne sont pas identiques')}</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${passwordValidation.rules.minLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${passwordValidation.rules.minLength ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
                        {passwordValidation.rules.minLength ? '✓' : '•'}
                      </span>
                      <span>{t('profile.password_section.rule_min_length', '20 caractères minimum')} ({newPassword.length}/20)</span>
                    </div>

                    <div className={`flex items-center gap-1.5 ${passwordValidation.rules.hasLowercase ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${passwordValidation.rules.hasLowercase ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
                        {passwordValidation.rules.hasLowercase ? '✓' : '•'}
                      </span>
                      <span>{t('profile.password_section.rule_lowercase', 'Au moins 1 minuscule (a-z)')}</span>
                    </div>

                    <div className={`flex items-center gap-1.5 ${passwordValidation.rules.hasUppercase ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${passwordValidation.rules.hasUppercase ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
                        {passwordValidation.rules.hasUppercase ? '✓' : '•'}
                      </span>
                      <span>{t('profile.password_section.rule_uppercase', 'Au moins 1 majuscule (A-Z)')}</span>
                    </div>

                    <div className={`flex items-center gap-1.5 ${passwordValidation.rules.hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${passwordValidation.rules.hasNumber ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
                        {passwordValidation.rules.hasNumber ? '✓' : '•'}
                      </span>
                      <span>{t('profile.password_section.rule_number', 'Au moins 1 chiffre (0-9)')}</span>
                    </div>

                    <div className={`flex items-center gap-1.5 ${passwordValidation.rules.hasSpecialChar ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${passwordValidation.rules.hasSpecialChar ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
                        {passwordValidation.rules.hasSpecialChar ? '✓' : '•'}
                      </span>
                      <span>{t('profile.password_section.rule_special', 'Au moins 1 caractère spécial')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Champ 4 : Rôles associés (Non modifiables par l'utilisateur) */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('profile.roles_title', 'Rôles associés')}{' '}
                  <span className="text-slate-400 font-normal normal-case">
                    ({t('profile.roles_managed_by_admin', "Géré par l'administrateur")})
                  </span>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {effectiveRoles && effectiveRoles.length > 0 ? (
                  effectiveRoles.map((r) => <React.Fragment key={r}>{getRoleBadge(r)}</React.Fragment>)
                ) : (
                  <span className="text-xs text-slate-400">
                    {t('profile.no_role', 'Aucun rôle spécifique')}
                  </span>
                )}
              </div>
            </div>

            {/* Privilège exclusif Super User : se connecter à la place d'un autre utilisateur */}
            {isSuperUser && allUsers.length > 1 && onSwitchUser && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <label className="block text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('profile.impersonate_title')}</span>
                </label>
                <select
                  value={activeUser.id}
                  onChange={(e) => {
                    const target = allUsers.find((u) => u.id === e.target.value);
                    if (target) {
                      onSwitchUser(target);
                      onClose();
                    }
                  }}
                  className="w-full text-xs font-semibold bg-amber-50/70 border border-amber-300 rounded-lg px-2.5 py-1.5 text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {allUsers.map((u) => {
                    const rolesList = (u.roles && u.roles.length > 0 ? u.roles : [u.role || 'chef de projet'])
                      .map((r) => getRoleLabel(r, t))
                      .join(' & ');
                    return (
                      <option key={u.id} value={u.id}>
                        {u.displayName} — {u.email} ({rolesList})
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-400">
                  {t('profile.impersonate_desc')}
                </p>
              </div>
            )}
          </div>

          {/* Pied de page fixe : Déconnexion à gauche, Annuler et Enregistrer les modifications à droite */}
          <div className="shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="py-2 px-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span>{t('common.actions.logout')}</span>
            </button>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {t('modals.common.cancel', 'Annuler')}
              </button>

              <button
                type="submit"
                disabled={saving || !displayName.trim() || !canSave}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {saving
                    ? t('modals.common.saving', 'Enregistrement...')
                    : t('modals.common.save_changes', 'Enregistrer les modifications')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
