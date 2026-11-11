import {
  collection,
  doc,
  getDocs,
  writeBatch,
  setDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LOCAL_STORAGE_KEY as BONUS_CACHE_KEY } from './bonusService';
import { SUPER_ADMIN_EMAIL } from './userService';
import { fr } from '../i18n/locales/fr';
import { en } from '../i18n/locales/en';
import { de } from '../i18n/locales/de';
import { it } from '../i18n/locales/it';
import { buildTranslationTree } from '../utils/translationTree';
import {
  getCachedTranslationOverrides,
  applyOverridesToI18n,
  SETTINGS_COLLECTION,
  TRANSLATIONS_DOC_ID,
  LOCAL_STORAGE_OVERRIDES_KEY,
} from './translationService';
import {
  getSavedActiveLanguageCodes,
  setSavedActiveLanguageCodes,
} from '../i18n/languages';

export interface BackupI18nData {
  totalKeys: number;
  languages: string[];
  overrides: Record<string, Record<string, string>>;
  baseMessages: {
    fr: Record<string, any>;
    en: Record<string, any>;
    de: Record<string, any>;
    it: Record<string, any>;
  };
  effectiveMessages: {
    fr: Record<string, any>;
    en: Record<string, any>;
    de: Record<string, any>;
    it: Record<string, any>;
  };
  allMessages: Record<
    string,
    {
      key: string;
      defaults: { fr: string; en: string; de: string; it: string };
      effective: { fr: string; en: string; de: string; it: string };
      isOverridden: boolean;
    }
  >;
}

export interface BackupData {
  format: 'OPAC_BACKUP';
  version: 1;
  exportedAt: string;
  exportedBy: string;
  counts: {
    projects: number;
    users: number;
    criteria: number;
    budgetLines: number;
    keySkills: number;
    resources: number;
    projectStates: number;
    projectCustomParams: number;
    settings: number;
    counters: number;
    i18n?: number;
  };
  data: {
    projects: Record<string, any>[];
    users: Record<string, any>[];
    criteria: Record<string, any>[];
    budgetLines: Record<string, any>[];
    keySkills: Record<string, any>[];
    resources: Record<string, any>[];
    projectStates: Record<string, any>[];
    projectCustomParams: Record<string, any>[];
    settings: Record<string, any>[];
    counters: Record<string, any>[];
    i18n?: BackupI18nData;
  };
}

export interface ImportResult {
  success: boolean;
  totalImported: number;
  counts: {
    projects: number;
    users: number;
    criteria: number;
    budgetLines: number;
    keySkills: number;
    resources: number;
    projectStates: number;
    projectCustomParams: number;
    settings: number;
    counters: number;
    i18n?: number;
  };
  message?: string;
}

export interface EraseResult {
  success: boolean;
  deletedCounts: Record<string, number>;
  message: string;
}

const BACKUP_COLLECTIONS = [
  'projects',
  'users',
  'criteria',
  'budgetLines',
  'keySkills',
  'resources',
  'projectStates',
  'projectCustomParams',
  'settings',
  'counters',
] as const;

/**
 * Détermine de façon stricte si un document utilisateur correspond au compte Super User
 */
export function isSuperUserAccount(userData: any, emailToCheck?: string): boolean {
  if (!userData) return false;
  const email = (userData.email || '').trim().toLowerCase();
  const superEmail = (SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const currentEmail = (emailToCheck || '').trim().toLowerCase();

  if (email && (email === superEmail || (currentEmail && email === currentEmail))) {
    return true;
  }
  if (userData.isSuperAdmin === true || userData.role === 'super user') {
    return true;
  }
  if (Array.isArray(userData.roles) && userData.roles.includes('super user')) {
    return true;
  }
  return false;
}

/**
 * Nettoie récursivement un objet Firestore pour la sérialisation JSON
 * Convertit les Timestamps Firestore en chaînes ISO
 */
function serializeFirestoreData(val: any): any {
  if (val === null || val === undefined) return val;

  // Objet Timestamp Firestore (possède toDate() ou seconds/nanoseconds)
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (
    typeof val === 'object' &&
    typeof val.seconds === 'number' &&
    typeof val.nanoseconds === 'number' &&
    Object.keys(val).length <= 2
  ) {
    return new Date(val.seconds * 1000 + val.nanoseconds / 1000000).toISOString();
  }

  if (Array.isArray(val)) {
    return val.map(serializeFirestoreData);
  }

  if (typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      res[key] = serializeFirestoreData(val[key]);
    }
    return res;
  }

  return val;
}

/**
 * Exporte l'intégralité des données de l'application au format JSON
 */
