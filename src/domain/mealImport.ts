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

/**
 * Repairs common formatting mistakes from AI output without changing valid
 * meal data: Markdown fences, surrounding prose, smart quotes, escaped
 * brackets, trailing commas and missing empty meal arrays.
 */
export function repairMealImportJson(raw: string): string {
  let text = raw.replace(/^\uFEFF/, '').trim();

  text = text.replace(/```(?:json)?/gi, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    text = text.slice(start, end + 1);
  }

  text = text
    .replace(/[“”„‟]/g, '"')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\u00a0/g, ' ');

  text = text.replace(
    /("(?:breakfast|lunch|dinner|snack)")\s*:\s*(?=[,}])/g,
    '$1: []',
  );
  text = text.replace(/,\s*([}\]])/g, '$1');

  return text.trim();
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

export const MEAL_IMPORT_AI_PROMPT = `请把你识别到的每一餐，按以下 JSON 格式输出。

流程：
- 用户未提供日期且只有单天记录时，使用用户本地今天，直接输出 JSON。
- 多天记录或日期不明确时，先用一句话确认日期范围，确认后只输出该范围内的 JSON。

格式规则：
1. 最外层："schemaVersion": 1 和 "days" 数组。
2. 每天一个对象："date"（YYYY-MM-DD）和 "meals"。
3. "meals" 固定四个键：breakfast、lunch、dinner、snack；没有的餐写 []。
4. 每条食物："name"（简短名称）、"amountGrams"、"nutrition"。
5. "nutrition" 含 kcal、proteinG、carbsG、fatG，均为数字，表示本次摄入总量（不是每100g），最多保留一位小数。
6. 不确定的食物或份量，按标准份量合理估算。
7. 饮品中的添加物（牛奶、糖等）单独列为一项。

输出要求：
- 只输出一个 \`\`\`json 代码块，块内是完整、紧凑单行的 JSON，可直接被 JSON.parse() 解析。
- 键和字符串只用英文半角双引号，不转义 [ ] { }。
- 代码块外不写任何解释、注释或引用块。

示例：
{"schemaVersion":1,"days":[{"date":"2026-11-15","meals":{"breakfast":[{"name":"水煮蛋","amountGrams":50,"nutrition":{"kcal":72,"proteinG":6.3,"carbsG":0.4,"fatG":4.8}}],"lunch":[],"dinner":[],"snack":[]}}]}`;
