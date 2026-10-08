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