export async function exportAllApplicationData(currentUserEmail: string): Promise<BackupData> {
  const backup: BackupData = {
    format: 'OPAC_BACKUP',
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: currentUserEmail || 'Super User',
    counts: {
      projects: 0,
      users: 0,
      criteria: 0,
      budgetLines: 0,
      keySkills: 0,
      resources: 0,
      projectStates: 0,
      projectCustomParams: 0,
      settings: 0,
      counters: 0,
      i18n: 0,
    },
    data: {
      projects: [],
      users: [],
      criteria: [],
      budgetLines: [],
      keySkills: [],
      resources: [],
      projectStates: [],
      projectCustomParams: [],
      settings: [],
      counters: [],
    },
  };

  // 1. Extraction de toutes les collections Firestore
  for (const colName of BACKUP_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      const items: Record<string, any>[] = [];
      snap.forEach((d) => {
        items.push({
          id: d.id,
          ...serializeFirestoreData(d.data()),
        });
      });
      (backup.data as any)[colName] = items;
      (backup.counts as any)[colName] = items.length;
    } catch (err) {
      console.warn(`Avertissement lors de l'export de la collection ${colName}:`, err);
    }
  }

  // 2. Traitement et consolidation de l'Internationalisation & des Messages de traduction
  // Récupération des surcharges de traductions (depuis settings/translations ou cache local)
  let translationsDoc = (backup.data.settings || []).find((s) => s.id === TRANSLATIONS_DOC_ID);
  let overrides: Record<string, Record<string, string>> = translationsDoc?.overrides || {};

  if (!translationsDoc || Object.keys(overrides).length === 0) {
    const cachedOverrides = getCachedTranslationOverrides();
    if (cachedOverrides && Object.keys(cachedOverrides).length > 0) {
      overrides = cachedOverrides;
      if (!translationsDoc) {
        translationsDoc = {
          id: TRANSLATIONS_DOC_ID,
          overrides,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUserEmail || 'Super User',
        };
        backup.data.settings.push(translationsDoc);
        backup.counts.settings = backup.data.settings.length;
      } else {
        translationsDoc.overrides = overrides;
      }
    }
  }

  // Construction de l'arbre exhaustif des libellés et messages de l'application
  const { allLeaves, leafCount } = buildTranslationTree();

  // Dictionnaires effectifs complets par langue (base + surcharges éventuelles)
  const effectiveMessages: {
    fr: Record<string, any>;
    en: Record<string, any>;
    de: Record<string, any>;
    it: Record<string, any>;
    [key: string]: Record<string, any>;
  } = {
    fr: JSON.parse(JSON.stringify(fr)),
    en: JSON.parse(JSON.stringify(en)),
    de: JSON.parse(JSON.stringify(de)),
    it: JSON.parse(JSON.stringify(it)),
  };

  for (const [lang, keyMap] of Object.entries(overrides)) {
    if (effectiveMessages[lang] && keyMap && typeof keyMap === 'object') {
      for (const [path, val] of Object.entries(keyMap)) {
        if (typeof val === 'string') {
          const parts = path.split('.');
          let curr = effectiveMessages[lang];
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]] || typeof curr[parts[i]] !== 'object') {
              curr[parts[i]] = {};
            }
            curr = curr[parts[i]];
          }
          curr[parts[parts.length - 1]] = val;
        }
      }
    }
  }

  // Dictionnaire plat détaillé de tous les messages (clé, valeurs par défaut, valeurs effectives, statut personnalisé)
  const allMessagesFlat: Record<
    string,
    {
      key: string;
      defaults: { fr: string; en: string; de: string; it: string };
      effective: { fr: string; en: string; de: string; it: string };
      isOverridden: boolean;
    }
  > = {};

  for (const leaf of allLeaves) {
    const frVal = overrides['fr']?.[leaf.id] ?? leaf.defaults['fr'] ?? '';
    const enVal = overrides['en']?.[leaf.id] ?? leaf.defaults['en'] ?? '';
    const deVal = overrides['de']?.[leaf.id] ?? leaf.defaults['de'] ?? '';
    const itVal = overrides['it']?.[leaf.id] ?? leaf.defaults['it'] ?? '';

    const isOverridden = Boolean(
      overrides['fr']?.[leaf.id] !== undefined ||
      overrides['en']?.[leaf.id] !== undefined ||
      overrides['de']?.[leaf.id] !== undefined ||
      overrides['it']?.[leaf.id] !== undefined
    );

    allMessagesFlat[leaf.id] = {
      key: leaf.id,
      defaults: {
        fr: leaf.defaults['fr'] || '',
        en: leaf.defaults['en'] || '',
        de: leaf.defaults['de'] || '',
        it: leaf.defaults['it'] || '',
      },
      effective: {
        fr: frVal,
        en: enVal,
        de: deVal,
        it: itVal,
      },
      isOverridden,
    };
  }

  // Bloc dédié pour toutes les traductions & messages d'internationalisation
  backup.data.i18n = {
    totalKeys: leafCount,
    languages: getSavedActiveLanguageCodes(),
    overrides,
    baseMessages: {
      fr,
      en,
      de,
      it,
    },
    effectiveMessages,
    allMessages: allMessagesFlat,
  };
  backup.counts.i18n = leafCount;

  return backup;
}

