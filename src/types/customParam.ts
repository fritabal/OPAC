export type CustomParamType =
  | 'texte court'
  | 'texte long'
  | 'date'
  | 'nombre entier'
  | 'nombre avec 2 décimales';

export interface CustomProjectParam {
  id: string;
  name: string; // Clé unique, max 30 caractères
  description: string; // Max 100 caractères
  type: CustomParamType;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export type CustomProjectParamFormData = Omit<CustomProjectParam, 'id' | 'createdAt' | 'updatedAt'>;

export const CUSTOM_PARAM_TYPES: CustomParamType[] = [
  'texte court',
  'texte long',
  'date',
  'nombre entier',
  'nombre avec 2 décimales',
];

export const CUSTOM_PARAM_TYPE_LABELS: Record<CustomParamType, string> = {
  'texte court': 'Texte court (50 car. max)',
  'texte long': 'Texte long (1000 car. max)',
  date: 'Date',
  'nombre entier': 'Nombre entier',
  'nombre avec 2 décimales': 'Nombre avec 2 décimales',
};

export const CUSTOM_PARAM_TYPE_DESCRIPTIONS: Record<CustomParamType, string> = {
  'texte court': 'Saisie d’une ligne textuelle concise (50 caractères maximum).',
  'texte long': 'Zone textuelle détaillée avec mini-fenêtre de saisie (1000 caractères maximum).',
  date: 'Sélecteur de date calendaire (JJ/MM/AAAA).',
  'nombre entier': 'Valeur numérique entière sans décimale (ex : 42, 100).',
  'nombre avec 2 décimales': 'Montant ou ratio avec 2 chiffres après la virgule (ex : 12.50).',
};
