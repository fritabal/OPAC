import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId with fallback to prevent data access loss
export const FIRESTORE_DATABASE_ID =
  (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-priorisationproj-1ae64907-a5e0-41bf-b2ec-0d3fcde1bed3';
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
export const auth = getAuth(app);

/**
 * Détecte si l'application s'exécute dans l'environnement de développement
 * (URL ais-dev-*, localhost, ou serveur Vite dev) vs dans l'environnement
 * publié / recette (ais-pre-*, .ai.studio, build de production).
 */
export function isDevDatabaseEnvironment(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      if (host.startsWith('ais-pre-') || host === 'opac-v1-1.ai.studio' || host.endsWith('.ai.studio')) {
        return false;
      }
      if (
        host.startsWith('ais-dev-') ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host.endsWith('.local')
      ) {
        return true;
      }
    }
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

export const IS_DEV_DB_ENV = isDevDatabaseEnvironment();
export const DB_ENV_LABEL: 'dev' | 'recette' = IS_DEV_DB_ENV ? 'dev' : 'recette';
export const DB_COLLECTION_PREFIX = IS_DEV_DB_ENV ? 'dev__' : '';

/**
 * Retourne le nom réel de la collection Firestore isolée pour l'environnement actif.
 * - En développement (ais-dev-*, localhost, Vite DEV) : `dev__<collection>`
 * - En environnement publié / recette (ais-pre-*, .ai.studio, PROD) : `<collection>`
 */
export function getEnvCollectionName(baseCollection: string): string {
  return `${DB_COLLECTION_PREFIX}${baseCollection}`;
}

/**
 * Préfixe les clés de cache localStorage en développement pour isoler
 * les caches locaux entre l'environnement de dev et l'environnement publié / recette.
 */
export function getEnvStorageKey(baseKey: string): string {
  return IS_DEV_DB_ENV ? `dev__${baseKey}` : baseKey;
}
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope(GMAIL_SEND_SCOPE);

// Cache mémoire du jeton OAuth Google Workspace (non stocké dans localStorage/sessionStorage)
let cachedGoogleAccessToken: string | null = null;

export function setCachedGoogleAccessToken(token: string | null) {
  cachedGoogleAccessToken = token;
}

export function getCachedGoogleAccessToken(): string | null {
  return cachedGoogleAccessToken;
}

// Invalidation du jeton d'accès lors de la déconnexion
auth.onAuthStateChanged((user) => {
  if (!user) {
    cachedGoogleAccessToken = null;
  }
});

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
      return false;
    }
    // If permission or document not found, the connection to server succeeded
    return true;
  }
}

export { signInWithPopup, signOut };
