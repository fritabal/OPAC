import { Project, ProjectFormData } from '../types/project';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { Criterion, CRITERION_POINTS } from '../types/criteria';
import { CustomProjectParam } from '../types/customParam';
import { KeySkill } from '../types/skill';
import { AppUser } from '../types/user';
import { BonusConfig } from '../types/bonus';
import { calculateProjectRoi } from '../utils/roiCalculator';
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

/**
 * Exporte tous les projets au format CSV avec séparateur '|'
 * et clés visibles humaines (noms de critères, lignes, états, compétences, etc.).
 */
export function exportProjectsToCsv(projects: Project[], refs: ReferenceData): string {
  const { projectStates, budgetLines, criteria, customParams, skills } = refs;

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

  // Besoins en compétences clés
  for (const sk of skills) {
    headers.push(`Compétence: ${sk.name}`);
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

    // Compétences clés (jours demandés)
    for (const sk of skills) {
      const days = p.capacityDaysPerSkill?.[sk.id];
      if (days !== undefined && days !== null) {
        row.push(String(days));
      } else {
        row.push('');
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
export function generateProjectsCsvTemplate(refs: ReferenceData): string {
  const { projectStates, budgetLines, criteria, customParams, skills } = refs;

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
    '2026-11',
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
  for (const sk of skills) {
    sampleRow.push('10');
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
  currentUserEmail: string
): Promise<ImportResult> {
  const { projectStates, budgetLines, criteria, customParams, skills, users, bonusConfig } = refs;

  const parsedMatrix = parseCsvPipe(csvText);
  if (parsedMatrix.length < 2) {
    throw new Error('Le fichier CSV est vide ou ne contient aucune ligne de données.');
  }

  const rawHeaders = parsedMatrix[0];
  const dataRows = parsedMatrix.slice(1);

  // Normalisation des en-têtes
  const cleanHeaders = rawHeaders.map((h) => h.trim().toLowerCase());

  // Index des colonnes standard
  const findHeaderIdx = (patterns: string[]): number => {
    return cleanHeaders.findIndex((h) =>
      patterns.some((p) => h === p || h.startsWith(p + ' ') || h.startsWith(p + ':'))
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
  const colIdxMonth = findHeaderIdx(['mois capacitaire', 'mois de mise à jour', 'mois']);
  const colIdxStaffed = findHeaderIdx(['staffé', 'staffe', 'staffé (capacitaire)', 'staffing']);

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

  // Rapprochement des colonnes Compétences clés
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

    // 12. Mois capacitaire
    let capacityUpdatedMonth: string | null = null;
    if (colIdxMonth !== -1 && row[colIdxMonth]) {
      const rawM = row[colIdxMonth].trim();
      if (/^\d{4}-\d{2}$/.test(rawM)) {
        capacityUpdatedMonth = rawM;
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

    // 16. Compétences clés
    const capacityDaysPerSkill: Record<string, number | null> = {};
    let skillsValuedCount = 0;
    for (const { skill, colIdx } of skillsColMap) {
      const rawVal = row[colIdx]?.trim();
      if (!rawVal) continue;
      const parsedDays = parseFloat(rawVal.replace(',', '.'));
      if (!isNaN(parsedDays) && parsedDays >= 0) {
        capacityDaysPerSkill[skill.id] = parsedDays;
        skillsValuedCount++;
      }
    }
    if (skills.length > 0) {
      rowDetails.push(`Besoins en compétences clés renseignés : ${skillsValuedCount}`);
    }

    // 17. Calcul automatique du ROI
    const computedRoi = calculateProjectRoi(
      criteriaValues,
      criteria,
      true,
      bonus,
      bonusConfig?.isBonusActive ?? true
    );

    // 18. Construction du payload de projet
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
      isStaffed,
    };

    // 19. Persistance Firestore : mise à jour ou création
    try {
      let isUpdate = false;
      let existingProj: Project | undefined = undefined;

      if (mode === 'update_or_create' && parsedProjectNumber) {
        existingProj = currentProjects.find((p) => p.projectNumber === parsedProjectNumber);
      }

      if (existingProj) {
        isUpdate = true;
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
