import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Send,
  UserCheck,
  Crown,
} from 'lucide-react';
import { validatePassword, hashPassword } from '../utils/passwordSecurity';
import { AppUser, ROLE_LABELS } from '../types/user';
import {
  requestPasswordResetLink,
  resendAccountActivationEmail,
  setUserNewPassword,
  SUPER_ADMIN_EMAIL,
} from '../services/userService';

interface LoginModalProps {
  isOpen: boolean;
  allUsers: AppUser[];
  onLoginSuccess: (user: AppUser) => void;
  onEnterConceptionMode: () => void;
  onImpersonateDirectly?: (targetUser: AppUser) => void;
}

type AuthView = 'login' | 'forgot_password' | 'force_new_password' | 'activate_account' | 'token_entry';

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  allUsers,
  onLoginSuccess,
  onEnterConceptionMode,
  onImpersonateDirectly,
}) => {
  const [view, setView] = useState<AuthView>('login');

  // État formulaire login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showActivationLinkForPending, setShowActivationLinkForPending] = useState(false);

  // État pour réinitialisation / activation / nouveau mot de passe / code direct
  const [tokenInput, setTokenInput] = useState('');
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [simulatedResetLink, setSimulatedResetLink] = useState<string | null>(null);

  if (!isOpen) return null;

  // Validation dynamique en temps réel du nouveau mot de passe (règle des 20 caractères)
  const validation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmitNewPassword = validation.isValid && passwordsMatch;

  // Détection automatique des paramètres d'activation ou réinitialisation par email
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const paramEmail = params.get('email');
    const token = params.get('token');
    if (token) {
      setTokenInput(token);
    }
    if (paramEmail) {
      const clean = paramEmail.trim().toLowerCase();
      setEmail(clean);
      const matched = allUsers.find((u) => u.email.toLowerCase() === clean);
      if (matched) {
        setPendingUser(matched);
        if (action === 'activate') {
          setView('activate_account');
        } else if (action === 'reset_password') {
          setView('force_new_password');
        }
      }
    }
  }, [allUsers]);

  // Soumission de la connexion
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setShowActivationLinkForPending(false);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const user = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      setLoginError("Aucun compte n'est autorisé avec cette adresse email. Contactez l'administrateur.");
      setLoading(false);
      return;
    }

    // Cas du Super User en mode direct
    if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      onEnterConceptionMode();
      setLoading(false);
      return;
    }

    // RÈGLE CRITIQUE : UN UTILISATEUR NON ACTIF NE PEUT PAS SE CONNECTER !
    if (user.isActive === false) {
      setPendingUser(user);
      setShowActivationLinkForPending(true);
      setLoginError(
        "Ce compte n'est pas encore actif. Tant que vous n'avez pas activé votre compte via le lien reçu par email pour définir votre mot de passe, vous ne pouvez pas vous connecter."
      );
      setLoading(false);
      return;
    }

    // Cas où le mot de passe a été effacé/réinitialisé par un administrateur
    if (user.mustResetPassword || !user.passwordHash) {
      setPendingUser(user);
      setView('force_new_password');
      setLoading(false);
      return;
    }

    // Vérification du mot de passe saisi
    try {
      const attemptHash = await hashPassword(password, cleanEmail);
      if (attemptHash !== user.passwordHash) {
        setLoginError('Email ou mot de passe incorrect.');
        setLoading(false);
        return;
      }

      // Connexion réussie
      onLoginSuccess(user);
    } catch (err: any) {
      setLoginError(err?.message || 'Erreur lors de la vérification des identifiants.');
    } finally {
      setLoading(false);
    }
  };

  // Demande de réinitialisation de mot de passe par email
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    setResetSuccessMessage(null);
    setSimulatedResetLink(null);

    const cleanEmail = email.trim().toLowerCase();
    try {
      const { user, resetToken } = await requestPasswordResetLink(cleanEmail);
      setPendingUser(user);
      setResetSuccessMessage(
        `Un email contenant le lien sécurisé de réinitialisation a été envoyé à ${cleanEmail}.`
      );
      setSimulatedResetLink(resetToken);
    } catch (err: any) {
      setLoginError(err?.message || "Impossible d'envoyer l'email de réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  // Renvoi d'un email d'activation pour un utilisateur inactif
  const handleResendActivation = async () => {
    if (!pendingUser) return;
    setLoading(true);
    try {
      await resendAccountActivationEmail(pendingUser.id, pendingUser.email);
      setResetSuccessMessage(
        `Un nouvel email d'activation a été envoyé à ${pendingUser.email}.`
      );
      setLoginError(null);
    } catch (err: any) {
      setLoginError(err?.message || "Erreur lors de l'envoi de l'email d'activation.");
    } finally {
      setLoading(false);
    }
  };

  // Validation du code de sécurité saisi manuellement (reçu par email)
  const handleValidateToken = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const cleanToken = tokenInput.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanToken) {
      setLoginError('Veuillez renseigner le code de sécurité reçu par email.');
      return;
    }

    // Recherche par email si fourni, ou directement par token
    let matchedUser = cleanEmail
      ? allUsers.find((u) => u.email.toLowerCase() === cleanEmail)
      : undefined;

    if (matchedUser) {
      if (matchedUser.activationToken !== cleanToken && matchedUser.resetToken !== cleanToken) {
        const userByToken = allUsers.find(
          (u) => u.activationToken === cleanToken || u.resetToken === cleanToken
        );
        if (userByToken) {
          matchedUser = userByToken;
        } else {
          setLoginError("Ce code de sécurité n'est pas valide pour cette adresse email.");
          return;
        }
      }
    } else {
      matchedUser = allUsers.find(
        (u) => u.activationToken === cleanToken || u.resetToken === cleanToken
      );
    }

    if (!matchedUser) {
      setLoginError('Code de sécurité invalide ou expiré. Veuillez vérifier votre saisie.');
      return;
    }

    setPendingUser(matchedUser);
    setEmail(matchedUser.email);
    setView('force_new_password');
    setResetSuccessMessage(
      `Code validé avec succès pour « ${matchedUser.displayName} ». Définissez maintenant votre mot de passe.`
    );
  };

  // Définition du mot de passe (soit pour activation d'un nouveau compte, soit après réinitialisation)
  const handleSetNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;
    if (!canSubmitNewPassword) {
      setLoginError('Veuillez remplir tous les critères de sécurité du mot de passe.');
      return;
    }

    setLoginError(null);
    setLoading(true);

    try {
      await setUserNewPassword(pendingUser.id, pendingUser.email, newPassword);
      // Compte activé et mot de passe défini : connexion automatique
      const updatedUser: AppUser = {
        ...pendingUser,
        isActive: true,
        mustResetPassword: false,
      };
      onLoginSuccess(updatedUser);
    } catch (err: any) {
      setLoginError(err?.message || "Erreur lors de l'enregistrement du mot de passe.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white text-center relative">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
            {view === 'activate_account' ? (
              <UserCheck className="w-6 h-6 text-emerald-400" />
            ) : view === 'token_entry' ? (
              <KeyRound className="w-6 h-6 text-amber-400" />
            ) : (
              <Lock className="w-6 h-6 text-indigo-300" />
            )}
          </div>
          <h2 className="text-lg font-bold">
            {view === 'login' && 'Authentification Requise'}
            {view === 'forgot_password' && 'Réinitialiser le mot de passe'}
            {view === 'force_new_password' && 'Nouveau mot de passe obligatoire'}
            {view === 'activate_account' && 'Activation de votre compte'}
            {view === 'token_entry' && 'Saisir un code de sécurité'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {view === 'login' && 'Indiquez votre email et votre mot de passe pour accéder à la plateforme.'}
            {view === 'forgot_password' && 'Recevez un lien par email pour réinitialiser votre accès.'}
            {view === 'force_new_password' && 'Définissez votre nouveau mot de passe de 20 caractères minimum.'}
            {view === 'activate_account' && 'Définissez votre mot de passe pour activer votre compte.'}
            {view === 'token_entry' && 'Renseignez votre email et le code reçu pour débloquer votre accès.'}
          </p>
        </div>

        {/* Corps */}
        <div className="p-6">
          {loginError && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2 text-red-700 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="leading-relaxed">{loginError}</span>
              </div>
              {showActivationLinkForPending && pendingUser && (
                <div className="mt-2 pt-2 border-t border-red-200 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView('activate_account');
                      setLoginError(null);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Activer mon compte &amp; Définir le mot de passe</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResendActivation}
                    className="px-2.5 py-1.5 text-slate-700 hover:text-indigo-600 hover:bg-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Renvoyer l'email
                  </button>
                </div>
              )}
            </div>
          )}

          {resetSuccessMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>{resetSuccessMessage}</span>
            </div>
          )}

          {/* VUE 1 : MIRE DE CONNEXION PRINCIPALE */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Adresse email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@entreprise.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot_password');
                      setLoginError(null);
                      setShowActivationLinkForPending(false);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Vérification...' : 'Se connecter'}
              </button>

              {/* Raccourci pour activation de compte si le nouvel utilisateur vient de recevoir son invitation */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setView('token_entry');
                    setLoginError(null);
                  }}
                  className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span>J'ai un code d'activation ou de réinitialisation</span>
                </button>
              </div>

              {/* Raccourci et privilège exclusif Super User */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-600" />
                    <span>Privilège Super User :</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <button
                    type="button"
                    onClick={onEnterConceptionMode}
                    className="flex-1 py-2 px-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Accéder directement en tant que Stéphane Labati (Super User)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Accès direct Super User</span>
                  </button>

                  {allUsers.length > 0 && onImpersonateDirectly && (
                    <div className="flex-1 relative">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const target = allUsers.find((u) => u.id === e.target.value);
                          if (target) {
                            onImpersonateDirectly(target);
                          }
                        }}
                        className="w-full py-2 px-2.5 bg-amber-50/80 hover:bg-amber-100 border border-amber-300 text-amber-950 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                        title="Se connecter directement à la place de n'importe quel autre utilisateur"
                      >
                        <option value="" disabled>
                          Se connecter à la place de...
                        </option>
                        {allUsers.map((u) => {
                          const rolesList = (u.roles && u.roles.length > 0 ? u.roles : [u.role || 'chef de projet'])
                            .map((r) => ROLE_LABELS[r])
                            .join(' & ');
                          return (
                            <option key={u.id} value={u.id}>
                              {u.displayName} ({rolesList})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Privilège réservé au Super User. Les autres profils doivent s'authentifier avec leur email et mot de passe.
                </p>
              </div>
            </form>
          )}

          {/* VUE 2 : MOT DE PASSE OUBLIÉ */}
          {view === 'forgot_password' && (
            <div className="space-y-4">
              {resetSuccessMessage ? (
                <div className="space-y-4">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">Lien de réinitialisation envoyé</p>
                      <p className="mt-0.5">{resetSuccessMessage}</p>
                    </div>
                  </div>

                  {simulatedResetLink && (
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                      <p className="text-[11px] text-indigo-900 font-semibold flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Lien de réinitialisation direct (environnement de test) :</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setView('force_new_password');
                          setLoginError(null);
                        }}
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Ouvrir la page de réinitialisation sécurisée</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setView('login');
                      setResetSuccessMessage(null);
                    }}
                    className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Retour à la mire de connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <p className="text-xs text-slate-600">
                    Saisissez l'adresse email associée à votre compte. Vous recevrez un lien sécurisé par mail vous autorisant à réinitialiser votre mot de passe.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Adresse email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="prenom.nom@entreprise.com"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setView('login');
                        setLoginError(null);
                      }}
                      className="w-1/3 py-2.5 px-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Retour</span>
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-2/3 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{loading ? 'Envoi...' : 'Envoyer le lien'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* VUE : SAISIE DIRECTE DU CODE DE SÉCURITÉ / JETON */}
          {view === 'token_entry' && (
            <form onSubmit={handleValidateToken} className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950">
                <p className="font-semibold flex items-center gap-1.5 mb-1">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  <span>Validation du code de sécurité</span>
                </p>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  Renseignez votre adresse email et le code de sécurité reçu par email (ex : <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono">rst_...</code> ou <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono">act_...</code>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Adresse email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@entreprise.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Code de sécurité / Jeton reçu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Collez ici votre code (rst_... ou act_...)"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setLoginError(null);
                  }}
                  className="w-1/3 py-2.5 px-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour</span>
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Valider mon code</span>
                </button>
              </div>
            </form>
          )}

          {/* VUE 3 : ACTIVATION DU COMPTE (NOUVEL UTILISATEUR) OU RÉINITIALISATION */}
          {(view === 'activate_account' || view === 'force_new_password') && (
            <form onSubmit={handleSetNewPasswordSubmit} className="space-y-4">
              <div
                className={`p-3.5 rounded-xl text-xs ${
                  view === 'activate_account'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border border-amber-200 text-amber-900'
                }`}
              >
                {view === 'activate_account' ? (
                  <div>
                    <strong className="block mb-1 font-bold flex items-center gap-1">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span>Activation de votre compte</span>
                    </strong>
                    <span>
                      Définissez votre mot de passe pour activer définitivement votre compte. Une fois enregistré, votre compte deviendra actif et vous pourrez accéder à l'application.
                    </span>
                  </div>
                ) : (
                  <div>
                    <strong className="block mb-1 font-bold">Nouveau mot de passe requis :</strong>
                    <span>
                      Votre mot de passe a été réinitialisé par un administrateur. Vous devez définir un nouveau mot de passe sécurisé pour vous connecter.
                    </span>
                  </div>
                )}
              </div>

              {/* Sélection / confirmation de l'email si non encore identifié */}
              {!pendingUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Adresse email de votre compte <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        const match = allUsers.find(
                          (u) => u.email.toLowerCase() === e.target.value.trim().toLowerCase()
                        );
                        if (match) setPendingUser(match);
                      }}
                      placeholder="votre.email@entreprise.com"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {pendingUser && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between">
                  <span>
                    Compte : <strong>{pendingUser.displayName}</strong> ({pendingUser.email})
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingUser(null)}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    Changer
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  {view === 'activate_account' ? 'Définir votre mot de passe' : 'Nouveau mot de passe'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 20 caractères avec maj, min, chiffre et symbole"
                    className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirmer le mot de passe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ressaisissez le mot de passe à l'identique"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Checklist en temps réel des 5 critères obligatoires de sécurité */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Critères de sécurité obligatoires :
                </p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-center gap-2">
                    {validation.rules.minLength ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={
                        validation.rules.minLength
                          ? 'text-emerald-700 font-medium'
                          : 'text-slate-500'
                      }
                    >
                      Au moins <strong>20 caractères</strong> ({newPassword.length}/20)
                    </span>
                  </li>

                  <li className="flex items-center gap-2">
                    {validation.rules.hasLowercase ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={
                        validation.rules.hasLowercase
                          ? 'text-emerald-700 font-medium'
                          : 'text-slate-500'
                      }
                    >
                      Au moins une lettre <strong>minuscule</strong> (a-z)
                    </span>
                  </li>

                  <li className="flex items-center gap-2">
                    {validation.rules.hasUppercase ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={
                        validation.rules.hasUppercase
                          ? 'text-emerald-700 font-medium'
                          : 'text-slate-500'
                      }
                    >
                      Au moins une lettre <strong>majuscule</strong> (A-Z)
                    </span>
                  </li>

                  <li className="flex items-center gap-2">
                    {validation.rules.hasNumber ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={
                        validation.rules.hasNumber
                          ? 'text-emerald-700 font-medium'
                          : 'text-slate-500'
                      }
                    >
                      Au moins un <strong>chiffre</strong> (0-9)
                    </span>
                  </li>

                  <li className="flex items-center gap-2">
                    {validation.rules.hasSpecialChar ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={
                        validation.rules.hasSpecialChar
                          ? 'text-emerald-700 font-medium'
                          : 'text-slate-500'
                      }
                    >
                      Au moins un <strong>caractère spécial</strong> (!, @, #, $, %, etc.)
                    </span>
                  </li>

                  <li className="flex items-center gap-2">
                    {passwordsMatch ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={
                        passwordsMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }
                    >
                      Confirmation identique
                    </span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setLoginError(null);
                  }}
                  className="w-1/3 py-2.5 px-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Connexion</span>
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitNewPassword || loading || !pendingUser}
                  className="w-2/3 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? 'Activation...'
                    : view === 'activate_account'
                    ? 'Activer le compte et se connecter'
                    : 'Enregistrer et se connecter'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
