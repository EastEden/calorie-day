import { describe, expect, it } from 'vitest';
import {
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
    expect(SEED_FOODS).toHaveLength(55);
    expect(
      SEED_FOODS.some((food) => food.names['zh-CN'] === '花生油'),
    ).toBe(true);
  });

  it('parses a valid v2 JSON payload with extra locales', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 2,
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
      expect(result.data.schemaVersion).toBe(2);
      expect(result.data.foods[0]?.names['zh-CN']).toBe('测试鸡胸肉丸');
      expect(result.data.foods[0]?.names['en-US']).toBe(
        'Test chicken meatballs',
      );
      expect(result.data.foods[0]?.servings?.[0]?.grams).toBe(30);
    }
  });

  it('accepts legacy v1 payloads and converts the name to zh-CN', () => {
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

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(2);
      expect(result.data.foods[0]?.names).toEqual({
        'zh-CN': '旧版鸡胸肉',
      });
    }
  });

  it('rejects names without zh-CN', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 2,
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
        schemaVersion: 2,
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
      JSON.stringify({ schemaVersion: 2, foods: [food, { ...food }] }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(' ')).toContain('重复食物名称');
    }
  });

  it('rejects an unsupported schema version', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 3,
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

  it('validates the exported v2 payload', () => {
    const result = foodImportSchema.safeParse({
      schemaVersion: 2,
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
