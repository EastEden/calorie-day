import { addNutrition } from './nutrition';
import type { Nutrition } from './types';

export type QuickCoffeeAddonKey =
  | 'milk'
  | 'sugar'
  | 'sweetener'
  | 'cream';

export interface QuickCoffeeAddon {
  key: QuickCoffeeAddonKey;
  grams: number;
  nutrition: Nutrition;
}

export const QUICK_COFFEE_BASE_GRAMS = 240;
export const QUICK_COFFEE_BASE_NUTRITION: Nutrition = {
  kcal: 2.4,
  proteinG: 0.24,
  carbsG: 0,
  fatG: 0,
};

/**
 * Each add-on is exactly one common serving. The UI uses these values for
 * both the option description and the final nutrition snapshot.
 */
export const QUICK_COFFEE_ADDONS: QuickCoffeeAddon[] = [
  {
    key: 'milk',
    grams: 30,
    nutrition: {
      kcal: 18,
      proteinG: 0.96,
      carbsG: 1.44,
      fatG: 0.99,
    },
  },
  {
    key: 'sugar',
    grams: 5,
    nutrition: {
      kcal: 20,
      proteinG: 0,
      carbsG: 5,
      fatG: 0,
    },
  },
  {
    key: 'sweetener',
    grams: 1,
    nutrition: {
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    },
  },
  {
    key: 'cream',
    grams: 10,
    nutrition: {
      kcal: 30,
      proteinG: 0.1,
      carbsG: 0.5,
      fatG: 3,
    },
  },
];

export type QuickCoffeeSelection = Record<QuickCoffeeAddonKey, boolean>;

export const EMPTY_QUICK_COFFEE_SELECTION: QuickCoffeeSelection = {
  milk: false,
  sugar: false,
  sweetener: false,
  cream: false,
};

export interface QuickCoffeeResult {
  grams: number;
  nutrition: Nutrition;
}

export function buildQuickCoffee(
  selection: QuickCoffeeSelection,
): QuickCoffeeResult {
  let grams = QUICK_COFFEE_BASE_GRAMS;
  let nutrition = { ...QUICK_COFFEE_BASE_NUTRITION };

  for (const addon of QUICK_COFFEE_ADDONS) {
    if (!selection[addon.key]) {
      continue;
    }
    grams += addon.grams;
    nutrition = addNutrition(nutrition, addon.nutrition);
  }

  return { grams, nutrition };
}
