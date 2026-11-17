import type { AmountUnit, Food, Nutrition } from './types';

export function getFoodUnits(food: Food): AmountUnit[] {
  const units: AmountUnit[] = [];
  if (food.nutritionPer100g) {
    units.push('g');
  }
  if (food.nutritionPer100ml) {
    units.push('ml');
  }
  if (units.length === 0) {
    // Defensive fallback for malformed legacy data. Valid foods always carry
    // at least one reference, enforced by foodSchema.
    units.push('g');
  }
  return units;
}

export function getFoodNutrition(
  food: Food,
  unit: AmountUnit,
): Nutrition | undefined {
  return unit === 'ml' ? food.nutritionPer100ml : food.nutritionPer100g;
}

export function getFoodDefaultUnit(food: Food): AmountUnit {
  const units = getFoodUnits(food);
  return units.includes(food.defaultUnit) ? food.defaultUnit : units[0];
}

export function getFoodDefaultNutrition(food: Food): Nutrition {
  return (
    getFoodNutrition(food, getFoodDefaultUnit(food)) ??
    food.nutritionPer100g ??
    food.nutritionPer100ml ?? {
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    }
  );
}

/**
 * Batches still use mass. Until the portion-based batch refactor, ml
 * ingredients are accepted 1:1 as grams.
 */
export function getBatchNutritionPer100g(food: Food): Nutrition | undefined {
  return food.nutritionPer100g ?? food.nutritionPer100ml;
}
