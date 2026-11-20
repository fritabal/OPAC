export type CustomParamType =
  | 'texte court'
  | 'texte long'
  | 'date'
  | 'nombre entier'
  | 'nombre avec 2 décimales'
  | 'case à cocher'
  | 'liste de valeurs';

export const DEFAULT_LONG_TEXT_MAX_LENGTH = 1000;

export interface CustomProjectParam {
  id: string;
  name: string; // Clé unique, max 30 caractères
  description: string; // Max 500 caractères
  type: CustomParamType;
  maxLength?: number; // Pour 'texte long' : nombre max de caractères (défaut 1000)
  order: number;
  options?: string[]; // Pour 'liste de valeurs' : valeurs prédéfinies
  allowMultiple?: boolean; // Pour 'liste de valeurs' : false = choix unique, true = choix multiple
  isRequired?: boolean; // Attribut "obligatoire" (case à cocher)
  showInTable?: boolean; // Attribut "Affiché dans le tableau" (case à cocher)
  createdAt?: string;
  updatedAt?: string;
}

export function getCustomParamMaxLength(
  param?: Pick<CustomProjectParam, 'type' | 'maxLength'> | null
): number {
  if (!param || param.type !== 'texte long') return DEFAULT_LONG_TEXT_MAX_LENGTH;
  const val = Number(param.maxLength);
  return Number.isFinite(val) && val >= 1 ? Math.round(val) : DEFAULT_LONG_TEXT_MAX_LENGTH;
}

export type CustomProjectParamFormData = Omit<CustomProjectParam, 'id' | 'createdAt' | 'updatedAt'>;

export const CUSTOM_PARAM_TYPES: CustomParamType[] = [
  'texte court',
  'texte long',
  'date',
  'nombre entier',
  'nombre avec 2 décimales',
  'case à cocher',
  'liste de valeurs',
];

export const CUSTOM_PARAM_TYPE_LABELS: Record<CustomParamType, string> = {
  'texte court': 'Texte court (50 car. max)',
  'texte long': 'Texte long enrichi',
  date: 'Date',
  'nombre entier': 'Nombre entier',
  'nombre avec 2 décimales': 'Nombre avec 2 décimales',
  'case à cocher': 'Case à cocher (Vrai / Faux)',
  'liste de valeurs': 'Liste de valeurs prédéfinies',
};

export const CUSTOM_PARAM_TYPE_DESCRIPTIONS: Record<CustomParamType, string> = {
  'texte court': 'Saisie d’une ligne textuelle concise (50 caractères maximum).',
  'texte long': 'Zone textuelle détaillée à saisie directe ou via la fenêtre de mise en page enrichie (nombre max de caractères configurable).',
  date: 'Sélecteur de date calendaire (JJ/MM/AAAA).',
  'nombre entier': 'Valeur numérique entière sans décimale (ex : 42, 100).',
  'nombre avec 2 décimales': 'Montant ou ratio avec 2 chiffres après la virgule (ex : 12.50).',
  'case à cocher': 'Attribut booléen activable ou désactivable par case à cocher (Vrai / Faux).',
  'liste de valeurs': 'Sélection parmi des valeurs prédéfinies (choix unique ou choix multiple).',
};
