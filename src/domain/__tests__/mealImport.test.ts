import { describe, expect, it } from 'vitest';
import {
  MEAL_IMPORT_AI_PROMPT,
  parseMealImportJson,
  repairMealImportJson,
} from '../mealImport';

function makePayload(days: unknown[]) {
  return JSON.stringify({
    schemaVersion: 1,
    days,
  });
}

const breakfast = {
  name: '鸡蛋',
  amountGrams: 50,
  nutrition: {
    kcal: 72,
    proteinG: 6.3,
    carbsG: 0.4,
    fatG: 4.8,
  },
};

describe('mealImport', () => {
  it('asks the AI to confirm the range before multi-day output', () => {
    expect(MEAL_IMPORT_AI_PROMPT).toContain('先不要输出 JSON');
    expect(MEAL_IMPORT_AI_PROMPT).toContain('日期范围');
    expect(MEAL_IMPORT_AI_PROMPT).toContain('单天记录');
  });

  it('requires strict half-width JSON in the AI prompt', () => {
    expect(MEAL_IMPORT_AI_PROMPT).toContain('英文半角双引号');
    expect(MEAL_IMPORT_AI_PROMPT).toContain('空数组');
    expect(MEAL_IMPORT_AI_PROMPT).toContain('[]');
    expect(MEAL_IMPORT_AI_PROMPT).toContain('「复制 JSON」按钮');
    expect(MEAL_IMPORT_AI_PROMPT).toContain('json 代码块');
    expect(MEAL_IMPORT_AI_PROMPT).toContain('JSON.parse()');
  });

  it('repairs common AI formatting mistakes', () => {
    const raw = `\`\`\`json
{ “schemaVersion”: 1, “days”: \\[ { "date": "2026-11-15", "meals": { "breakfast": \\[ { "name": "鸡肉麦满分", "amountGrams": 160, "nutrition": { "kcal": 360, "proteinG": 17, "carbsG": 38, "fatG": 16 } } \\], “lunch”: , “dinner”: , “snack”: } } ] }
\`\`\``;

    const repaired = repairMealImportJson(raw);
    const result = parseMealImportJson(repaired);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days[0]?.meals.breakfast).toHaveLength(1);
      expect(result.data.days[0]?.meals.lunch).toEqual([]);
      expect(result.data.days[0]?.meals.dinner).toEqual([]);
      expect(result.data.days[0]?.meals.snack).toEqual([]);
    }
  });

  it('parses a single day with multiple meals', () => {
    const result = parseMealImportJson(
      makePayload([
        {
          date: '2026-11-15',
          meals: {
            breakfast: [breakfast],
            lunch: [],
            dinner: [],
            snack: [],
          },
        },
      ]),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days).toHaveLength(1);
      expect(result.data.days[0]?.meals.breakfast[0]?.name).toBe(
        '鸡蛋',
      );
    }
  });

  it('parses multiple days', () => {
    const result = parseMealImportJson(
      makePayload([
        {
          date: '2026-11-14',
          meals: {
            breakfast: [],
            lunch: [breakfast],
            dinner: [],
            snack: [],
          },
        },
        {
          date: '2026-11-15',
          meals: {
            breakfast: [breakfast],
            lunch: [],
            dinner: [breakfast],
            snack: [],
          },
        },
      ]),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days).toHaveLength(2);
    }
  });

  it('rejects duplicate dates', () => {
    const day = {
      date: '2026-11-15',
      meals: {
        breakfast: [breakfast],
        lunch: [],
        dinner: [],
        snack: [],
      },
    };
    const result = parseMealImportJson(makePayload([day, day]));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(' ')).toContain('同一天不能出现多次');
    }
  });

  it('rejects an empty day', () => {
    const result = parseMealImportJson(
      makePayload([
        {
          date: '2026-11-15',
          meals: {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
          },
        },
      ]),
    );

    expect(result.success).toBe(false);
  });

  it('rejects a wrong schema version', () => {
    const result = parseMealImportJson(
      JSON.stringify({
        schemaVersion: 2,
        days: [
          {
            date: '2026-11-15',
            meals: {
              breakfast: [breakfast],
              lunch: [],
              dinner: [],
              snack: [],
            },
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
  });
});
