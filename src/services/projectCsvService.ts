import { Project, ProjectFormData } from '../types/project';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { Criterion, CRITERION_POINTS } from '../types/criteria';
import { CustomProjectParam } from '../types/customParam';
import { KeySkill } from '../types/skill';
import { AppUser } from '../types/user';
import { BonusConfig } from '../types/bonus';
import { calculateProjectRoi } from '../utils/roiCalculator';
import { normalizePeriodKey } from '../utils/dateUtils';
import { createProject, updateProject, deleteProject } from './projectService';

export interface ReferenceData {
  projectStates: ProjectState[];
  budgetLines: BudgetLine[];
  criteria: Criterion[];
  customParams: CustomProjectParam[];
  skills: KeySkill[];
  users: AppUser[];
  bonusConfig?: BonusConfig;
}

export type ImportMode = 'update_or_create' | 'create_all_new';

export interface ImportLogRow {
  rowNumber: number;
  projectNumber?: number;
  projectName: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  action: 'CREATED' | 'UPDATED' | 'FAILED';
  details: string[];
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  warningCount: number;
  errorCount: number;
  logRows: ImportLogRow[];
  logContent: string;
}

/**
 * Échappe une cellule CSV pour séparateur '|'.
 * Si la cellule contient '|', un retour à la ligne ou un guillemet, elle est entourée de guillemets
 * et les guillemets internes sont doublés.
 */
export function escapeCsvPipeCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('|') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Analyseur de CSV conforme RFC 4180 avec séparateur personnalisé '|'.
 * Gère correctement les retours à la ligne dans les cellules entre guillemets et les guillemets doublés.
 */
export function parseCsvPipe(text: string): string[][] {
  let cleanText = text;
  // Suppression du BOM UTF-8 s'il existe
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Guillemet doublé
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // Fermeture du guillemet
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === '|') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        continue;
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  // Filtrer les lignes totalement vides
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].length > 0));
}

/**
 * Déclenche le téléchargement d'un fichier dans le navigateur.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Calcule les fenêtres de périodes capacitaires à partir d'une date de référence :
 * - currentMonthKey : mois en cours (M0)
 * - nextMonthKey : mois prochain (M+1)
 * - minAllowedMonthKey : borne minimale autorisée à l'import (M-12 = ce mois-ci - 12 mois)
 * - historyMonths : les 12 derniers mois (M-12 à M-1)
 * - futureMonths : mois en cours + 12 prochains mois (M0 à M+12)
 */
export function getCapacityPeriodWindows(baseDate: Date = new Date()): {
  currentMonthKey: string;
  nextMonthKey: string;
  minAllowedMonthKey: string;
  historyMonths: string[];
  futureMonths: string[];
} {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const currentMonthKey = formatYearMonth(new Date(year, month, 1));
  const nextMonthKey = formatYearMonth(new Date(year, month + 1, 1));
  const minAllowedMonthKey = formatYearMonth(new Date(year, month - 12, 1));

  const historyMonths: string[] = [];
  for (let i = -12; i <= -1; i++) {
    historyMonths.push(formatYearMonth(new Date(year, month + i, 1)));
  }

  const futureMonths: string[] = [];
  for (let i = 0; i <= 12; i++) {
    futureMonths.push(formatYearMonth(new Date(year, month + i, 1)));
  }

  return {
    currentMonthKey,
    nextMonthKey,
    minAllowedMonthKey,
    historyMonths,
    futureMonths,
  };
}

/**
 * Exporte tous les projets au format CSV avec séparateur '|'
 * et clés visibles humaines (noms de critères, lignes, états, compétences, etc.),
 * incluant les demandes mensuelles des 12 derniers mois (historique),
 * le plan de staffing des 12 prochains mois et le Reste à Terminaison (RAT).
 */
