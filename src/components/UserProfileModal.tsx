import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  ShieldAlert,
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
import { updateUser, SUPER_ADMIN_EMAIL } from '../services/userService';
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
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [activeUser, isOpen, currentLang]);

  if (!isOpen || !activeUser) return null;

  const isNameChanged =
    displayName.trim() !== '' && displayName.trim() !== (activeUser.displayName || '').trim();
  const userSavedLang = ((activeUser.preferredLanguage as SupportedLanguage) || currentLang) as SupportedLanguage;
  const isLangChanged = selectedLang !== userSavedLang || selectedLang !== currentLang;
  const isModified = isNameChanged || isLangChanged;

  const handleCancel = () => {
    if (activeUser) {
      setDisplayName(activeUser.displayName || '');
      const userLang = ((activeUser.preferredLanguage as SupportedLanguage) || currentLang) as SupportedLanguage;
      setSelectedLang(userLang);
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMessage(t('profile.empty_name_error', 'Le nom ne peut pas être vide.'));
      return;
    }

    if (!isModified) {
      onClose();
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateUser(activeUser.id, {
        displayName: displayName.trim(),
        preferredLanguage: selectedLang,
      });

      // Le changement de langue ne prend effet qu'après enregistrement effectif
      if (selectedLang !== currentLang) {
        changeAppLanguage(selectedLang);
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

            {/* Champ 3 : Rôles associés (Non modifiables par l'utilisateur) */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Rôles associés
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  <ShieldAlert className="w-3 h-3 text-purple-600" />
                  <span>Géré par l'administrateur</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {effectiveRoles && effectiveRoles.length > 0 ? (
                  effectiveRoles.map((r) => <React.Fragment key={r}>{getRoleBadge(r)}</React.Fragment>)
                ) : (
                  <span className="text-xs text-slate-400">Aucun rôle spécifique</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {t('profile.roles_managed_by_admin')}
              </p>
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
                disabled={saving || !displayName.trim()}
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
