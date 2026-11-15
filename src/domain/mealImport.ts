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

export const MEAL_IMPORT_AI_PROMPT = `请把你识别到的每一餐，按下面的 JSON 格式输出。
如果识别结果涉及多天记录，请先不要输出 JSON：先用一句话向用户确认要导出的日期范围（例如“2026-11-14 到 2026-11-15”或具体哪几天）。等用户明确确认后，再只输出确认范围内的 JSON。
如果是单天记录，可以直接输出 JSON。最终输出时不要解释；优先提供独立的「复制 JSON」按钮。如果界面不支持独立按钮，则输出一个只包含纯 JSON 的 Markdown json 代码块，方便使用聊天界面的复制按钮。

规则：
1. 多天记录必须先确认日期范围，再输出 JSON。
2. 最外层必须有 "schemaVersion": 1 和 "days" 数组。
3. 每天一个对象，包含 "date"（格式 YYYY-MM-DD）和 "meals"。
4. "meals" 固定四个键：breakfast（早餐）、lunch（午餐）、dinner（晚餐）、snack（加餐）；没有的餐用空数组 []。
5. 每条食物包含 "name"（食物名称）、"amountGrams"（克数）、"nutrition"（本次摄入量的总营养）。
6. nutrition 的四个字段：kcal（热量）、proteinG（蛋白质克）、carbsG（碳水克）、fatG（脂肪克）。都是数字，按本次克数计算总量，而不是每100g。
7. 不认识或不确定的食物也要给出合理估算，名称尽量简短。
8. 必须输出严格合法的 JSON：键和字符串只能使用英文半角双引号 "，不要使用中文引号；数组直接写 [ ]，不要写成带反斜杠的方括号；没有的餐必须写空数组 []；不要输出注释、额外说明或引用块。

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
}

输出与复制规则
1. 最终生成的 JSON 必须是合法的标准 JSON，可直接使用 JSON.parse() 解析。
2. 所有字段名和字符串必须使用英文双引号 "，禁止使用中文弯引号。
3. 空数组必须完整保留为 []，不能省略。
4. 不得对 JSON 中的 [、]、{、} 等字符进行 Markdown 转义。
5. 如果界面不支持独立复制按钮，请把 JSON 放进一个 Markdown 的 json 代码块（三个反引号加 json）；代码块内只能是完整 JSON，不能包含解释、HTML 或渲染文本。不要使用引用块。
6. 优先提供独立的「复制 JSON」按钮，点击后直接将原始 JSON 字符串复制到剪贴板，不包含 Markdown、HTML、转义符或额外说明。
7. 复制按钮必须复制完整的 JSON 数据，而不是屏幕上经过排版或渲染的文本。
8. 如果当前界面支持交互式复制按钮，请使用该功能；如果不支持，则输出上述 json 代码块，不要模拟一个无法使用的按钮。
9. 保持原有的多天日期确认规则：涉及多天时，必须先确认日期范围，确认后才能生成 JSON。`;