export function exportProjectsToCsv(
  projects: Project[],
  refs: ReferenceData,
  baseDate: Date = new Date()
): string {
  const { projectStates, budgetLines, criteria, customParams, skills } = refs;
  const { currentMonthKey, nextMonthKey, historyMonths, futureMonths } =
    getCapacityPeriodWindows(baseDate);

  // 1. Définition des en-têtes
  const headers: string[] = [
    'Numéro',
    'Nom',
    'Description',
    'État',
    'Chef de projet',
    'Adjoint',
    'Créé par',
    'Confidentiel',
    'Ligne budgétaire',
    'Budget estimé (K€)',
    'Points bonus',
    'Mois capacitaire',
    'Staffé (Capacitaire)',
  ];

  // Critères de priorisation
  for (const crit of criteria) {
    headers.push(`Critère: ${crit.name}`);
  }

  // Paramètres personnalisés
  for (const cp of customParams) {
    headers.push(`Paramètre: ${cp.name}`);
  }

  // Besoins en compétences clés (mois à venir - compatibilité directe)
  for (const sk of skills) {
    headers.push(`Compétence: ${sk.name}`);
  }

  // Métadonnées de validation capacitaire & Reste à Terminaison (RAT)
  headers.push('Mois staffing validés', 'RAT validé', 'Mois validation RAT');
  for (const sk of skills) {
    headers.push(`RAT: ${sk.name}`);
  }

  // Historique des demandes mensuelles sur les 12 derniers mois (M-12 à M-1)
  for (const mKey of historyMonths) {
    for (const sk of skills) {
      headers.push(`Historique ${mKey}: ${sk.name}`);
    }
  }

  // Plan de staffing prévisionnel (mois en cours M0 + 12 prochains mois M+1 à M+12)
  for (const mKey of futureMonths) {
    for (const sk of skills) {
      headers.push(`Staffing ${mKey}: ${sk.name}`);
    }
  }

  // 2. Génération des lignes de données
  const rows: string[][] = [headers];

  // Trier les projets par numéro séquentiel
  const sortedProjects = [...projects].sort((a, b) => (a.projectNumber || 0) - (b.projectNumber || 0));

  for (const p of sortedProjects) {
    const row: string[] = [];

    // Numéro
    row.push(String(p.projectNumber || ''));

    // Nom
    row.push(p.name || '');

    // Description
    row.push(p.description || '');

    // État (visible)
    const stateObj = projectStates.find((s) => s.id === p.stateId);
    row.push(stateObj?.name || p.stateName || '');

    // Chef de projet (email / visible)
    row.push(p.projectManagerEmail || '');

    // Adjoint (email / visible)
    row.push(p.deputyEmail || '');

    // Créé par
    row.push(p.createdByEmail || '');

    // Confidentiel
    row.push(p.isConfidential ? 'Oui' : 'Non');

    // Ligne budgétaire (nom visible)
    const blObj = budgetLines.find((b) => b.id === p.budgetLineId);
    row.push(blObj?.name || '');

    // Budget estimé en K€
    row.push(p.estimatedBudget !== undefined && p.estimatedBudget !== null ? String(p.estimatedBudget) : '0');

    // Points bonus
    row.push(p.bonus !== undefined && p.bonus !== null ? String(p.bonus) : '');

    // Mois capacitaire
    row.push(p.capacityUpdatedMonth || '');

    // Staffé (Capacitaire)
    row.push(p.isStaffed !== false ? 'Oui' : 'Non');

    // Critères de priorisation (libellé textuel de l'échelon sélectionné)
    for (const crit of criteria) {
      const pointVal = p.criteriaValues?.[crit.id];
      if (pointVal !== undefined && pointVal !== null) {
        const pointNum = Number(pointVal);
        const idx = (CRITERION_POINTS as readonly number[]).indexOf(pointNum);
        if (idx >= 0 && crit.levels?.[idx]) {
          row.push(crit.levels[idx]);
        } else {
          row.push(String(pointNum));
        }
      } else {
        row.push('');
      }
    }

    // Paramètres personnalisés
    for (const cp of customParams) {
      const rawVal = p.customParamValues?.[cp.id];
      if (rawVal === undefined || rawVal === null) {
        row.push('');
      } else if (cp.type === 'case à cocher') {
        row.push(rawVal ? 'Oui' : 'Non');
      } else if (Array.isArray(rawVal)) {
        row.push(rawVal.join(', '));
      } else {
        row.push(String(rawVal));
      }
    }

    // Compétences clés (jours demandés pour le mois à venir)
    for (const sk of skills) {
      const days = p.capacityDaysPerSkill?.[sk.id] ?? p.staffingPlan?.[nextMonthKey]?.[sk.id];
      if (days !== undefined && days !== null) {
        row.push(String(days));
      } else {
        row.push('');
      }
    }

    // Mois staffing validés (hors clé 'rat')
    const validatedMonthKeys = Object.entries(p.staffingPlanValidatedMonths || {})
      .filter(([key, val]) => key !== 'rat' && val === true)
      .map(([key]) => normalizePeriodKey(key) || key)
      .filter(Boolean)
      .sort();
    row.push(validatedMonthKeys.join(', '));

    // RAT validé & mois de validation RAT
    const isRatVal = Boolean(p.staffingPlanValidatedMonths?.['rat'] ?? p.isRatValidated);
    row.push(isRatVal ? 'Oui' : 'Non');
    row.push(p.ratValidatedMonth || '');

    // Reste à Terminaison (RAT) par compétence
    for (const sk of skills) {
      const ratDays = p.remainingToComplete?.[sk.id];
      if (ratDays !== undefined && ratDays !== null) {
        row.push(String(ratDays));
      } else {
        row.push('');
      }
    }

    // Historique des 12 derniers mois (M-12 à M-1)
    for (const mKey of historyMonths) {
      const monthHist = p.capacityHistory?.[mKey];
      for (const sk of skills) {
        const val = monthHist?.[sk.id];
        if (val !== undefined && val !== null) {
          row.push(String(val));
        } else {
          row.push('');
        }
      }
    }

    // Plan de staffing prévisionnel (M0 + 12 prochains mois)
    for (const mKey of futureMonths) {
      const monthPlan = p.staffingPlan?.[mKey];
      for (const sk of skills) {
        let val = monthPlan?.[sk.id];
        if (
          (val === undefined || val === null) &&
          mKey === nextMonthKey &&
          (!p.capacityUpdatedMonth || p.capacityUpdatedMonth === nextMonthKey)
        ) {
          val = p.capacityDaysPerSkill?.[sk.id];
        }
        if ((val === undefined || val === null) && mKey === currentMonthKey) {
          val = p.capacityHistory?.[mKey]?.[sk.id];
        }
        if (val !== undefined && val !== null) {
          row.push(String(val));
        } else {
          row.push('');
        }
      }
    }

    rows.push(row);
  }

  // 3. Concaténation avec échappement et UTF-8 BOM
  const csvBody = rows.map((r) => r.map(escapeCsvPipeCell).join('|')).join('\r\n');
  return '\uFEFF' + csvBody;
}

/**
 * Génère un modèle CSV vierge avec les colonnes et un projet d'exemple commenté.
 */
export function generateProjectsCsvTemplate(
  refs: ReferenceData,
  baseDate: Date = new Date()
): string {
  const { projectStates, budgetLines, criteria, customParams, skills } = refs;
  const { currentMonthKey, nextMonthKey, historyMonths, futureMonths } =
    getCapacityPeriodWindows(baseDate);

  const headers: string[] = [
    'Numéro',
    'Nom',
    'Description',
    'État',
    'Chef de projet',
    'Adjoint',
    'Créé par',
    'Confidentiel',
    'Ligne budgétaire',
    'Budget estimé (K€)',
    'Points bonus',
    'Mois capacitaire',
    'Staffé (Capacitaire)',
  ];

  for (const crit of criteria) {
    headers.push(`Critère: ${crit.name}`);
  }
  for (const cp of customParams) {
    headers.push(`Paramètre: ${cp.name}`);
  }
  for (const sk of skills) {
    headers.push(`Compétence: ${sk.name}`);
  }

  headers.push('Mois staffing validés', 'RAT validé', 'Mois validation RAT');
  for (const sk of skills) {
    headers.push(`RAT: ${sk.name}`);
  }
  for (const mKey of historyMonths) {
    for (const sk of skills) {
      headers.push(`Historique ${mKey}: ${sk.name}`);
    }
  }
  for (const mKey of futureMonths) {
    for (const sk of skills) {
      headers.push(`Staffing ${mKey}: ${sk.name}`);
    }
  }

  // Ligne d'exemple
  const sampleRow: string[] = [
    '1',
    'Projet Exemple Démo',
    'Description détaillée du projet exemple pour illustrer le format.',
    projectStates[0]?.name || 'Idée',
    'chef.projet@example.com',
    'adjoint@example.com',
    'auteur@example.com',
    'Non',
    budgetLines[0]?.name || 'Build IT',
    '75',
    '2',
    nextMonthKey,
    'Oui',
  ];

  for (const crit of criteria) {
    sampleRow.push(crit.levels?.[2] || 'de 10 à 50 K€/an');
  }
  for (const cp of customParams) {
    if (cp.type === 'case à cocher') sampleRow.push('Oui');
    else if (cp.type === 'date') sampleRow.push('2026-12-01');
    else if (cp.type === 'nombre entier') sampleRow.push('42');
    else if (cp.type === 'liste de valeurs' && cp.options?.length) sampleRow.push(cp.options[0]);
    else sampleRow.push('Valeur exemple');
  }
  for (const _sk of skills) {
    sampleRow.push('10');
  }

  sampleRow.push(`${currentMonthKey}, ${nextMonthKey}`, 'Oui', currentMonthKey);
  for (const _sk of skills) {
    sampleRow.push('45');
  }
  for (const _mKey of historyMonths) {
    for (const _sk of skills) {
      sampleRow.push('5');
    }
  }
  for (const _mKey of futureMonths) {
    for (const _sk of skills) {
      sampleRow.push('10');
    }
  }

  const csvBody = [headers, sampleRow].map((r) => r.map(escapeCsvPipeCell).join('|')).join('\r\n');
  return '\uFEFF' + csvBody;
}

