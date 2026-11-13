import { describe, expect, it } from 'vitest';
import { foodSchema, parseFoodImportJson } from '../../domain/schemas';
import { SEED_FOODS } from '../../data/seedFoods';

describe('food import schema', () => {
  it('validates every built-in seed food', () => {
    expect(() => {
      for (const food of SEED_FOODS) {
        foodSchema.parse(food);
      }
    }).not.toThrow();
    expect(SEED_FOODS).toHaveLength(54);
  });

  it('parses a valid JSON payload', () => {
    const result = parseFoodImportJson(
      JSON.stringify({
        schemaVersion: 1,
        foods: [
          {
            name: '测试鸡胸肉丸',
            category: 'protein',
            basis: 'raw',
            nutritionPer100g: {
              kcal: 160,
              proteinG: 20,
              carbsG: 4,
              fatG: 7,
            },
            servings: [{ label: '个', grams: 30 }],
          },
        ],
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.foods[0]?.name).toBe('测试鸡胸肉丸');
      expect(result.data.foods[0]?.servings?.[0]?.grams).toBe(30);
    }
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
            name: '坏数据',
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

  it('rejects duplicate names within one import', () => {
    const food = {
      name: '重复食物',
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
            name: '未来食物',
            category: 'other',
            basis: 'raw',
            nutritionPer100g: {
              kcal: 100,
              proteinG: 1,
              carbsG: 1,
              fatG: 1,
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});
