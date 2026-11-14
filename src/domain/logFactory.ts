import { nowIsoTimestamp } from './dates';
import { createId } from './id';
import type {
  DailyLog,
  EntryUnit,
  Food,
  FoodEntry,
  MealType,
} from './types';

export interface EntryAmountInput {
  grams: number;
  enteredQuantity: number;
  enteredUnit: EntryUnit;
  servingLabel?: string;
  servingGrams?: number;
}

export function createEmptyDailyLog(date: string): DailyLog {
  const now = nowIsoTimestamp();
  return {
    id: createId('log'),
    date,
    meals: {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    },
    revision: 0,
    targetSnapshot: null,
    weightKgSnapshot: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createFoodEntry(
  food: Food,
  amount: EntryAmountInput,
): FoodEntry {
  const now = nowIsoTimestamp();
  return {
    id: createId('entry'),
    foodId: food.id,
    foodNames: { ...food.names },
    amountGrams: amount.grams,
    enteredQuantity: amount.enteredQuantity,
    enteredUnit: amount.enteredUnit,
    servingLabel: amount.servingLabel,
    servingGrams: amount.servingGrams,
    nutritionPer100gSnapshot: { ...food.nutritionPer100g },
    createdAt: now,
    updatedAt: now,
  };
}

export function applyEntryAmount(
  entry: FoodEntry,
  amount: EntryAmountInput,
): FoodEntry {
  return {
    ...entry,
    amountGrams: amount.grams,
    enteredQuantity: amount.enteredQuantity,
    enteredUnit: amount.enteredUnit,
    servingLabel: amount.servingLabel,
    servingGrams: amount.servingGrams,
    updatedAt: nowIsoTimestamp(),
  };
}

export function addEntryToMeal(
  log: DailyLog,
  mealType: MealType,
  entry: FoodEntry,
): DailyLog {
  return {
    ...log,
    meals: {
      ...log.meals,
      [mealType]: [...log.meals[mealType], entry],
    },
  };
}

export function updateEntryInLog(
  log: DailyLog,
  mealType: MealType,
  entryId: string,
  amount: EntryAmountInput,
): DailyLog {
  return {
    ...log,
    meals: {
      ...log.meals,
      [mealType]: log.meals[mealType].map((entry) =>
        entry.id === entryId ? applyEntryAmount(entry, amount) : entry,
      ),
    },
  };
}

export function deleteEntryFromLog(
  log: DailyLog,
  mealType: MealType,
  entryId: string,
): DailyLog {
  return {
    ...log,
    meals: {
      ...log.meals,
      [mealType]: log.meals[mealType].filter((entry) => entry.id !== entryId),
    },
  };
}

export function getEntryFromLog(
  log: DailyLog,
  mealType: MealType,
  entryId: string,
): FoodEntry | null {
  return log.meals[mealType].find((entry) => entry.id === entryId) ?? null;
}