/**
 * Déclenche le téléchargement du fichier JSON dans le navigateur
 */
export function downloadBackupFile(backup: BackupData) {
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `opac_sauvegarde_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Importe l'intégralité des données à partir d'un fichier de sauvegarde
 * Supporte le remplacement complet (suppression des données existantes puis recréation)
 */
export async function importAllApplicationData(
  backupData: any,
  options: { clearExisting?: boolean; currentUserEmail?: string } = { clearExisting: true }
): Promise<ImportResult> {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Le fichier fourni ne contient pas un objet JSON valide.');
  }

  // Vérifier la présence du bloc data
  const dataBlock = backupData.data || backupData;
  if (!dataBlock || typeof dataBlock !== 'object') {
    throw new Error('Format de sauvegarde invalide : bloc de données manquant.');
  }

  const resultCounts = {
    projects: 0,
    users: 0,
    criteria: 0,
    budgetLines: 0,
    keySkills: 0,
    resources: 0,
    projectStates: 0,
    projectCustomParams: 0,
    settings: 0,
    counters: 0,
    i18n: 0,
  };

  // 1. Si réinitialisation demandée : supprimer les documents existants dans les collections concernées
  if (options.clearExisting) {
    for (const colName of BACKUP_COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, colName));
        // Protection du compte Super User : ne jamais le supprimer lors du nettoyage
        const docsToDelete = snap.docs.filter((d) => {
          if (colName === 'users') {
            return !isSuperUserAccount(d.data(), options.currentUserEmail);
          }
          return true;
        });
        
        // Exécution par lots de 400
        for (let i = 0; i < docsToDelete.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = docsToDelete.slice(i, i + 400);
          for (const d of chunk) {
            batch.delete(d.ref);
          }
          await batch.commit();
        }
      } catch (err) {
        console.warn(`Erreur lors de la suppression de la collection ${colName}:`, err);
      }
    }
  }

  // 2. Écriture des données par lots (batch) de 400 opérations max par lot
  let highestProjectNumber = 0;

  for (const colName of BACKUP_COLLECTIONS) {
    const rawItems = dataBlock[colName];
    if (!Array.isArray(rawItems) || rawItems.length === 0) continue;

    for (let i = 0; i < rawItems.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = rawItems.slice(i, i + 400);

      for (const item of chunk) {
        if (!item || typeof item !== 'object') continue;
        const { id, ...docData } = item;

        // Protection Super User : n'écrase pas le super user existant avec celui de la sauvegarde
        if (colName === 'users' && isSuperUserAccount(docData, options.currentUserEmail)) {
          continue;
        }

        const docId = id || docData.id || doc(collection(db, colName)).id;
        const targetRef = doc(db, colName, String(docId));

        batch.set(targetRef, docData);
        (resultCounts as any)[colName] = ((resultCounts as any)[colName] || 0) + 1;

        // Repérage du plus grand numéro de projet
        if (colName === 'projects' && typeof docData.projectNumber === 'number') {
          if (docData.projectNumber > highestProjectNumber) {
            highestProjectNumber = docData.projectNumber;
          }
        }

        // Synchronisation des caches locaux pour les paramètres clés
        if (colName === 'settings') {
          if (docId === 'prioritization_bonus') {
            try {
              localStorage.setItem('opac_bonus_config', JSON.stringify(docData));
            } catch {
              // ignore
            }
          } else if (docId === 'branding') {
            try {
              if (docData.logoUrl) {
                localStorage.setItem('opac_custom_logo', docData.logoUrl);
              } else {
                localStorage.removeItem('opac_custom_logo');
              }
            } catch {
              // ignore
            }
          } else if (docId === TRANSLATIONS_DOC_ID || docId === 'translations') {
            try {
              const overrides = docData.overrides || {};
              const activeLangs = docData.activeLanguages;
              if (Array.isArray(activeLangs) && activeLangs.length > 0) {
                setSavedActiveLanguageCodes(activeLangs);
              }
              localStorage.setItem(LOCAL_STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
              applyOverridesToI18n(overrides);
              resultCounts.i18n = Object.keys(overrides).length || 1158;
            } catch {
              // ignore
            }
          }
        }
      }

      await batch.commit();
    }
  }

  // 3. S'assurer que le compteur de projet est à jour (au moins au numéro max des projets importés)
  if (highestProjectNumber > 0) {
    try {
      await setDoc(doc(db, 'counters', 'projects'), {
        lastProjectNumber: highestProjectNumber,
        updatedAt: new Date().toISOString(),
        updatedBy: options.currentUserEmail || 'system',
      }, { merge: true });
    } catch (e) {
      console.warn('Erreur lors de la mise à jour du compteur de projets:', e);
    }
  }

  // 4. Synchronisation et restauration des messages d'internationalisation depuis le bloc i18n si présent
  if (dataBlock.i18n && typeof dataBlock.i18n === 'object') {
    const i18nOverrides = dataBlock.i18n.overrides || {};
    const i18nLanguages = dataBlock.i18n.languages;
    if (Array.isArray(i18nLanguages) && i18nLanguages.length > 0) {
      setSavedActiveLanguageCodes(i18nLanguages);
    }
    try {
      await setDoc(
        doc(db, SETTINGS_COLLECTION, TRANSLATIONS_DOC_ID),
        {
          overrides: i18nOverrides,
          ...(Array.isArray(i18nLanguages) && i18nLanguages.length > 0 ? { activeLanguages: i18nLanguages } : {}),
          updatedAt: new Date().toISOString(),
          updatedBy: options.currentUserEmail || 'Super User',
        },
        { merge: true }
      );
      localStorage.setItem(LOCAL_STORAGE_OVERRIDES_KEY, JSON.stringify(i18nOverrides));
      applyOverridesToI18n(i18nOverrides);
      resultCounts.i18n = dataBlock.i18n.totalKeys || 1158;
    } catch (e) {
      console.warn('Erreur réplication des surcharges d\'internationalisation:', e);
    }
  }

  const total = Object.values(resultCounts).reduce((a, b) => a + b, 0);

  return {
    success: true,
    totalImported: total,
    counts: resultCounts,
    message: `${total} élément(s) importé(s) avec succès.`,
  };
}

/**
 * Efface l'intégralité des données de l'application (projets, paramètres, utilisateurs)
 * tout en garantissant que le Super User conserve impérativement son accès.
 */
export async function eraseAllApplicationData(currentUserEmail: string): Promise<EraseResult> {
  const deletedCounts: Record<string, number> = {
    projects: 0,
    users: 0,
    criteria: 0,
    budgetLines: 0,
    keySkills: 0,
    resources: 0,
    projectStates: 0,
    projectCustomParams: 0,
    settings: 0,
    counters: 0,
  };

  for (const colName of BACKUP_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      // Si c'est la collection 'users', on préserve impérativement le compte Super User
      const docsToDelete = snap.docs.filter((d) => {
        if (colName === 'users') {
          return !isSuperUserAccount(d.data(), currentUserEmail);
        }
        return true;
      });

      for (let i = 0; i < docsToDelete.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = docsToDelete.slice(i, i + 400);
        for (const d of chunk) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
      deletedCounts[colName] = docsToDelete.length;
    } catch (err) {
      console.warn(`Erreur lors de l'effacement de la collection ${colName}:`, err);
    }
  }

  // Réinitialisation du compteur séquentiel de projet à 0
  try {
    await setDoc(doc(db, 'counters', 'projects'), {
      lastProjectNumber: 0,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUserEmail || 'super-user',
    });
  } catch (e) {
    console.warn('Erreur reset compteur de projets:', e);
  }

  // Nettoyage des caches locaux
  try {
    localStorage.removeItem(BONUS_CACHE_KEY);
    localStorage.removeItem('opac_custom_logo');
    localStorage.removeItem(LOCAL_STORAGE_OVERRIDES_KEY);
    applyOverridesToI18n({});
  } catch {
    // ignore
  }

  // S'assurer qu'au moins un compte Super User reste présent dans la collection users
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const hasSuper = usersSnap.docs.some((d) => isSuperUserAccount(d.data(), currentUserEmail));
    if (!hasSuper) {
      await addDoc(collection(db, 'users'), {
        email: currentUserEmail || SUPER_ADMIN_EMAIL,
        displayName: 'Super User',
        role: 'super user',
        roles: ['super user'],
        isSuperAdmin: true,
        isActive: true,
        mustResetPassword: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('Erreur vérification résiduelle compte super user:', e);
  }

  return {
    success: true,
    deletedCounts,
    message: 'Toutes les données ont été effacées avec succès. Le compte Super User a été préservé.',
  };
}
