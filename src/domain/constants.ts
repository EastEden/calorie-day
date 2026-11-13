import type { TranslationKey } from '../i18n/core';
import type {
  ActivityLevel,
  FoodBasis,
  FoodCategory,
  FoodSource,
  Goal,
  MealType,
  Sex,
} from './types';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_META: Record<
  MealType,
  {
    labelKey: TranslationKey;
    shortLabelKey: TranslationKey;
    subtitleKey: TranslationKey;
    emptyHintKey: TranslationKey;
  }
> = {
  breakfast: {
    labelKey: 'meals.breakfast.label',
    shortLabelKey: 'meals.breakfast.short',
    subtitleKey: 'meals.breakfast.subtitle',
    emptyHintKey: 'meals.breakfast.empty',
  },
  lunch: {
    labelKey: 'meals.lunch.label',
    shortLabelKey: 'meals.lunch.short',
    subtitleKey: 'meals.lunch.subtitle',
    emptyHintKey: 'meals.lunch.empty',
  },
  dinner: {
    labelKey: 'meals.dinner.label',
    shortLabelKey: 'meals.dinner.short',
    subtitleKey: 'meals.dinner.subtitle',
    emptyHintKey: 'meals.dinner.empty',
  },
  snack: {
    labelKey: 'meals.snack.label',
    shortLabelKey: 'meals.snack.short',
    subtitleKey: 'meals.snack.subtitle',
    emptyHintKey: 'meals.snack.empty',
  },
};

export const FOOD_CATEGORIES: FoodCategory[] = [
  'protein',
  'staple',
  'egg_dairy_soy',
  'vegetable',
  'fruit',
  'fat_nut_condiment',
  'other',
];

export const FOOD_CATEGORY_LABEL_KEYS: Record<FoodCategory, TranslationKey> = {
  protein: 'food.category.protein',
  staple: 'food.category.staple',
  egg_dairy_soy: 'food.category.egg_dairy_soy',
  vegetable: 'food.category.vegetable',
  fruit: 'food.category.fruit',
  fat_nut_condiment: 'food.category.fat_nut_condiment',
  other: 'food.category.other',
};

export const FOOD_BASIS_LABEL_KEYS: Record<FoodBasis, TranslationKey> = {
  raw: 'food.basis.raw',
  dry: 'food.basis.dry',
  as_sold: 'food.basis.as_sold',
};

export const FOOD_SOURCE_LABEL_KEYS: Record<FoodSource, TranslationKey> = {
  builtin: 'food.source.builtin',
  custom: 'food.source.custom',
  imported: 'food.source.imported',
};

export const SEX_OPTIONS: { value: Sex; labelKey: TranslationKey }[] = [
  { value: 'female', labelKey: 'sex.female' },
  { value: 'male', labelKey: 'sex.male' },
];

export const ACTIVITY_LEVELS: {
  value: ActivityLevel;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  factor: number;
  proteinFactor: number;
}[] = [
  {
    value: 'sedentary',
    labelKey: 'activity.sedentary.label',
    descriptionKey: 'activity.sedentary.description',
    factor: 1.2,
    proteinFactor: 1.0,
  },
  {
    value: 'light',
    labelKey: 'activity.light.label',
    descriptionKey: 'activity.light.description',
    factor: 1.375,
    proteinFactor: 1.2,
  },
  {
    value: 'moderate',
    labelKey: 'activity.moderate.label',
    descriptionKey: 'activity.moderate.description',
    factor: 1.55,
    proteinFactor: 1.4,
  },
  {
    value: 'active',
    labelKey: 'activity.active.label',
    descriptionKey: 'activity.active.description',
    factor: 1.725,
    proteinFactor: 1.6,
  },
  {
    value: 'very_active',
    labelKey: 'activity.very_active.label',
    descriptionKey: 'activity.very_active.description',
    factor: 1.9,
    proteinFactor: 1.8,
  },
];

export const GOALS: {
  value: Goal;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  factor: number;
}[] = [
  {
    value: 'lose',
    labelKey: 'goal.lose.label',
    descriptionKey: 'goal.lose.description',
    factor: 0.85,
  },
  {
    value: 'maintain',
    labelKey: 'goal.maintain.label',
    descriptionKey: 'goal.maintain.description',
    factor: 1,
  },
  {
    value: 'gain',
    labelKey: 'goal.gain.label',
    descriptionKey: 'goal.gain.description',
    factor: 1.1,
  },
];
