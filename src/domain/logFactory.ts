import { nowIsoTimestamp } from './dates';
import { createId } from './id';
import type {
  AmountUnit,
  DailyLog,
  EntryUnit,
  Food,
  FoodEntry,
  MealType,
  Nutrition,
} from './types';

export interface EntryAmountInput {
  amount: number;
  unit: AmountUnit;
  enteredQuantity: number;
  enteredUnit: EntryUnit;
  servingLabel?: string;
  servingAmount?: number;
  servingUnit?: AmountUnit;
  nutritionPer100Snapshot?: Nutrition;
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
  const nutritionSnapshot =
    amount.nutritionPer100Snapshot ??
    (amount.unit === 'ml'
      ? food.nutritionPer100ml
      : food.nutritionPer100g);
  if (!nutritionSnapshot) {
    throw new Error(
      amount.unit === 'ml'
        ? '该食物没有每100ml营养数据'
        : '该食物没有每100g营养数据',
    );
  }

  return {
    id: createId('entry'),
    foodId: food.id,
    foodNames: { ...food.names },
    ...(food.batch?.components
      ? {
          batchComponents: food.batch.components.map((component) => ({
            names: { ...component.names },
            totalGrams: component.totalGrams,
          })),
        }
      : {}),
    amount: amount.amount,
    unit: amount.unit,
    enteredQuantity: amount.enteredQuantity,
    enteredUnit: amount.enteredUnit,
    servingLabel: amount.servingLabel,
    servingAmount: amount.servingAmount,
    servingUnit: amount.servingUnit,
    nutritionPer100Snapshot: { ...nutritionSnapshot },
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
    amount: amount.amount,
    unit: amount.unit,
    enteredQuantity: amount.enteredQuantity,
    enteredUnit: amount.enteredUnit,
    servingLabel: amount.servingLabel,
    servingAmount: amount.servingAmount,
    servingUnit: amount.servingUnit,
    ...(amount.nutritionPer100Snapshot
      ? {
          nutritionPer100Snapshot: {
            ...amount.nutritionPer100Snapshot,
          },
        }
      : {}),
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
