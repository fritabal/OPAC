import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const BRANDING_DOC_PATH = 'settings/branding';
const LOCAL_STORAGE_KEY = 'opac_custom_logo';

export interface BrandingConfig {
  logoUrl?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Charge le logo depuis le cache local pour un affichage instantané
 */
export function getCachedAppLogo(): string | null {
  try {
    return localStorage.getItem(LOCAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Écoute en temps réel les changements de configuration de marque / logo
 */
export function subscribeToBranding(callback: (config: BrandingConfig | null) => void) {
  const brandingDocRef = doc(db, 'settings', 'branding');
  
  return onSnapshot(
    brandingDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as BrandingConfig;
        if (data.logoUrl) {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, data.logoUrl);
          } catch {
            // ignore localStorage quota
          }
        } else {
          try {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          } catch {
            // ignore
          }
        }
        callback(data);
      } else {
        try {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        } catch {
          // ignore
        }
        callback(null);
      }
    },
    (error) => {
      console.warn('Erreur écoute branding Firestore:', error);
      const cached = getCachedAppLogo();
      callback(cached ? { logoUrl: cached } : null);
    }
  );
}

/**
 * Redimensionne une image à max 256x256 pour garantir un stockage ultra-léger et rapide dans Firestore
 */
export async function resizeImageToDataUrl(file: File): Promise<string> {
  // Si c'est un SVG, on le lit directement sans canvas
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Préférer PNG pour préserver la transparence
        const optimizedDataUrl = canvas.toDataURL('image/png', 0.92);
        resolve(optimizedDataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Met à jour le logo de l'application dans Firestore
 */
export async function updateAppLogo(dataUrl: string, updatedBy: string): Promise<void> {
  const brandingDocRef = doc(db, 'settings', 'branding');
  await setDoc(
    brandingDocRef,
    {
      logoUrl: dataUrl,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
    { merge: true }
  );

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, dataUrl);
  } catch {
    // ignore
  }
}

/**
 * Réinitialise le logo de l'application au logo par défaut
 */
export async function resetAppLogo(): Promise<void> {
  const brandingDocRef = doc(db, 'settings', 'branding');
  await deleteDoc(brandingDocRef);

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}
