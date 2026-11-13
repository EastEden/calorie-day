import type { Food } from './types';

export const DEFAULT_COOKING_OIL_ID = 'builtin-olive-oil';

const OIL_NAME_PATTERN = /油|oil/i;

/**
 * Quick oil is intentionally a library-driven shortcut rather than a second
 * food model. A food qualifies when it is in the fat/nut category and at
 * least one localized name looks like an oil. This keeps custom and imported
 * oils usable without adding another tag to the schema.
 */
export function isCookingOilFood(food: Food): boolean {
  return (
    food.category === 'fat_nut_condiment' &&
    Object.values(food.names).some((name) => OIL_NAME_PATTERN.test(name))
  );
}

export function getCookingOilFoods(foods: Food[]): Food[] {
  return foods.filter(isCookingOilFood);
}

export function getDefaultCookingOil(oils: Food[]): Food | undefined {
  return (
    oils.find((food) => food.id === DEFAULT_COOKING_OIL_ID) ?? oils[0]
  );
}
