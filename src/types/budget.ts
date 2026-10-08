export interface BudgetLine {
  id: string;
  name: string;
  budgetKe: number;
  manager: string;
  color: string;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export type BudgetLineFormData = Omit<BudgetLine, 'id' | 'createdAt' | 'updatedAt'>;
