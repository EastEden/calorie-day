import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../../data/seedFoods';
import {
  DEFAULT_COOKING_OIL_ID,
  getCookingOilFoods,
  getDefaultCookingOil,
  isCookingOilFood,
} from '../cookingOils';
import type { Food } from '../types';

const oliveOil = SEED_FOODS.find(
  (food) => food.id === DEFAULT_COOKING_OIL_ID,
)!;
const almond = SEED_FOODS.find(
  (food) => food.names['zh-CN'] === '杏仁',
)!;

describe('cookingOils', () => {
  it('recognizes built-in cooking oil and excludes nuts', () => {
    expect(isCookingOilFood(oliveOil)).toBe(true);
    expect(isCookingOilFood(almond)).toBe(false);
    expect(getCookingOilFoods(SEED_FOODS).map((food) => food.id)).toContain(
      DEFAULT_COOKING_OIL_ID,
    );
  });

  it('accepts custom localized oil names', () => {
    const custom: Food = {
      ...oliveOil,
      id: 'custom-peanut-oil',
      names: {
        'zh-CN': '花生油',
        'en-US': 'Peanut oil',
      },
      source: 'custom',
    };

    expect(isCookingOilFood(custom)).toBe(true);
  });

  it('prefers olive oil as the default quick oil', () => {
    expect(getDefaultCookingOil(getCookingOilFoods(SEED_FOODS))?.id).toBe(
      DEFAULT_COOKING_OIL_ID,
    );
    expect(getDefaultCookingOil([])).toBeUndefined();
  });
});
