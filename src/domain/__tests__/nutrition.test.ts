import { describe, expect, it } from 'vitest';
import {
  addNutrition,
  buildDaySummary,
  getEntryNutrition,
  getMacroEnergy,
  scaleNutrition,
  sumEntries,
} from '../../domain/nutrition';
import type { FoodEntry, Nutrition } from '../../domain/types';
import { createEmptyDailyLog } from '../../domain/logFactory';

function makeEntry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: 'entry-1',
    foodId: 'food-1',
    foodName: '测试食物',
    amountGrams: 100,
    enteredQuantity: 100,
    enteredUnit: 'g',
    nutritionPer100gSnapshot: {
      kcal: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('nutrition', () => {
  it('adds and scales nutrition values', () => {
    const base: Nutrition = { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 };
    expect(addNutrition(base, base)).toEqual({
      kcal: 200,
      proteinG: 20,
      carbsG: 10,
      fatG: 4,
    });
    expect(scaleNutrition(base, 1.5)).toEqual({
      kcal: 150,
      proteinG: 15,
      carbsG: 7.5,
      fatG: 3,
    });
  });

  it('calculates entry nutrition from a 100g snapshot', () => {
    const entry = makeEntry({ amountGrams: 150 });
    expect(getEntryNutrition(entry)).toEqual({
      kcal: 300,
      proteinG: 15,
      carbsG: 30,
      fatG: 7.5,
    });
  });

  it('sums entries', () => {
    const totals = sumEntries([
      makeEntry(),
      makeEntry({
        id: 'entry-2',
        amountGrams: 50,
        nutritionPer100gSnapshot: {
          kcal: 100,
          proteinG: 5,
          carbsG: 10,
          fatG: 2,
        },
      }),
    ]);

    expect(totals.kcal).toBeCloseTo(250);
    expect(totals.proteinG).toBeCloseTo(12.5);
    expect(totals.carbsG).toBeCloseTo(25);
    expect(totals.fatG).toBeCloseTo(6);
  });

  it('calculates macro energy percentages with 4/4/9 factors', () => {
    const result = getMacroEnergy({
      kcal: 780,
      proteinG: 50,
      carbsG: 100,
      fatG: 20,
    });

    expect(result.totalKcal).toBe(780);
    expect(result.proteinKcal).toBe(200);
    expect(result.proteinPercent).toBeCloseTo(25.641, 3);
    expect(result.carbsPercent).toBeCloseTo(51.282, 3);
    expect(result.fatPercent).toBeCloseTo(23.077, 3);
  });

  it('handles zero macro energy without dividing by zero', () => {
    expect(getMacroEnergy({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })).toMatchObject({
      proteinPercent: 0,
      carbsPercent: 0,
      fatPercent: 0,
    });
  });

  it('builds a complete daily summary from a log and target', () => {
    const log = createEmptyDailyLog('2026-11-13');
    log.meals.breakfast = [makeEntry()];
    log.meals.lunch = [makeEntry({ id: 'entry-2', amountGrams: 50 })];

    const summary = buildDaySummary(log, {
      kcal: 1000,
      proteinG: 100,
      carbsG: 100,
      fatG: 50,
    });

    expect(summary.entryCount).toBe(2);
    expect(summary.totals.kcal).toBe(300);
    expect(summary.byMeal.breakfast.entryCount).toBe(1);
    expect(summary.byMeal.dinner.entryCount).toBe(0);
    expect(summary.remainingKcal).toBe(700);
    expect(summary.calorieProgress).toBe(30);
  });

  it('reports a negative remaining value when over target', () => {
    const log = createEmptyDailyLog('2026-11-13');
    log.meals.breakfast = [makeEntry({ amountGrams: 1000 })];

    const summary = buildDaySummary(log, {
      kcal: 1000,
      proteinG: 100,
      carbsG: 100,
      fatG: 50,
    });

    expect(summary.remainingKcal).toBe(-1000);
    expect(summary.calorieProgress).toBe(200);
  });
});
