import { nowIsoTimestamp } from '../../domain/dates';
import { createId } from '../../domain/id';
import {
  foodImportSchema,
  normalizeImportedFood,
} from '../../domain/schemas';
import type { FoodImportPayload } from '../../domain/schemas';
import {
  FOOD_NAME_FALLBACK_LOCALE,
  normalizeLocalizedText,
  resolveLocalizedText,
} from '../../domain/localizedText';
import type { Food, ImportedFoodInput } from '../../domain/types';

export interface ImportConflict {
  incoming: ImportedFoodInput;
  existing: Food;
  matchedBy: 'id' | 'name';
}

export interface FoodImportPlan {
  newItems: ImportedFoodInput[];
  conflicts: ImportConflict[];
  blockingErrors: string[];
  total: number;
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase(FOOD_NAME_FALLBACK_LOCALE);
}

export function buildFoodImportPlan(
  existingFoods: Food[],
  payload: FoodImportPayload,
  locale = FOOD_NAME_FALLBACK_LOCALE,
): FoodImportPlan {
  const byId = new Map(existingFoods.map((food) => [food.id, food]));
  const byName = new Map(
    existingFoods.map((food) => [
      normalizeName(food.names[FOOD_NAME_FALLBACK_LOCALE]),
      food,
    ]),
  );
  const newItems: ImportedFoodInput[] = [];
  const conflicts: ImportConflict[] = [];
  const blockingErrors: string[] = [];

  for (const rawIncoming of payload.foods) {
    const incoming = normalizeImportedFood(
      rawIncoming as ImportedFoodInput,
    );
    const idMatch = incoming.id ? byId.get(incoming.id) : undefined;
    const nameMatch = byName.get(
      normalizeName(incoming.names[FOOD_NAME_FALLBACK_LOCALE]),
    );

    if (idMatch && nameMatch && idMatch.id !== nameMatch.id) {
      blockingErrors.push(
        `“${resolveLocalizedText(
          incoming.names,
          locale,
        )}”同时与现有食物的 ID 和名称冲突，请修改文件中的名称或 ID。`,
      );
      continue;
    }

    const match = idMatch ?? nameMatch;

    if (match) {
      conflicts.push({
        incoming,
        existing: match,
        matchedBy: idMatch ? 'id' : 'name',
      });
    } else {
      newItems.push(incoming);
    }
  }

  return {
    newItems,
    conflicts,
    blockingErrors,
    total: payload.foods.length,
  };
}

function makeImportedFood(
  incoming: ImportedFoodInput,
  existing?: Food,
): Food {
  const now = nowIsoTimestamp();
  const id = existing?.id ?? incoming.id ?? createId('food');

  return {
    id,
    names: normalizeLocalizedText(incoming.names),
    category: incoming.category,
    basis: incoming.basis,
    nutritionPer100g: { ...incoming.nutritionPer100g },
    servings: (incoming.servings ?? []).map((serving) => ({
      id: createId('serving'),
      label: serving.label.trim(),
      grams: serving.grams,
    })),
    ...(incoming.batch ? { batch: { ...incoming.batch } } : {}),
    source: 'imported',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function materializeImportedFoods(
  plan: FoodImportPlan,
  overwriteConflicts: boolean,
): Food[] {
  if (plan.blockingErrors.length > 0) {
    throw new Error(plan.blockingErrors.join(' '));
  }

  const foods = plan.newItems.map((incoming) => makeImportedFood(incoming));

  if (overwriteConflicts) {
    for (const conflict of plan.conflicts) {
      foods.push(makeImportedFood(conflict.incoming, conflict.existing));
    }
  }

  return foods;
}

export function buildFoodExportPayload(foods: Food[]): {
  schemaVersion: 1;
  exportedAt: string;
  foods: ImportedFoodInput[];
} {
  return {
    schemaVersion: 1,
    exportedAt: nowIsoTimestamp(),
    foods: foods.map((food) => ({
      id: food.id,
      names: { ...food.names },
      category: food.category,
      basis: food.basis,
      nutritionPer100g: { ...food.nutritionPer100g },
      servings: food.servings.map((serving) => ({
        id: serving.id,
        label: serving.label,
        grams: serving.grams,
      })),
      ...(food.batch ? { batch: { ...food.batch } } : {}),
    })),
  };
}

export function stringifyFoodExport(foods: Food[]): string {
  return JSON.stringify(buildFoodExportPayload(foods), null, 2);
}

export function buildFoodImportTemplate(): string {
  const template = {
    schemaVersion: 1,
    exportedAt: nowIsoTimestamp(),
    foods: [
      {
        names: {
          'zh-CN': '示例：自制鸡胸肉丸',
        },
        category: 'protein',
        basis: 'raw',
        nutritionPer100g: {
          kcal: 165,
          proteinG: 20,
          carbsG: 4,
          fatG: 7,
        },
        servings: [
          {
            label: '个',
            grams: 30,
          },
        ],
      },
    ],
  };

  foodImportSchema.parse(template);
  return JSON.stringify(template, null, 2);
}
