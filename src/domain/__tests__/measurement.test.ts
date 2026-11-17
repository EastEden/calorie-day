import { describe, expect, it } from 'vitest';
import {
  getBatchNutritionPer100g,
  getFoodDefaultNutrition,
  getFoodDefaultUnit,
  getFoodNutrition,
  getFoodUnits,
} from '../measurement';
import type { Food, Nutrition } from '../types';

const nutrition: Nutrition = {
  kcal: 61,
  proteinG: 3.2,
  carbsG: 4.8,
  fatG: 3.3,
};

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food-test',
    names: { 'zh-CN': '测试食物' },
    category: 'other',
    basis: 'as_sold',
    nutritionPer100g: nutrition,
    nutritionPer100ml: nutrition,
    defaultUnit: 'ml',
    servings: [],
    source: 'custom',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('food measurement helpers', () => {
  it('exposes only the nutrition references that exist', () => {
    expect(getFoodUnits(makeFood())).toEqual(['g', 'ml']);

    const mlOnly = makeFood({ nutritionPer100g: undefined });
    expect(getFoodUnits(mlOnly)).toEqual(['ml']);
    expect(getFoodNutrition(mlOnly, 'g')).toBeUndefined();
    expect(getFoodDefaultUnit(mlOnly)).toBe('ml');
    expect(getFoodDefaultNutrition(mlOnly)).toEqual(nutrition);
  });

  it('falls back to the available unit for legacy imports', () => {
    const mlOnlyWithGramDefault = makeFood({
      nutritionPer100g: undefined,
      defaultUnit: 'g',
    });
    expect(getFoodDefaultUnit(mlOnlyWithGramDefault)).toBe('ml');
  });

  it('uses the per-100ml reference for provisional batch grams', () => {
    const mlOnly = makeFood({ nutritionPer100g: undefined });
    expect(getBatchNutritionPer100g(mlOnly)).toEqual(nutrition);
  });
});
