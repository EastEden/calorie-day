import { describe, expect, it } from 'vitest';
import { scaleNutrition } from '../nutrition';
import {
  EMPTY_QUICK_COFFEE_SELECTION,
  QUICK_COFFEE_ADDONS,
  buildQuickCoffee,
} from '../quickCoffee';

describe('quickCoffee', () => {
  it('starts with one cup of black coffee', () => {
    const result = buildQuickCoffee(EMPTY_QUICK_COFFEE_SELECTION);

    expect(result.grams).toBe(240);
    expect(result.nutrition.kcal).toBeCloseTo(2.4, 5);
    expect(result.nutrition.proteinG).toBeCloseTo(0.24, 5);
  });

  it('adds one common serving of each selected add-on', () => {
    const result = buildQuickCoffee({
      milk: true,
      sugar: true,
      sweetener: true,
      cream: true,
    });

    expect(result.grams).toBe(286);
    expect(result.nutrition.kcal).toBeCloseTo(70.4, 5);
    expect(result.nutrition.proteinG).toBeCloseTo(1.3, 5);
    expect(result.nutrition.carbsG).toBeCloseTo(6.94, 5);
    expect(result.nutrition.fatG).toBeCloseTo(3.99, 5);
  });

  it('supports converting the composite to a per-100g snapshot', () => {
    const result = buildQuickCoffee({
      milk: true,
      sugar: false,
      sweetener: false,
      cream: false,
    });
    const per100g = scaleNutrition(result.nutrition, 100 / result.grams);

    expect(result.grams).toBe(270);
    expect(per100g.kcal).toBeCloseTo((20.4 / 270) * 100, 5);
  });

  it('uses the expected common portions', () => {
    expect(
      Object.fromEntries(
        QUICK_COFFEE_ADDONS.map((addon) => [addon.key, addon.grams]),
      ),
    ).toEqual({
      milk: 30,
      sugar: 5,
      sweetener: 1,
      cream: 10,
    });
  });
});
