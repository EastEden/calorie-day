import { z } from 'zod';
import {
  getZodIssueMessages,
  isoDateSchema,
  nutritionSchema,
} from './schemas';

export const MEAL_IMPORT_SCHEMA_VERSION = 1;

export interface MealImportEntry {
  name: string;
  amountGrams: number;
  nutrition: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

export interface MealImportDay {
  date: string;
  meals: {
    breakfast: MealImportEntry[];
    lunch: MealImportEntry[];
    dinner: MealImportEntry[];
    snack: MealImportEntry[];
  };
}

export interface MealImportPayload {
  schemaVersion: 1;
  days: MealImportDay[];
}

export interface MealImportResult {
  daysImported: number;
  entriesImported: number;
}

const mealImportEntrySchema = z.object({
  name: z.string().trim().min(1).max(80),
  amountGrams: z.number().finite().positive().max(100_000),
  nutrition: nutritionSchema,
});

const mealImportDaySchema = z.object({
  date: isoDateSchema,
  meals: z.object({
    breakfast: z.array(mealImportEntrySchema).max(200),
    lunch: z.array(mealImportEntrySchema).max(200),
    dinner: z.array(mealImportEntrySchema).max(200),
    snack: z.array(mealImportEntrySchema).max(200),
  }),
});

export const mealImportSchema = z
  .object({
    schemaVersion: z.literal(MEAL_IMPORT_SCHEMA_VERSION),
    days: z.array(mealImportDaySchema).min(1).max(1000),
  })
  .superRefine((payload, ctx) => {
    const dates = new Set<string>();
    payload.days.forEach((day, index) => {
      if (dates.has(day.date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days', index, 'date'],
          message: '同一天不能出现多次，请合并为一条日期记录',
        });
      }
      dates.add(day.date);

      const entryCount = Object.values(day.meals).reduce(
        (sum, entries) => sum + entries.length,
        0,
      );
      if (entryCount === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days', index],
          message: '这一天没有任何饮食记录',
        });
      }
    });
  });

export interface MealImportParseSuccess {
  success: true;
  data: MealImportPayload;
}

export interface MealImportParseFailure {
  success: false;
  errors: string[];
}

export function parseMealImportJson(
  raw: string,
): MealImportParseSuccess | MealImportParseFailure {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, errors: ['文件不是有效的 JSON。'] };
  }

  const result = mealImportSchema.safeParse(parsed);

  if (!result.success) {
    return { success: false, errors: getZodIssueMessages(result.error) };
  }

  return { success: true, data: result.data as MealImportPayload };
}

export const MEAL_IMPORT_AI_PROMPT = `请把你识别到的每一餐，按下面的 JSON 格式输出。
如果识别结果涉及多天记录，请先不要输出 JSON：先用一句话向用户确认要导出的日期范围（例如“2026-11-14 到 2026-11-15”或具体哪几天）。等用户明确确认后，再只输出确认范围内的 JSON。
如果是单天记录，可以直接输出 JSON。最终输出时不要解释、不要用代码块，只输出 JSON 本身。

规则：
1. 多天记录必须先确认日期范围，再输出 JSON。
2. 最外层必须有 "schemaVersion": 1 和 "days" 数组。
3. 每天一个对象，包含 "date"（格式 YYYY-MM-DD）和 "meals"。
4. "meals" 固定四个键：breakfast（早餐）、lunch（午餐）、dinner（晚餐）、snack（加餐）；没有的餐用空数组 []。
5. 每条食物包含 "name"（食物名称）、"amountGrams"（克数）、"nutrition"（本次摄入量的总营养）。
6. nutrition 的四个字段：kcal（热量）、proteinG（蛋白质克）、carbsG（碳水克）、fatG（脂肪克）。都是数字，按本次克数计算总量，而不是每100g。
7. 不认识或不确定的食物也要给出合理估算，名称尽量简短。

示例：
{
  "schemaVersion": 1,
  "days": [
    {
      "date": "2026-11-15",
      "meals": {
        "breakfast": [
          {
            "name": "水煮蛋",
            "amountGrams": 50,
            "nutrition": {
              "kcal": 72,
              "proteinG": 6.3,
              "carbsG": 0.4,
              "fatG": 4.8
            }
          }
        ],
        "lunch": [
          {
            "name": "米饭",
            "amountGrams": 200,
            "nutrition": {
              "kcal": 232,
              "proteinG": 5.2,
              "carbsG": 51.4,
              "fatG": 0.6
            }
          },
          {
            "name": "清炒西兰花",
            "amountGrams": 150,
            "nutrition": {
              "kcal": 52,
              "proteinG": 4.1,
              "carbsG": 8.0,
              "fatG": 0.9
            }
          }
        ],
        "dinner": [],
        "snack": []
      }
    }
  ]
}`;
