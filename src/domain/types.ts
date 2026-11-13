export type IsoDate = string;

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type FoodCategory =
  | 'protein'
  | 'staple'
  | 'egg_dairy_soy'
  | 'vegetable'
  | 'fruit'
  | 'fat_nut_condiment'
  | 'other';

/**
 * v1 uses uncooked/dry/as-sold reference weights.
 * A cooked basis can be added in a future schema version.
 */
export type FoodBasis = 'raw' | 'dry' | 'as_sold';

export type FoodSource = 'builtin' | 'custom' | 'imported';

export type EntryUnit = 'g' | 'serving';

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type Goal = 'lose' | 'maintain' | 'gain';

export type TargetMode = 'auto' | 'manual';

export interface Nutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ServingOption {
  id: string;
  label: string;
  grams: number;
}

export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  basis: FoodBasis;
  nutritionPer100g: Nutrition;
  servings: ServingOption[];
  source: FoodSource;
  createdAt: string;
  updatedAt: string;
}

export interface FoodEntry {
  id: string;
  foodId: string;
  foodName: string;
  amountGrams: number;
  enteredQuantity: number;
  enteredUnit: EntryUnit;
  servingLabel?: string;
  servingGrams?: number;
  nutritionPer100gSnapshot: Nutrition;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLog {
  id: string;
  date: IsoDate;
  meals: Record<MealType, FoodEntry[]>;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  updatedAt: string;
}

export interface TargetSettings {
  mode: TargetMode;
  manual: Nutrition | null;
  updatedAt: string;
}

export type ProfileInput = Omit<UserProfile, 'updatedAt'>;

export type TargetSettingsInput = Pick<TargetSettings, 'mode' | 'manual'>;

export interface FoodDraft {
  name: string;
  category: FoodCategory;
  basis: FoodBasis;
  nutritionPer100g: Nutrition;
  servings: {
    label: string;
    grams: number;
  }[];
}

export interface CalculatedTargets {
  target: Nutrition;
  bmr: number;
  tdee: number;
  goalFactor: number;
}

export interface MacroEnergyBreakdown {
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  totalKcal: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
}

export interface MealSummary {
  totals: Nutrition;
  entryCount: number;
}

export interface DaySummary {
  totals: Nutrition;
  target: Nutrition | null;
  remainingKcal: number | null;
  calorieProgress: number;
  macroEnergy: MacroEnergyBreakdown;
  byMeal: Record<MealType, MealSummary>;
  entryCount: number;
}

export interface StorageInfo {
  persisted: boolean;
  supported: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export interface ImportedFoodInput {
  id?: string;
  name: string;
  category: FoodCategory;
  basis: FoodBasis;
  nutritionPer100g: Nutrition;
  servings?: {
    id?: string;
    label: string;
    grams: number;
  }[];
}
