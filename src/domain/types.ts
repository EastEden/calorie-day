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

/**
 * Locale-tagged text. `zh-CN` is the required fallback and is enforced by
 * validation for food names. Additional BCP 47-like locale keys are allowed.
 */
export type LocalizedText = Record<string, string> & {
  'zh-CN': string;
};

export interface MealPrepBatchComponent {
  foodId?: string;
  names: LocalizedText;
  totalGrams: number;
  nutritionPer100g: Nutrition;
}

export interface MealPrepBatchMeta {
  totalGrams: number;
  portionGrams: number;
  portions?: number;
  components?: MealPrepBatchComponent[];
  sourceFoodId?: string;
  disposedAt?: string;
}

export interface MealPrepBatchInput {
  name: string;
  components: { food: Food; grams: number }[];
  portions: number;
}

export interface Food {
  id: string;
  names: LocalizedText;
  category: FoodCategory;
  basis: FoodBasis;
  nutritionPer100g: Nutrition;
  servings: ServingOption[];
  /**
   * Optional batch metadata. A food with this field represents a large dish
   * cooked once and eaten over several meals. Remaining grams are derived from
   * all logged entries for the food, so editing/deleting entries stays exact.
   */
  batch?: MealPrepBatchMeta;
  source: FoodSource;
  createdAt: string;
  updatedAt: string;
}

export interface FoodEntryBatchComponent {
  names: LocalizedText;
  totalGrams: number;
}

export interface FoodEntry {
  id: string;
  foodId: string;
  /**
   * Snapshot of the food's localized names at the time it was logged.
   * This keeps historical entries stable when the food library changes.
   */
  foodNames: LocalizedText;
  batchComponents?: FoodEntryBatchComponent[];
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
  /**
   * Frozen target and profile weight at the time the day was first written.
   * Historical days keep these snapshots when the current weight changes.
   */
  targetSnapshot?: Nutrition | null;
  weightKgSnapshot?: number | null;
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
  names: LocalizedText;
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

/**
 * Full local backup. Contains the complete food library and a selectable
 * slice of daily logs; profile/settings are optional so older or partial
 * backups can still be read.
 */
export interface BackupPayload {
  backupVersion: 1;
  exportedAt: string;
  logsFrom: IsoDate | null;
  logsTo: IsoDate | null;
  profile: UserProfile | null;
  targetSettings: TargetSettings | null;
  foods: Food[];
  logs: DailyLog[];
}

export interface BackupImportResult {
  foodsAdded: number;
  foodsSkipped: number;
  logsAdded: number;
  logsSkipped: number;
  profileImported: boolean;
  settingsImported: boolean;
}

export interface ImportedFoodInput {
  id?: string;
  names: LocalizedText;
  category: FoodCategory;
  basis: FoodBasis;
  nutritionPer100g: Nutrition;
  servings?: {
    id?: string;
    label: string;
    grams: number;
  }[];
  batch?: MealPrepBatchMeta;
}
