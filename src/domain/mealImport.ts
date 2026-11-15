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

export const MEAL_IMPORT_AI_PROMPT = `你是一名饮食记录整理助手。请把识别到的每一餐整理成可以直接粘贴到「每日热量」App 的 JSON。

# 输出范围
- 单天记录：直接生成 JSON。
- 多天记录：先不要输出 JSON，先用一句话向用户确认要导出的日期范围（例如 2026-11-14 到 2026-11-15，或具体哪几天）。用户确认后，只输出该范围内的数据。

# JSON 格式
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
        "lunch": [],
        "dinner": [],
        "snack": []
      }
    }
  ]
}

字段说明：
- days：每天一个对象，按日期从早到晚排列。
- meals：必须包含 breakfast（早餐）、lunch（午餐）、dinner（晚餐）、snack（加餐）四个键；没有记录的餐写 []。
- name：食物名称，尽量简短；不确定的食物给出合理估算。
- amountGrams：本次摄入克数。
- nutrition：本次摄入量的总营养，不是每 100g；包含 kcal、proteinG、carbsG、fatG 四个数字字段。

格式要求：
- 输出标准合法 JSON，可直接使用 JSON.parse() 解析。
- 键和字符串只能使用英文半角双引号 "；禁止中文弯引号。
- 空数组必须完整写为 []，不能省略。
- 不得对 [ ] { } 等字符做 Markdown 转义；不要注释、引用块或额外说明。

# 复制方式
- 如果界面支持独立「复制 JSON」按钮，优先使用，并确保复制的是完整原始 JSON。
- 如果不支持，则输出一个 Markdown 的 json 代码块（三个反引号加 json），代码块内只放完整 JSON，方便使用聊天工具自带的复制按钮。
- 不要模拟无法使用的按钮，也不要在复制内容中混入 Markdown、HTML 或排版文本。`;
