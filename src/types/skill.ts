export interface SkillBudgetAllocation {
  budgetLineId: string;
  budgetLineName: string;
  percentage: number;
}

export interface KeySkill {
  id: string;
  name: string;
  resourceManagerId: string;
  resourceManagerName: string;
  description?: string;
  isCapped: boolean; // true = capée par ligne budgétaire, false = non capée par ligne budgétaire
  budgetAllocations: SkillBudgetAllocation[];
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export type KeySkillFormData = Omit<KeySkill, 'id' | 'createdAt' | 'updatedAt'>;
