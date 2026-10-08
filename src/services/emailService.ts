import { auth, googleProvider, signInWithPopup, getCachedGoogleAccessToken, setCachedGoogleAccessToken } from '../lib/firebase';
import { GoogleAuthProvider } from 'firebase/auth';
import { SUPER_ADMIN_EMAIL } from './userService';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Encode une chaîne pour les en-têtes MIME RFC 2047 (From, To, Subject)
 * Permet d'éviter tout problème de mojibake (ex : "é" transformé en "ÃƒÂ©")
 */
function encodeMimeHeader(str: string): string {
  if (!str) return '';
  // Si la chaîne ne contient que des caractères ASCII imprimables simples, pas besoin d'encodage
  if (/^[\x20-\x7E]*$/.test(str)) {
    return str;
  }
  // Encodage en UTF-8 puis Base64 conforme RFC 2047
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

/**
 * Construit un message MIME RFC 2822 strictement conforme et 100% 7-bit ASCII
 */
function buildMimeMessage(options: {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
}): string {
  const fromHeader = `${encodeMimeHeader(options.fromName)} <${options.fromEmail}>`;
  const toHeader = `${encodeMimeHeader(options.toName)} <${options.toEmail}>`;
  const subjectHeader = encodeMimeHeader(options.subject);

  // Encodage du corps HTML en Base64 pour garantir une transmission sans altération des accents
  const utf8Bytes = new TextEncoder().encode(options.htmlContent);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64Body = btoa(binary);
  // Découpage en blocs de 76 caractères par ligne conformément au standard MIME RFC 2045
  const formattedBody = base64Body.match(/.{1,76}/g)?.join('\r\n') || base64Body;

  const lines = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${subjectHeader}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    formattedBody,
  ];

  return lines.join('\r\n');
}

/**
 * Encode le message MIME 7-bit en Base64URL sécurisé conforme au standard RFC 4648 pour l'API Gmail
 */
