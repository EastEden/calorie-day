import { describe, expect, it } from 'vitest';
import {
  foodEntrySchema,
  foodImportSchema,
  foodSchema,
  parseFoodImportJson,
} from '../../domain/schemas';
import { SEED_FOODS } from '../../data/seedFoods';

const nutrition = {
  kcal: 160,
  proteinG: 20,
  carbsG: 4,
  fatG: 7,
};

describe('food import schema', () => {
  it('validates every built-in seed food', () => {
    expect(() => {
      for (const food of SEED_FOODS) {
        foodSchema.parse(food);
      }
    }).not.toThrow();
    expect(SEED_FOODS).toHaveLength(58);
    expect(
      SEED_FOODS.some((food) => food.names['zh-CN'] === '花生油'),
    ).toBe(true);
    expect(
      SEED_FOODS.some((food) => food.names['zh-CN'] === '黑咖啡（无糖）'),
    ).toBe(true);

    const milkNames = SEED_FOODS.filter((food) =>
      food.category === 'egg_dairy_soy' && food.names['zh-CN'].includes('牛奶'),
    ).map((food) => food.names['zh-CN']);
    expect(milkNames).toEqual(
      expect.arrayContaining([
        '全脂牛奶',
        '2% 低脂牛奶',
        '1% 低脂牛奶',
        '脱脂牛奶',
      ]),
    );
    for (const milk of SEED_FOODS.filter((food) =>
      milkNames.includes(food.names['zh-CN']),
    )) {
      expect(milk.defaultUnit).toBe('ml');
      expect(milk.nutritionPer100g).toBeDefined();
      expect(milk.nutritionPer100ml).toBeDefined();
      expect(milk.servings).toHaveLength(0);
    }
  });

  it('parses a valid v1 JSON payload with extra locales', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 1,
        foods: [
          {
            names: {
              'zh-CN': '测试鸡胸肉丸',
              'en-US': 'Test chicken meatballs',
            },
            category: 'protein',
            basis: 'raw',
            nutritionPer100g: nutrition,
            servings: [{ label: '个', grams: 30 }],
          },
        ],
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(1);
      expect(result.data.foods[0]?.names['zh-CN']).toBe('测试鸡胸肉丸');
      expect(result.data.foods[0]?.names['en-US']).toBe(
        'Test chicken meatballs',
      );
      expect(result.data.foods[0]?.servings?.[0]?.amount).toBe(30);
      expect(result.data.foods[0]?.servings?.[0]?.unit).toBe('g');
    }
  });

  it('rejects pre-localization name-string payloads', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 1,
        foods: [
          {
            name: '旧版鸡胸肉',
            category: 'protein',
            basis: 'raw',
            nutritionPer100g: nutrition,
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects names without zh-CN', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 1,
        foods: [
          {
            names: { 'en-US': 'Only English' },
            category: 'other',
            basis: 'raw',
            nutritionPer100g: nutrition,
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(' ')).toContain('至少需要提供 zh-CN');
    }
  });

  it('requires zh-CN on persisted foods as well as imports', () => {
    const result = foodSchema.safeParse({
      id: 'food-no-zh',
      names: { 'en-US': 'English only' },
      category: 'other',
      basis: 'raw',
      nutritionPer100g: nutrition,
      servings: [],
      source: 'custom',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('validates batch metadata and rejects a portion larger than the total', () => {
    const base = {
      id: 'batch-food',
      names: { 'zh-CN': '测试备餐' },
      category: 'other',
      basis: 'raw',
      nutritionPer100g: nutrition,
      servings: [],
      source: 'custom',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(
      foodSchema.safeParse({
        ...base,
        batch: { totalGrams: 1000, portionGrams: 250 },
      }).success,
    ).toBe(true);
    expect(
      foodSchema.safeParse({
        ...base,
        batch: { totalGrams: 200, portionGrams: 250 },
      }).success,
    ).toBe(false);
  });

  it('rejects malformed JSON', () => {
    const result = parseFoodImportJson('{ not valid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('JSON');
    }
  });

  it('rejects missing nutrition values with a field path', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 1,
        foods: [
          {
            names: { 'zh-CN': '坏数据' },
            category: 'other',
            basis: 'raw',
            nutritionPer100g: { kcal: 100 },
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(' ')).toContain('foods.0.nutritionPer100g');
    }
  });

  it('rejects duplicate zh-CN names within one import', () => {
    const food = {
      names: { 'zh-CN': '重复食物' },
      category: 'other',
      basis: 'raw',
      nutritionPer100g: {
        kcal: 100,
        proteinG: 1,
        carbsG: 1,
        fatG: 1,
      },
    };
    const result = parseFoodImportJson(
      JSON.stringify({ schemaVersion: 1, foods: [food, { ...food }] }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(' ')).toContain('重复食物名称');
    }
  });

  it('rejects an unsupported schema version', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 2,
        foods: [
          {
            names: { 'zh-CN': '未来食物' },
            category: 'other',
            basis: 'raw',
            nutritionPer100g: nutrition,
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts foods with only per-100ml nutrition', () => {
    const parsed = foodSchema.safeParse({
      id: 'milk-only-ml',
      names: { 'zh-CN': '自定义牛奶' },
      category: 'egg_dairy_soy',
      basis: 'as_sold',
      nutritionPer100ml: nutrition,
      defaultUnit: 'ml',
      servings: [],
      source: 'custom',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects foods without any nutrition reference', () => {
    const parsed = foodSchema.safeParse({
      id: 'no-nutrition',
      names: { 'zh-CN': '无营养数据' },
      category: 'other',
      basis: 'raw',
      defaultUnit: 'g',
      servings: [],
      source: 'custom',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(parsed.success).toBe(false);
  });

  it('normalises legacy gram-based entries to amount + unit', () => {
    const parsed = foodEntrySchema.parse({
      id: 'legacy-entry',
      foodId: 'legacy-food',
      foodNames: { 'zh-CN': '旧版食物' },
      amountGrams: 150,
      enteredQuantity: 1.5,
      enteredUnit: 'serving',
      servingLabel: '份',
      servingGrams: 100,
      nutritionPer100gSnapshot: nutrition,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(parsed.amount).toBe(150);
    expect(parsed.unit).toBe('g');
    expect(parsed.nutritionPer100Snapshot).toEqual(nutrition);
  });

  it('validates the exported v1 payload', () => {
    const result = foodImportSchema.safeParse({
      schemaVersion: 1,
      foods: [
        {
          names: { 'zh-CN': '导出食物' },
          category: 'other',
          basis: 'raw',
          nutritionPer100g: nutrition,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
