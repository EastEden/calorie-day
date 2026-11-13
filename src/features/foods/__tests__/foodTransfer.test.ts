import { describe, expect, it } from 'vitest';
import { foodImportSchema } from '../../../domain/schemas';
import type { Food } from '../../../domain/types';
import { SEED_FOODS } from '../../../data/seedFoods';
import {
  buildFoodExportPayload,
  buildFoodImportPlan,
  buildFoodImportTemplate,
  materializeImportedFoods,
} from '../foodTransfer';

const existing = SEED_FOODS[0]!;
const existingZhName = existing.names['zh-CN'];

function makePayload(names: string[]) {
  return foodImportSchema.parse({
    schemaVersion: 2,
    foods: names.map((name) => ({
      names: { 'zh-CN': name },
      category: 'protein',
      basis: 'raw',
      nutritionPer100g: {
        kcal: 100,
        proteinG: 10,
        carbsG: 5,
        fatG: 2,
      },
    })),
  });
}

describe('foodTransfer', () => {
  it('separates new foods from conflicts', () => {
    const plan = buildFoodImportPlan(
      [existing],
      makePayload([existingZhName, '全新的食物']),
    );

    expect(plan.newItems).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]?.existing.id).toBe(existing.id);
    expect(plan.blockingErrors).toHaveLength(0);
  });

  it('skips conflicts unless overwrite is enabled', () => {
    const plan = buildFoodImportPlan(
      [existing],
      makePayload([existingZhName]),
    );
    expect(materializeImportedFoods(plan, false)).toHaveLength(0);
    const overwritten = materializeImportedFoods(plan, true);
    expect(overwritten).toHaveLength(1);
    expect(overwritten[0]?.id).toBe(existing.id);
    expect(overwritten[0]?.source).toBe('imported');
    expect(overwritten[0]?.createdAt).toBe(existing.createdAt);
  });

  it('assembles new foods with generated ids and serving ids', () => {
    const payload = foodImportSchema.parse({
      schemaVersion: 2,
      foods: [
        {
          names: {
            'zh-CN': '自制能量棒',
            'en-US': 'Homemade energy bar',
          },
          category: 'other',
          basis: 'as_sold',
          nutritionPer100g: {
            kcal: 400,
            proteinG: 20,
            carbsG: 40,
            fatG: 15,
          },
          servings: [{ label: '根', grams: 50 }],
        },
      ],
    });
    const plan = buildFoodImportPlan([], payload);
    const foods = materializeImportedFoods(plan, false);

    expect(foods).toHaveLength(1);
    expect(foods[0]?.id).toMatch(/^food_/);
    expect(foods[0]?.servings[0]?.id).toMatch(/^serving_/);
    expect(foods[0]?.source).toBe('imported');
    expect(foods[0]?.names['en-US']).toBe('Homemade energy bar');
  });

  it('exports a payload that can be re-imported', () => {
    const food: Food = {
      ...existing,
      names: {
        ...existing.names,
        'en-US': 'Exported chicken breast',
      },
      servings: [
        { id: 'serving-test', label: '份', grams: 100 },
      ],
    };
    const exportPayload = buildFoodExportPayload([food]);
    expect(exportPayload.schemaVersion).toBe(2);
    expect(exportPayload.foods[0]?.names['en-US']).toBe(
      'Exported chicken breast',
    );
    const parsed = foodImportSchema.safeParse(exportPayload);
    expect(parsed.success).toBe(true);
  });

  it('builds a v2 template with a required zh-CN name', () => {
    const template = JSON.parse(buildFoodImportTemplate()) as {
      schemaVersion: number;
      foods: { names: Record<string, string> }[];
    };

    expect(template.schemaVersion).toBe(2);
    expect(template.foods[0]?.names['zh-CN']).toBe('示例：自制鸡胸肉丸');
    expect(foodImportSchema.safeParse(template).success).toBe(true);
  });
});