function base64UrlEncode(asciiStr: string): string {
  return btoa(asciiStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Demande ou renouvelle le jeton d'accès OAuth Google avec le scope Gmail
 */
export async function requestGoogleAccessToken(): Promise<string> {
  const cached = getCachedGoogleAccessToken();
  if (cached) return cached;

  googleProvider.setCustomParameters({
    prompt: 'consent',
    access_type: 'online',
    login_hint: SUPER_ADMIN_EMAIL,
  });

  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error("Impossible d'obtenir le jeton d'accès Google avec les autorisations Gmail requises.");
  }

  setCachedGoogleAccessToken(credential.accessToken);
  return credential.accessToken;
}

/**
 * Vérifie si le jeton d'accès Gmail est prêt et valide
 */
export async function isGmailAuthorized(): Promise<boolean> {
  const token = getCachedGoogleAccessToken();
  if (!token) return false;

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Envoie un email transactionnel via l'API Gmail v1
 */
export async function sendEmailViaGmail(options: {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
}): Promise<EmailSendResult> {
  let token = getCachedGoogleAccessToken();

  if (!token) {
    try {
      token = await requestGoogleAccessToken();
    } catch (err: any) {
      return {
        success: false,
        error: `Autorisation Google requise : ${err?.message || "Veuillez vous connecter avec votre compte Google."}`,
      };
    }
  }

  const mimeMessage = buildMimeMessage({
    fromEmail: SUPER_ADMIN_EMAIL,
    fromName: 'Stéphane Labati (OPAC)',
    toEmail: options.toEmail,
    toName: options.toName,
    subject: options.subject,
    htmlContent: options.htmlContent,
  });

  const raw = base64UrlEncode(mimeMessage);

  try {
    let res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    // Si le jeton a expiré (401), on tente un renouvellement
    if (res.status === 401) {
      setCachedGoogleAccessToken(null);
      token = await requestGoogleAccessToken();
      res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || `Erreur HTTP ${res.status}`;
      return {
        success: false,
        error: `Erreur d'envoi Gmail : ${errMsg}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      messageId: data.id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Erreur réseau lors de l'envoi de l'email : ${err?.message || 'Erreur inconnue'}`,
    };
  }
}

/**
 * Génère le modèle HTML et envoie l'email d'activation de compte
 */
export async function sendUserActivationNotification(options: {
  toEmail: string;
  displayName: string;
  rolesList: string;
  activationToken?: string;
  appUrl?: string;
}): Promise<EmailSendResult> {
  const currentOrigin = options.appUrl || window.location.origin;
  const activationUrl = `${currentOrigin}?action=activate&email=${encodeURIComponent(options.toEmail)}&token=${options.activationToken || ''}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bienvenue sur OPAC</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 36px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">
                OPAC <span style="font-size: 13px; font-weight: 500; color: #94a3b8; margin-left: 8px;">Pilotage du portefeuille de projets</span>
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px;">
              <h2 style="margin: 0 0 16px; color: #0f172a; font-size: 18px; font-weight: 700;">
                Bonjour ${options.displayName},
              </h2>
              <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">
                Votre compte utilisateur a été créé sur la plateforme <strong>OPAC</strong> par <strong>Stéphane Labati</strong>.
              </p>
              
              <div style="background-color: #f1f5f9; border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Vos identifiants d'accès :</p>
                <p style="margin: 0; font-size: 14px; color: #0f172a;"><strong>Email :</strong> <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${options.toEmail}</code></p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #0f172a;"><strong>Rôles attribués :</strong> ${options.rolesList}</p>
              </div>

              <p style="margin: 0 0 20px; font-size: 14px; color: #475569;">
                Pour activer définitivement votre compte, vous devez définir votre mot de passe conformément aux normes de sécurité (au moins 20 caractères avec majuscule, minuscule, chiffre et caractère spécial).
              </p>

              <!-- CTA Button -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #4f46e5;">
                    <a href="${activationUrl}" target="_blank" style="font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block;">
                      Activer mon compte et créer mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Code / Token Fallback -->
              ${
                options.activationToken
                  ? `
              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
                <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                  Votre code d'activation sécurisé (à usage unique) :
                </p>
                <p style="margin: 0 0 8px; font-family: Consolas, 'Courier New', monospace; font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">
                  ${options.activationToken}
                </p>
                <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.4;">
                  ℹ️ <strong>Remarque :</strong> Si l'accès par le lien direct ci-dessus affiche une restriction réseau (Erreur 403) depuis votre navigateur externe, ouvrez simplement OPAC et cliquez sur <em>« J'ai un code d'activation »</em> pour renseigner ce code.
                </p>
              </div>
              `
                  : ''
              }

              <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">
                Lien direct d'activation :
              </p>
              <p style="margin: 0 0 24px; font-size: 11px; word-break: break-all; color: #6366f1;">
                <a href="${activationUrl}" style="color: #6366f1; text-decoration: underline;">${activationUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Ce message a été envoyé depuis le compte de Stéphane Labati (<a href="mailto:${SUPER_ADMIN_EMAIL}" style="color: #64748b;">${SUPER_ADMIN_EMAIL}</a>).
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmailViaGmail({
    toEmail: options.toEmail,
    toName: options.displayName,
    subject: 'Bienvenue sur OPAC - Activation de votre compte utilisateur',
    htmlContent,
  });
}

/**
 * Génère le modèle HTML et envoie l'email de réinitialisation de mot de passe
 */
export async function sendPasswordResetNotification(options: {
  toEmail: string;
  displayName: string;
  resetToken?: string;
  appUrl?: string;
}): Promise<EmailSendResult> {
  const currentOrigin = options.appUrl || window.location.origin;
  const resetUrl = `${currentOrigin}?action=reset_password&email=${encodeURIComponent(options.toEmail)}&token=${options.resetToken || ''}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Réinitialisation de votre mot de passe OPAC</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 36px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">
                OPAC <span style="font-size: 13px; font-weight: 500; color: #94a3b8; margin-left: 8px;">Sécurité du compte</span>
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px;">
              <h2 style="margin: 0 0 16px; color: #0f172a; font-size: 18px; font-weight: 700;">
                Bonjour ${options.displayName},
              </h2>
              <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">
                Une réinitialisation de votre mot de passe pour la plateforme <strong>OPAC</strong> a été demandée par <strong>Stéphane Labati</strong>.
              </p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #991b1b; font-weight: 500;">
                  Votre mot de passe précédent a été désactivé. Vous devez obligatoirement en définir un nouveau pour accéder à l'application.
                </p>
              </div>

              <!-- CTA Button -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #4f46e5;">
                    <a href="${resetUrl}" target="_blank" style="font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block;">
                      Définir mon nouveau mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Code / Token Fallback -->
              ${
                options.resetToken
                  ? `
              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
                <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                  Votre code de réinitialisation sécurisé :
                </p>
                <p style="margin: 0 0 8px; font-family: Consolas, 'Courier New', monospace; font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">
                  ${options.resetToken}
                </p>
                <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.4;">
                  ℹ️ <strong>Remarque :</strong> Si l'accès par le lien direct ci-dessus affiche une restriction réseau (Erreur 403) depuis votre navigateur externe, ouvrez simplement votre application OPAC et cliquez sur <em>« J'ai un code de réinitialisation »</em> pour renseigner ce code.
                </p>
              </div>
              `
                  : ''
              }

              <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">
                Rappel sécurité : Votre mot de passe doit comporter un minimum de 20 caractères, incluant au moins une majuscule, une minuscule, un chiffre et un caractère spécial.
              </p>

              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Ce message a été envoyé depuis le compte de Stéphane Labati (<a href="mailto:${SUPER_ADMIN_EMAIL}" style="color: #64748b;">${SUPER_ADMIN_EMAIL}</a>).
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmailViaGmail({
    toEmail: options.toEmail,
    toName: options.displayName,
    subject: 'OPAC - Réinitialisation de votre mot de passe',
    htmlContent,
  });
}