/**
 * Importe des projets à partir du texte CSV, effectue le rapprochement sémantique,
 * crée/met à jour dans Firestore et génère le journal d'audit complet.
 */
export async function importProjectsFromCsv(
  csvText: string,
  mode: ImportMode,
  refs: ReferenceData,
  currentProjects: Project[],
  currentUserEmail: string,
  baseDate: Date = new Date()
): Promise<ImportResult> {
  const { projectStates, budgetLines, criteria, customParams, skills, users, bonusConfig } = refs;
  const { currentMonthKey, nextMonthKey, minAllowedMonthKey } = getCapacityPeriodWindows(baseDate);

  const parsedMatrix = parseCsvPipe(csvText);
  if (parsedMatrix.length < 2) {
    throw new Error('Le fichier CSV est vide ou ne contient aucune ligne de données.');
  }

  const rawHeaders = parsedMatrix[0];
  const dataRows = parsedMatrix.slice(1);

  // Normalisation des en-têtes
  const cleanHeaders = rawHeaders.map((h) => h.trim().toLowerCase());

  // Index des colonnes standard (correspondance exacte prioritaire pour éviter toute collision avec les colonnes mensuelles)
  const findHeaderIdx = (patterns: string[], exactOnlyPatterns: string[] = []): number => {
    const exactIdx = cleanHeaders.findIndex(
      (h) => patterns.includes(h) || exactOnlyPatterns.includes(h)
    );
    if (exactIdx !== -1) return exactIdx;
    return cleanHeaders.findIndex((h) =>
      patterns.some((p) => h.startsWith(p + ' ') || h.startsWith(p + ':'))
    );
  };

  const colIdxNumber = findHeaderIdx(['numéro', 'numero', 'n°', 'id']);
  const colIdxName = findHeaderIdx(['nom', 'nom du projet', 'titre']);
  const colIdxDesc = findHeaderIdx(['description', 'détail', 'detail']);
  const colIdxState = findHeaderIdx(['état', 'etat', 'statut']);
  const colIdxPm = findHeaderIdx(['chef de projet', 'pm', 'chef projet', 'responsable']);
  const colIdxDeputy = findHeaderIdx(['adjoint', 'adjointe', 'co-pm']);
  const colIdxCreatedBy = findHeaderIdx(['créé par', 'cree par', 'auteur', 'créateur']);
  const colIdxConfidential = findHeaderIdx(['confidentiel', 'confidentialité']);
  const colIdxBudgetLine = findHeaderIdx(['ligne budgétaire', 'ligne budgetaire', 'enveloppe', 'budget line']);
  const colIdxBudget = findHeaderIdx(['budget estimé', 'budget estime', 'budget']);
  const colIdxBonus = findHeaderIdx(['points bonus', 'bonus']);
  const colIdxMonth = findHeaderIdx(['mois capacitaire', 'mois de mise à jour'], ['mois']);
  const colIdxStaffed = findHeaderIdx(['staffé (capacitaire)', 'staffé', 'staffe'], ['staffing']);
  const colIdxValidatedMonths = findHeaderIdx([
    'mois staffing validés',
    'mois staffing valides',
    'mois validés',
    'mois valides',
  ]);
  const colIdxRatValidated = findHeaderIdx(['rat validé', 'rat valide']);
  const colIdxRatValidatedMonth = findHeaderIdx(['mois validation rat']);

  if (colIdxName === -1) {
    throw new Error('La colonne « Nom » du projet est obligatoire et introuvable dans les en-têtes du fichier CSV.');
  }

  // Rapprochement des colonnes Critères
  const criteriaColMap: { criterion: Criterion; colIdx: number }[] = [];
  for (const crit of criteria) {
    const critNameLower = crit.name.trim().toLowerCase();
    const idx = cleanHeaders.findIndex(
      (h) =>
        h === `critère: ${critNameLower}` ||
        h === `critere: ${critNameLower}` ||
        h === `critère : ${critNameLower}` ||
        h === critNameLower
    );
    if (idx !== -1) {
      criteriaColMap.push({ criterion: crit, colIdx: idx });
    }
  }

  // Rapprochement des colonnes Paramètres personnalisés
  const customParamsColMap: { param: CustomProjectParam; colIdx: number }[] = [];
  for (const cp of customParams) {
    const cpNameLower = cp.name.trim().toLowerCase();
    const idx = cleanHeaders.findIndex(
      (h) =>
        h === `paramètre: ${cpNameLower}` ||
        h === `parametre: ${cpNameLower}` ||
        h === `paramètre : ${cpNameLower}` ||
        h === cpNameLower
    );
    if (idx !== -1) {
      customParamsColMap.push({ param: cp, colIdx: idx });
    }
  }

  // Rapprochement des colonnes Compétences clés (mois à venir)
  const skillsColMap: { skill: KeySkill; colIdx: number }[] = [];
  for (const sk of skills) {
    const skNameLower = sk.name.trim().toLowerCase();
    const idx = cleanHeaders.findIndex(
      (h) =>
        h === `compétence: ${skNameLower}` ||
        h === `competence: ${skNameLower}` ||
        h === `compétence : ${skNameLower}` ||
        h === `besoin: ${skNameLower}` ||
        h === skNameLower
    );
    if (idx !== -1) {
      skillsColMap.push({ skill: sk, colIdx: idx });
    }
  }

  // Index des compétences par nom normalisé
  const skillsByNameLower = new Map<string, KeySkill>();
  for (const sk of skills) {
    skillsByNameLower.set(sk.name.trim().toLowerCase(), sk);
  }

  // Rapprochement des colonnes RAT, Historique (12 derniers mois) et Plan de staffing (12 prochains mois)
  const ratColMap: { skill: KeySkill; colIdx: number }[] = [];
  const historyColMap: { monthKey: string; skill: KeySkill; colIdx: number }[] = [];
  const staffingColMap: { monthKey: string; skill: KeySkill; colIdx: number }[] = [];
  const ignoredObsoleteMonthsInHeaders = new Set<string>();

  for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
    const header = rawHeaders[colIdx].trim();
    if (!header) continue;

    // 1. Colonnes RAT: <Compétence>
    const ratMatch = header.match(/^(?:rat|reste\s+[àa]\s+terminaison)\s*:\s*(.+)$/i);
    if (ratMatch) {
      const sk = skillsByNameLower.get(ratMatch[1].trim().toLowerCase());
      if (sk) {
        ratColMap.push({ skill: sk, colIdx });
      }
      continue;
    }

    // 2. Colonnes Historique <YYYY-MM>: <Compétence>
    const histMatch = header.match(/^historique\s+([^:]+?)\s*:\s*(.+)$/i);
    if (histMatch) {
      const normalizedMonth = normalizePeriodKey(histMatch[1].trim());
      const sk = skillsByNameLower.get(histMatch[2].trim().toLowerCase());
      if (normalizedMonth && sk) {
        if (normalizedMonth < minAllowedMonthKey) {
          ignoredObsoleteMonthsInHeaders.add(normalizedMonth);
        } else {
          historyColMap.push({ monthKey: normalizedMonth, skill: sk, colIdx });
        }
      }
      continue;
    }

    // 3. Colonnes Staffing <YYYY-MM>: <Compétence>
    const staffMatch = header.match(/^staffing\s+([^:]+?)\s*:\s*(.+)$/i);
    if (staffMatch) {
      const normalizedMonth = normalizePeriodKey(staffMatch[1].trim());
      const sk = skillsByNameLower.get(staffMatch[2].trim().toLowerCase());
      if (normalizedMonth && sk) {
        if (normalizedMonth < minAllowedMonthKey) {
          ignoredObsoleteMonthsInHeaders.add(normalizedMonth);
        } else {
          staffingColMap.push({ monthKey: normalizedMonth, skill: sk, colIdx });
        }
      }
      continue;
    }
  }

  const hasHistoryColumns =
    historyColMap.length > 0 || ignoredObsoleteMonthsInHeaders.size > 0;
  const hasStaffingColumns =
    staffingColMap.length > 0 || ignoredObsoleteMonthsInHeaders.size > 0;
  const hasRatColumns = ratColMap.length > 0;

  const logRows: ImportLogRow[] = [];
  let successCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex];
    const rowNumber = rowIndex + 2; // 1-indexé + ligne d'en-tête
    const rowDetails: string[] = [];
    let rowHasWarnings = false;

    // 1. Nom
    const rawName = colIdxName !== -1 ? row[colIdxName]?.trim() || '' : '';
    if (!rawName) {
      errorCount++;
      logRows.push({
        rowNumber,
        projectName: '(Sans nom)',
        status: 'ERROR',
        action: 'FAILED',
        details: ['Erreur bloquante : le nom court du projet est obligatoire.'],
      });
      continue;
    }

    let projectName = rawName;
    if (projectName.length > 30) {
      projectName = projectName.slice(0, 30);
      rowHasWarnings = true;
      rowDetails.push(`Avertissement : Le nom dépassait 30 caractères, il a été tronqué à « ${projectName} »`);
    }

    // 2. Numéro
    let parsedProjectNumber: number | undefined = undefined;
    if (colIdxNumber !== -1 && row[colIdxNumber]) {
      const num = parseInt(row[colIdxNumber].trim(), 10);
      if (!isNaN(num) && num > 0) {
        parsedProjectNumber = num;
      }
    }

    // 3. Description
    const description = colIdxDesc !== -1 ? row[colIdxDesc]?.trim() || '' : '';
    let finalDesc = description;
    if (finalDesc.length > 3000) {
      finalDesc = finalDesc.slice(0, 3000);
      rowHasWarnings = true;
      rowDetails.push('Avertissement : La description dépassait 3000 caractères et a été tronquée.');
    }

    // 4. État du cycle de vie
    let stateId = '';
    let stateName = '';
    const rawState = colIdxState !== -1 ? row[colIdxState]?.trim() || '' : '';
    if (rawState) {
      const matchedState = projectStates.find(
        (s) => s.name.trim().toLowerCase() === rawState.toLowerCase()
      );
      if (matchedState) {
        stateId = matchedState.id;
        stateName = matchedState.name;
        rowDetails.push(`État : « ${matchedState.name} » (reconnu)`);
      } else {
        rowHasWarnings = true;
        const defaultState = projectStates[0];
        if (defaultState) {
          stateId = defaultState.id;
          stateName = defaultState.name;
          rowDetails.push(
            `Avertissement : État « ${rawState} » introuvable dans le référentiel. Affecté à « ${defaultState.name} » par défaut.`
          );
        } else {
          errorCount++;
          logRows.push({
            rowNumber,
            projectName,
            status: 'ERROR',
            action: 'FAILED',
            details: ['Erreur bloquante : Aucun état de cycle de vie disponible dans le référentiel.'],
          });
          continue;
        }
      }
    } else {
      const defaultState = projectStates[0];
      if (defaultState) {
        stateId = defaultState.id;
        stateName = defaultState.name;
        rowDetails.push(`État non renseigné : affecté à « ${defaultState.name} » par défaut.`);
      } else {
        errorCount++;
        logRows.push({
          rowNumber,
          projectName,
          status: 'ERROR',
          action: 'FAILED',
          details: ['Erreur bloquante : Aucun état de cycle de vie disponible dans le référentiel.'],
        });
        continue;
      }
    }

    // 5. Ligne budgétaire
    let budgetLineId = '';
    const rawBudgetLine = colIdxBudgetLine !== -1 ? row[colIdxBudgetLine]?.trim() || '' : '';
    if (rawBudgetLine) {
      const matchedBl = budgetLines.find(
        (b) => b.name.trim().toLowerCase() === rawBudgetLine.toLowerCase()
      );
      if (matchedBl) {
        budgetLineId = matchedBl.id;
        rowDetails.push(`Ligne budgétaire : « ${matchedBl.name} » (reconnue)`);
      } else {
        rowHasWarnings = true;
        const defaultBl = budgetLines[0];
        if (defaultBl) {
          budgetLineId = defaultBl.id;
          rowDetails.push(
            `Avertissement : Ligne budgétaire « ${rawBudgetLine} » introuvable. Affectée à « ${defaultBl.name} » par défaut.`
          );
        } else {
          errorCount++;
          logRows.push({
            rowNumber,
            projectName,
            status: 'ERROR',
            action: 'FAILED',
            details: ['Erreur bloquante : Aucune ligne budgétaire disponible dans le référentiel.'],
          });
          continue;
        }
      }
    } else {
      const defaultBl = budgetLines[0];
      if (defaultBl) {
        budgetLineId = defaultBl.id;
        rowDetails.push(`Ligne budgétaire non renseignée : affectée à « ${defaultBl.name} » par défaut.`);
      } else {
        errorCount++;
        logRows.push({
          rowNumber,
          projectName,
          status: 'ERROR',
          action: 'FAILED',
          details: ['Erreur bloquante : Aucune ligne budgétaire disponible dans le référentiel.'],
        });
        continue;
      }
    }

    // 6. Chef de projet
    let projectManagerEmail = currentUserEmail;
    const rawPm = colIdxPm !== -1 ? row[colIdxPm]?.trim() || '' : '';
    if (rawPm) {
      const matchedUser = users.find(
        (u) =>
          u.email.toLowerCase() === rawPm.toLowerCase() ||
          u.displayName?.trim().toLowerCase() === rawPm.toLowerCase()
      );
      if (matchedUser) {
        projectManagerEmail = matchedUser.email;
        rowDetails.push(`Chef de projet : ${matchedUser.displayName} (${matchedUser.email})`);
      } else if (rawPm.includes('@')) {
        projectManagerEmail = rawPm.toLowerCase();
        rowDetails.push(`Chef de projet : ${projectManagerEmail} (adresse email conservée)`);
      } else {
        rowHasWarnings = true;
        rowDetails.push(
          `Avertissement : Utilisateur « ${rawPm} » introuvable. Chef de projet défini sur votre compte (${currentUserEmail}).`
        );
      }
    } else {
      rowDetails.push(`Chef de projet non renseigné : défini sur votre compte (${currentUserEmail}).`);
    }

    // 7. Adjoint
    let deputyEmail: string | null = null;
    const rawDeputy = colIdxDeputy !== -1 ? row[colIdxDeputy]?.trim() || '' : '';
    if (rawDeputy) {
      const matchedUser = users.find(
        (u) =>
          u.email.toLowerCase() === rawDeputy.toLowerCase() ||
          u.displayName?.trim().toLowerCase() === rawDeputy.toLowerCase()
      );
      if (matchedUser) {
        deputyEmail = matchedUser.email;
        rowDetails.push(`Adjoint : ${matchedUser.displayName} (${matchedUser.email})`);
      } else if (rawDeputy.includes('@')) {
        deputyEmail = rawDeputy.toLowerCase();
        rowDetails.push(`Adjoint : ${deputyEmail}`);
      } else {
        rowHasWarnings = true;
        rowDetails.push(`Avertissement : Adjoint « ${rawDeputy} » introuvable, laissé vide.`);
      }
    }

    // 8. Créé par
    let createdByEmail = currentUserEmail;
    const rawCreatedBy = colIdxCreatedBy !== -1 ? row[colIdxCreatedBy]?.trim() || '' : '';
    if (rawCreatedBy && rawCreatedBy.includes('@')) {
      createdByEmail = rawCreatedBy.toLowerCase();
    }

    // 9. Confidentiel
    let isConfidential = false;
    const rawConf = colIdxConfidential !== -1 ? row[colIdxConfidential]?.trim().toLowerCase() || '' : '';
    if (['oui', 'vrai', 'true', '1', 'yes'].includes(rawConf)) {
      isConfidential = true;
    }

    // 10. Budget estimé
    let estimatedBudget = 0;
    if (colIdxBudget !== -1 && row[colIdxBudget]) {
      const parsedB = parseFloat(row[colIdxBudget].replace(',', '.').trim());
      if (!isNaN(parsedB) && parsedB >= 0) {
        estimatedBudget = parsedB;
      }
    }

    // 11. Points bonus
    let bonus: number | null = null;
    if (colIdxBonus !== -1 && row[colIdxBonus]) {
      const parsedBonus = parseInt(row[colIdxBonus].trim(), 10);
      if (!isNaN(parsedBonus)) {
        bonus = parsedBonus;
      }
    }

    // 12. Mois capacitaire (en ignorant tout mois antérieur à ce mois-ci - 12 mois)
    let capacityUpdatedMonth: string | null = null;
    if (colIdxMonth !== -1 && row[colIdxMonth]) {
      const rawM = row[colIdxMonth].trim();
      const normalized = normalizePeriodKey(rawM);
      if (normalized) {
        if (normalized < minAllowedMonthKey) {
          rowHasWarnings = true;
          rowDetails.push(
            `Avertissement : Le mois capacitaire « ${normalized} » est antérieur à ${minAllowedMonthKey} (ce mois-ci - 12 mois) et a été ignoré.`
          );
        } else {
          capacityUpdatedMonth = normalized;
        }
      }
    }

    // 13. Staffé (Capacitaire)
    let isStaffed = true;
    if (colIdxStaffed !== -1 && row[colIdxStaffed]) {
      const rawS = row[colIdxStaffed].trim().toLowerCase();
      if (['non', 'faux', 'false', '0', 'no'].includes(rawS)) {
        isStaffed = false;
      }
    } else {
      const targetStateObj = projectStates.find((s) => s.id === stateId);
      isStaffed = targetStateObj?.needsStaffing !== false;
    }

    // 14. Critères de priorisation
    const criteriaValues: Record<string, number> = {};
    let criteriaValuedCount = 0;
    for (const { criterion, colIdx } of criteriaColMap) {
      const rawVal = row[colIdx]?.trim();
      if (!rawVal) {
        criteriaValues[criterion.id] = 0;
        continue;
      }

      // Tentative de correspondance avec les libellés des échelons
      const idxLevel = criterion.levels.findIndex(
        (lvl) => lvl.trim().toLowerCase() === rawVal.toLowerCase()
      );
      if (idxLevel >= 0) {
        criteriaValues[criterion.id] = CRITERION_POINTS[idxLevel];
        criteriaValuedCount++;
      } else {
        // Tentative d'interpréter un nombre de points direct (0, 1, 2, 3, 5, 8)
        const parsedPoint = parseInt(rawVal, 10);
        if (
          !isNaN(parsedPoint) &&
          (CRITERION_POINTS as readonly number[]).includes(parsedPoint as any)
        ) {
          criteriaValues[criterion.id] = parsedPoint;
          criteriaValuedCount++;
        } else {
          rowHasWarnings = true;
          criteriaValues[criterion.id] = 0;
          rowDetails.push(
            `Avertissement : Échelon « ${rawVal} » non reconnu pour le critère « ${criterion.name} ». Point 0 appliqué.`
          );
        }
      }
    }

    // S'assurer que tous les critères définis ont une valeur (0 par défaut si non renseigné)
    for (const crit of criteria) {
      if (criteriaValues[crit.id] === undefined) {
        criteriaValues[crit.id] = 0;
      }
    }
    rowDetails.push(`Critères valorisés : ${criteriaValuedCount}/${criteria.length}`);

    // 15. Paramètres personnalisés
    const customParamValues: Record<string, any> = {};
    let paramsValuedCount = 0;
    for (const { param, colIdx } of customParamsColMap) {
      const rawVal = row[colIdx]?.trim();
      if (rawVal === undefined || rawVal === '') {
        continue;
      }

      paramsValuedCount++;
      if (param.type === 'case à cocher') {
        customParamValues[param.id] = ['oui', 'vrai', 'true', '1', 'x'].includes(rawVal.toLowerCase());
      } else if (param.type === 'nombre entier') {
        const parsed = parseInt(rawVal, 10);
        customParamValues[param.id] = isNaN(parsed) ? null : parsed;
      } else if (param.type === 'nombre avec 2 décimales') {
        const parsed = parseFloat(rawVal.replace(',', '.'));
        customParamValues[param.id] = isNaN(parsed) ? null : parsed;
      } else if (param.type === 'liste de valeurs' && param.allowMultiple) {
        const items = rawVal.split(',').map((s) => s.trim()).filter(Boolean);
        customParamValues[param.id] = items;
      } else {
        customParamValues[param.id] = rawVal;
      }
    }
    if (customParams.length > 0) {
      rowDetails.push(`Paramètres personnalisés valorisés : ${paramsValuedCount}/${customParams.length}`);
    }

    // 16. Compétences clés (mois à venir)
    const capacityDaysPerSkill: Record<string, number | null> = {};
    let skillsValuedCount = 0;
    for (const { skill, colIdx } of skillsColMap) {
      const rawVal = row[colIdx]?.trim();
      if (!rawVal) continue;
      const parsedDays = parseFloat(rawVal.replace(',', '.'));
      if (!isNaN(parsedDays) && parsedDays >= 0) {
        capacityDaysPerSkill[skill.id] = Math.round(parsedDays * 10) / 10;
        skillsValuedCount++;
      } else {
        rowHasWarnings = true;
        rowDetails.push(
          `Avertissement : Valeur invalide « ${rawVal} » pour la compétence « ${skill.name} » (ignorée).`
        );
      }
    }
    if (skills.length > 0) {
      rowDetails.push(`Besoins en compétences clés renseignés : ${skillsValuedCount}`);
    }

    // 16b. Mois staffing validés, RAT validé et Mois validation RAT
    const ignoredRowObsoleteMonths = new Set<string>(ignoredObsoleteMonthsInHeaders);
    const importedValidatedMonths: Record<string, boolean> = {};
    if (colIdxValidatedMonths !== -1 && row[colIdxValidatedMonths]) {
      const tokens = row[colIdxValidatedMonths]
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const tok of tokens) {
        const normM = normalizePeriodKey(tok);
        if (normM) {
          if (normM < minAllowedMonthKey) {
            ignoredRowObsoleteMonths.add(normM);
          } else {
            importedValidatedMonths[normM] = true;
          }
        }
      }
    }

    let importedIsRatValidated: boolean | undefined = undefined;
    if (colIdxRatValidated !== -1 && row[colIdxRatValidated]) {
      const rawRatVal = row[colIdxRatValidated].trim().toLowerCase();
      if (['oui', 'vrai', 'true', '1', 'yes'].includes(rawRatVal)) {
        importedIsRatValidated = true;
        importedValidatedMonths['rat'] = true;
      } else if (['non', 'faux', 'false', '0', 'no'].includes(rawRatVal)) {
        importedIsRatValidated = false;
        importedValidatedMonths['rat'] = false;
      }
    }

    let importedRatValidatedMonth: string | null | undefined = undefined;
    if (colIdxRatValidatedMonth !== -1) {
      const rawRatMonth = row[colIdxRatValidatedMonth]?.trim() || '';
      if (rawRatMonth) {
        const normRatMonth = normalizePeriodKey(rawRatMonth);
        if (normRatMonth) {
          if (normRatMonth < minAllowedMonthKey) {
            ignoredRowObsoleteMonths.add(normRatMonth);
            importedRatValidatedMonth = null;
          } else {
            importedRatValidatedMonth = normRatMonth;
          }
        }
      } else {
        importedRatValidatedMonth = null;
      }
    }

    // 16c. Reste à Terminaison (RAT) par compétence
    const importedRat: Record<string, number | null> = {};
    let ratSkillsValuedCount = 0;
    for (const { skill, colIdx } of ratColMap) {
      const rawVal = row[colIdx]?.trim();
      if (!rawVal) continue;
      const parsedDays = parseFloat(rawVal.replace(',', '.'));
      if (!isNaN(parsedDays) && parsedDays >= 0) {
        importedRat[skill.id] = Math.round(parsedDays * 10) / 10;
        ratSkillsValuedCount++;
      } else {
        rowHasWarnings = true;
        rowDetails.push(
          `Avertissement : Valeur RAT invalide « ${rawVal} » pour la compétence « ${skill.name} » (ignorée).`
        );
      }
    }
    if (hasRatColumns) {
      rowDetails.push(`Reste à Terminaison (RAT) renseigné : ${ratSkillsValuedCount} compétence(s)`);
    }

    // 16d. Historique capacitaire des 12 derniers mois (uniquement >= minAllowedMonthKey)
    const rawHistoryByMonth: Record<string, Record<string, number>> = {};
    const historyHasNumericValueByMonth: Record<string, boolean> = {};
    for (const { monthKey, skill, colIdx } of historyColMap) {
      const rawVal = row[colIdx]?.trim();
      if (!rawVal) continue;
      const parsedDays = parseFloat(rawVal.replace(',', '.'));
      if (!isNaN(parsedDays) && parsedDays >= 0) {
        if (!rawHistoryByMonth[monthKey]) {
          rawHistoryByMonth[monthKey] = {};
        }
        rawHistoryByMonth[monthKey][skill.id] = Math.round(parsedDays * 10) / 10;
        historyHasNumericValueByMonth[monthKey] = true;
      } else {
        rowHasWarnings = true;
        rowDetails.push(
          `Avertissement : Valeur historique invalide « ${rawVal} » pour ${monthKey} / « ${skill.name} » (ignorée).`
        );
      }
    }

    const importedHistory: Record<string, Record<string, number>> = {};
    for (const [mKey, skillMap] of Object.entries(rawHistoryByMonth)) {
      if (!historyHasNumericValueByMonth[mKey] || mKey < minAllowedMonthKey) continue;
      const completedMonthMap: Record<string, number> = {};
      for (const sk of skills) {
        completedMonthMap[sk.id] = skillMap[sk.id] !== undefined ? skillMap[sk.id] : 0;
      }
      importedHistory[mKey] = completedMonthMap;
    }

    // 16e. Plan de staffing des 12 prochains mois (uniquement >= minAllowedMonthKey)
    const importedStaffingPlan: Record<string, Record<string, number | null>> = {};
    for (const { monthKey, skill, colIdx } of staffingColMap) {
      if (monthKey < minAllowedMonthKey) continue;
      const rawVal = row[colIdx]?.trim();
      if (!rawVal) continue;
      const parsedDays = parseFloat(rawVal.replace(',', '.'));
      if (!isNaN(parsedDays) && parsedDays >= 0) {
        if (!importedStaffingPlan[monthKey]) {
          importedStaffingPlan[monthKey] = {};
        }
        importedStaffingPlan[monthKey][skill.id] = Math.round(parsedDays * 10) / 10;
      } else {
        rowHasWarnings = true;
        rowDetails.push(
          `Avertissement : Valeur de staffing invalide « ${rawVal} » pour ${monthKey} / « ${skill.name} » (ignorée).`
        );
      }
    }

    // Synchronisation entre Compétence (mois à venir) et Staffing Plan
    if (importedStaffingPlan[nextMonthKey]) {
      for (const [skillId, daysVal] of Object.entries(importedStaffingPlan[nextMonthKey])) {
        if (
          daysVal !== null &&
          daysVal !== undefined &&
          capacityDaysPerSkill[skillId] === undefined
        ) {
          capacityDaysPerSkill[skillId] = daysVal;
        }
      }
      if (!capacityUpdatedMonth) {
        capacityUpdatedMonth = nextMonthKey;
      }
    }
    const targetSyncMonth = capacityUpdatedMonth || (Object.keys(capacityDaysPerSkill).length > 0 ? nextMonthKey : null);
    if (targetSyncMonth && targetSyncMonth >= minAllowedMonthKey && Object.keys(capacityDaysPerSkill).length > 0) {
      if (!importedStaffingPlan[targetSyncMonth]) {
        importedStaffingPlan[targetSyncMonth] = {};
      }
      for (const [skillId, daysVal] of Object.entries(capacityDaysPerSkill)) {
        if (
          daysVal !== null &&
          daysVal !== undefined &&
          importedStaffingPlan[targetSyncMonth][skillId] === undefined
        ) {
          importedStaffingPlan[targetSyncMonth][skillId] = daysVal;
        }
      }
    }

    // Si le fichier a été exporté il y a plus d'un mois, les anciens mois du plan de staffing devenus passés
    // (tout en restant >= ce mois-ci - 12 mois) doivent également alimenter l'historique s'ils n'y figurent pas déjà
    for (const [mKey, skillMap] of Object.entries(importedStaffingPlan)) {
      if (mKey >= minAllowedMonthKey && mKey < currentMonthKey && !importedHistory[mKey]) {
        const hasPositiveDemand = Object.values(skillMap).some((v) => typeof v === 'number' && v > 0);
        if (isStaffed !== false && (hasPositiveDemand || importedValidatedMonths[mKey])) {
          const backfillMonth: Record<string, number> = {};
          for (const sk of skills) {
            const v = skillMap[sk.id];
            backfillMonth[sk.id] = typeof v === 'number' && !isNaN(v) && v >= 0 ? v : 0;
          }
          importedHistory[mKey] = backfillMonth;
        }
      }
    }

    const importedHistoryCount = Object.keys(importedHistory).length;
    const importedStaffingCount = Object.keys(importedStaffingPlan).length;
    if (hasHistoryColumns || importedHistoryCount > 0) {
      rowDetails.push(`Historique capacitaire importé : ${importedHistoryCount} mois (seuil >= ${minAllowedMonthKey})`);
    }
    if (hasStaffingColumns || importedStaffingCount > 0) {
      rowDetails.push(`Plan de staffing importé : ${importedStaffingCount} mois (seuil >= ${minAllowedMonthKey})`);
    }
    if (ignoredRowObsoleteMonths.size > 0) {
      const sortedIgnored = Array.from(ignoredRowObsoleteMonths).sort();
      rowDetails.push(
        `Mois antérieurs à ${minAllowedMonthKey} (ce mois-ci - 12 mois) ignorés : ${sortedIgnored.join(', ')}`
      );
    }

    // 17. Calcul automatique du ROI
    const computedRoi = calculateProjectRoi(
      criteriaValues,
      criteria,
      true,
      bonus,
      bonusConfig?.isBonusActive ?? true
    );

    // 18. Recherche d'un projet existant si mise à jour autorisée
    let existingProj: Project | undefined = undefined;
    if (mode === 'update_or_create' && parsedProjectNumber) {
      existingProj = currentProjects.find((p) => p.projectNumber === parsedProjectNumber);
    }

    // Fusion prudente des structures capacitaires lors d'une mise à jour (ne pas écraser si CSV ancien format)
    const finalCapacityHistory =
      hasHistoryColumns || Object.keys(importedHistory).length > 0
        ? {
            ...(existingProj?.capacityHistory || {}),
            ...importedHistory,
          }
        : existingProj
        ? undefined
        : {};

    const finalStaffingPlan =
      hasStaffingColumns || Object.keys(importedStaffingPlan).length > 0
        ? {
            ...(existingProj?.staffingPlan || {}),
            ...importedStaffingPlan,
          }
        : existingProj
        ? undefined
        : {};

    const finalRemainingToComplete = hasRatColumns
      ? importedRat
      : existingProj
      ? undefined
      : {};

    const hasValidatedMetaColumns =
      colIdxValidatedMonths !== -1 || colIdxRatValidated !== -1;
    const finalStaffingPlanValidatedMonths = hasValidatedMetaColumns
      ? {
          ...(existingProj?.staffingPlanValidatedMonths || {}),
          ...importedValidatedMonths,
        }
      : existingProj
      ? undefined
      : {};

    // 19. Construction du payload de projet
    const formData: ProjectFormData = {
      name: projectName,
      stateId,
      stateName,
      description: finalDesc,
      createdByEmail,
      projectManagerEmail,
      deputyEmail,
      isConfidential,
      budgetLineId,
      estimatedBudget,
      criteriaValues,
      bonus,
      roi: computedRoi,
      customParamValues,
      capacityUpdatedMonth,
      capacityDaysPerSkill,
      ...(finalCapacityHistory !== undefined ? { capacityHistory: finalCapacityHistory } : {}),
      ...(finalStaffingPlan !== undefined ? { staffingPlan: finalStaffingPlan } : {}),
      ...(finalRemainingToComplete !== undefined
        ? { remainingToComplete: finalRemainingToComplete }
        : {}),
      ...(finalStaffingPlanValidatedMonths !== undefined
        ? { staffingPlanValidatedMonths: finalStaffingPlanValidatedMonths }
        : {}),
      ...(importedIsRatValidated !== undefined
        ? { isRatValidated: importedIsRatValidated }
        : existingProj
        ? {}
        : { isRatValidated: false }),
      ...(importedRatValidatedMonth !== undefined
        ? { ratValidatedMonth: importedRatValidatedMonth }
        : existingProj
        ? {}
        : { ratValidatedMonth: null }),
      isStaffed,
    };

    // 20. Persistance Firestore : mise à jour ou création
    try {
      if (existingProj) {
        await updateProject(existingProj.id, formData);
        successCount++;
        if (rowHasWarnings) warningCount++;
        logRows.push({
          rowNumber,
          projectNumber: existingProj.projectNumber,
          projectName,
          status: rowHasWarnings ? 'WARNING' : 'SUCCESS',
          action: 'UPDATED',
          details: [
            `Projet #${existingProj.projectNumber} existant mis à jour avec succès.`,
            ...rowDetails,
          ],
        });
      } else {
        const created = await createProject(formData);
        successCount++;
        if (rowHasWarnings) warningCount++;
        logRows.push({
          rowNumber,
          projectNumber: created.projectNumber,
          projectName,
          status: rowHasWarnings ? 'WARNING' : 'SUCCESS',
          action: 'CREATED',
          details: [
            `Nouveau projet #${created.projectNumber} créé avec succès.`,
            ...rowDetails,
          ],
        });
      }
    } catch (err) {
      errorCount++;
      const errMsg = err instanceof Error ? err.message : String(err);
      logRows.push({
        rowNumber,
        projectNumber: parsedProjectNumber,
        projectName,
        status: 'ERROR',
        action: 'FAILED',
        details: [`Erreur Firestore lors de la sauvegarde : ${errMsg}`, ...rowDetails],
      });
    }
  }

  // 20. Synthèse du journal d'importation au format texte
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const logLines: string[] = [
    '======================================================================',
    'JOURNAL D\'AUDIT D\'IMPORTATION DES PROJETS - OPAC',
    `Date et heure : ${dateStr} à ${timeStr}`,
    `Utilisateur exécutant : ${currentUserEmail}`,
    `Mode d'importation : ${
      mode === 'update_or_create'
        ? 'Mise à jour des projets existants (par N°) et création des nouveaux'
        : 'Création systématique de nouveaux projets'
    }`,
    '======================================================================',
    '',
    'RÉSUMÉ STATISTIQUE :',
    `- Lignes traitées dans le fichier : ${dataRows.length}`,
    `- Projets enregistrés avec succès : ${successCount}`,
    `- Projets avec avertissements : ${warningCount}`,
    `- Projets en échec : ${errorCount}`,
    '',
    '======================================================================',
    'DÉTAIL CHRONOLOGIQUE DES LIGNES :',
    '======================================================================',
    '',
  ];

  for (const logRow of logRows) {
    const statusLabel =
      logRow.status === 'SUCCESS'
        ? '[SUCCÈS]'
        : logRow.status === 'WARNING'
        ? '[AVERTISSEMENT]'
        : '[ÉCHEC]';

    const pNum = logRow.projectNumber ? `#${logRow.projectNumber} ` : '';
    logLines.push(`Ligne ${logRow.rowNumber} : ${statusLabel} Projet ${pNum}« ${logRow.projectName} »`);
    for (const d of logRow.details) {
      logLines.push(`  • ${d}`);
    }
    logLines.push('');
  }

  logLines.push('======================================================================');
  logLines.push('FIN DU JOURNAL D\'IMPORTATION');
  logLines.push('======================================================================');

  const logContent = logLines.join('\r\n');

  return {
    totalRows: dataRows.length,
    successCount,
    warningCount,
    errorCount,
    logRows,
    logContent,
  };
}

/**
 * Supprime tous les projets passés en paramètre.
 */
export async function deleteAllProjects(projects: Project[]): Promise<number> {
  let count = 0;
  for (const p of projects) {
    await deleteProject(p.id);
    count++;
  }
  return count;
}
