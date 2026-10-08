import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  ShieldAlert,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Save,
  UserCheck,
  Crown,
} from 'lucide-react';
import { AppUser, UserRole, ROLE_LABELS } from '../types/user';
import { updateUser, SUPER_ADMIN_EMAIL } from '../services/userService';
import { getUserInitials } from '../utils/userUtils';

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
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeUser) {
      setDisplayName(activeUser.displayName || '');
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [activeUser, isOpen]);

  if (!isOpen || !activeUser) return null;

  const isNameChanged =
    displayName.trim() !== '' && displayName.trim() !== (activeUser.displayName || '').trim();

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMessage('Le nom ne peut pas être vide.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateUser(activeUser.id, { displayName: displayName.trim() });
      setSuccessMessage('Votre nom a été mis à jour avec succès.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la mise à jour de votre nom.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête avec pictogramme bonhomme */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
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

        {/* Corps */}
        <div className="p-6 space-y-5">
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

          {/* Champ 1 : Nom (Modifiable) */}
          <form onSubmit={handleSaveName} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Nom d'affichage <span className="text-indigo-600 font-normal">(Modifiable)</span>
              </label>
              {isNameChanged && (
                <span className="text-[11px] text-amber-600 font-medium">Modifications non enregistrées</span>
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
                placeholder="Votre nom complet"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!isNameChanged || saving}
                className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Vous pouvez modifier votre nom d'affichage à tout moment.
            </p>
          </form>

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
              Seul un administrateur ou un Super User peut modifier l'attribution de vos rôles.
            </p>
          </div>

          {/* Privilège exclusif Super User : se connecter à la place d'un autre utilisateur */}
          {isSuperUser && allUsers.length > 1 && onSwitchUser && (
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <label className="block text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>Se connecter à la place d'un utilisateur (Privilège Super User) :</span>
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
                    .map((r) => ROLE_LABELS[r])
                    .join(' & ');
                  return (
                    <option key={u.id} value={u.id}>
                      {u.displayName} — {u.email} ({rolesList})
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-400">
                Seul le Super User a le privilège d'usurper un autre compte utilisateur.
              </p>
            </div>
          )}
        </div>

        {/* Pied de page avec bouton de déconnexion */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="py-2 px-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5 text-red-600" />
            <span>Se déconnecter</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
