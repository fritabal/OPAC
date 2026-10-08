export type CriterionType = 'VALEUR' | 'COÛT';

export const CRITERION_POINTS = [0, 1, 2, 3, 5, 8] as const;

export const CRITERION_WEIGHTS = [1, 2, 3, 5, 8, 13] as const;
export type CriterionWeight = (typeof CRITERION_WEIGHTS)[number];

export interface Criterion {
  id: string;
  name: string;
  type: CriterionType;
  weight: CriterionWeight;
  isActive: boolean;
  levels: [string, string, string, string, string, string];
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export type CriterionFormData = Omit<Criterion, 'id' | 'createdAt' | 'updatedAt'>;
