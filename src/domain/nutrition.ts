import { MEAL_TYPES } from './constants';
import type {
  DailyLog,
  DaySummary,
  FoodEntry,
  MacroEnergyBreakdown,
  MealSummary,
  MealType,
  Nutrition,
} from './types';

export function emptyNutrition(): Nutrition {
  return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

export function scaleNutrition(nutrition: Nutrition, factor: number): Nutrition {
  return {
    kcal: nutrition.kcal * factor,
    proteinG: nutrition.proteinG * factor,
    carbsG: nutrition.carbsG * factor,
    fatG: nutrition.fatG * factor,
  };
}

export function getEntryNutrition(entry: FoodEntry): Nutrition {
  return scaleNutrition(
    entry.nutritionPer100gSnapshot,
    entry.amountGrams / 100,
  );
}

export function sumEntries(entries: FoodEntry[]): Nutrition {
  return entries.reduce(
    (total, entry) => addNutrition(total, getEntryNutrition(entry)),
    emptyNutrition(),
  );
}

export function getMacroEnergy(nutrition: Nutrition): MacroEnergyBreakdown {
  const proteinKcal = nutrition.proteinG * 4;
  const carbsKcal = nutrition.carbsG * 4;
  const fatKcal = nutrition.fatG * 9;
  const totalKcal = proteinKcal + carbsKcal + fatKcal;

  if (totalKcal <= 0) {
    return {
      proteinKcal,
      carbsKcal,
      fatKcal,
      totalKcal,
      proteinPercent: 0,
      carbsPercent: 0,
      fatPercent: 0,
    };
  }

  return {
    proteinKcal,
    carbsKcal,
    fatKcal,
    totalKcal,
    proteinPercent: (proteinKcal / totalKcal) * 100,
    carbsPercent: (carbsKcal / totalKcal) * 100,
    fatPercent: (fatKcal / totalKcal) * 100,
  };
}

export function buildDaySummary(
  log: DailyLog | null,
  target: Nutrition | null,
): DaySummary {
  const byMeal = {} as Record<MealType, MealSummary>;
  let totals = emptyNutrition();
  let entryCount = 0;

  for (const mealType of MEAL_TYPES) {
    const entries = log?.meals[mealType] ?? [];
    const mealTotals = sumEntries(entries);
    byMeal[mealType] = {
      totals: mealTotals,
      entryCount: entries.length,
    };
    totals = addNutrition(totals, mealTotals);
    entryCount += entries.length;
  }

  const calorieProgress =
    target && target.kcal > 0 ? (totals.kcal / target.kcal) * 100 : 0;

  return {
    totals,
    target,
    remainingKcal: target ? target.kcal - totals.kcal : null,
    calorieProgress,
    macroEnergy: getMacroEnergy(totals),
    byMeal,
    entryCount,
  };
}

export function getProgressPercent(consumed: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) {
    return 0;
  }
  return (consumed / target) * 100;
}
