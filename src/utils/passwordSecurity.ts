/**
 * Règles de sécurité et validation des mots de passe.
 * Exigence : Au moins 20 caractères, dont au moins une minuscule, au moins une majuscule,
 * au moins un chiffre et au moins un caractère spécial.
 */

export interface PasswordRuleStatus {
  id: string;
  label: string;
  satisfied: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  rules: {
    minLength: boolean;
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const minLength = password.length >= 20;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  // Caractère spécial : tout ce qui n'est ni lettre ni chiffre ASCII
  const hasSpecialChar = /[^a-zA-Z0-9]/.test(password);

  const errors: string[] = [];
  if (!minLength) errors.push('Le mot de passe doit comporter au moins 20 caractères.');
  if (!hasLowercase) errors.push('Le mot de passe doit comporter au moins une lettre minuscule (a-z).');
  if (!hasUppercase) errors.push('Le mot de passe doit comporter au moins une lettre majuscule (A-Z).');
  if (!hasNumber) errors.push('Le mot de passe doit comporter au moins un chiffre (0-9).');
  if (!hasSpecialChar) errors.push('Le mot de passe doit comporter au moins un caractère spécial (!, @, #, $, %, etc.).');

  const isValid = minLength && hasLowercase && hasUppercase && hasNumber && hasSpecialChar;

  return {
    isValid,
    rules: {
      minLength,
      hasLowercase,
      hasUppercase,
      hasNumber,
      hasSpecialChar,
    },
    errors,
  };
}

/**
 * Calcul d'une empreinte SHA-256 avec salage pour sécuriser le stockage local/Firestore
 */
export async function hashPassword(password: string, email: string): Promise<string> {
  const salt = `priorisation_${email.trim().toLowerCase()}_secure_salt_2026`;
  const data = new TextEncoder().encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
