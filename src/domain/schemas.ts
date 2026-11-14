import { z } from 'zod';
import { ACTIVITY_LEVELS, FOOD_CATEGORIES, GOALS } from './constants';
import { ISO_DATE_PATTERN, isValidIsoDate } from './dates';
import {
  FOOD_NAME_FALLBACK_LOCALE,
  FOOD_NAME_LOCALE_PATTERN,
  MAX_FOOD_NAME_LENGTH,
  MAX_FOOD_NAME_LOCALES,
  normalizeLocalizedText,
} from './localizedText';
import type { ImportedFoodInput, LocalizedText } from './types';

const finiteNumber = z.number().finite();

const localizedNameValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_FOOD_NAME_LENGTH);

/**
 * Food names are stored as a locale -> text map. `zh-CN` is mandatory so
 * every food always has a deterministic fallback, while additional locales
 * can be imported without changing the schema version.
 */
export const localizedTextSchema = z
  .record(z.string(), localizedNameValueSchema)
  .superRefine((names, ctx) => {
    if (!(FOOD_NAME_FALLBACK_LOCALE in names)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [FOOD_NAME_FALLBACK_LOCALE],
        message: '食物名称至少需要提供 zh-CN 文本',
      });
    }

    const locales = Object.keys(names);
    if (locales.length > MAX_FOOD_NAME_LOCALES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: `食物名称最多包含 ${MAX_FOOD_NAME_LOCALES} 个语言版本`,
      });
    }

    for (const locale of locales) {
      if (!FOOD_NAME_LOCALE_PATTERN.test(locale)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [locale],
          message: '语言代码格式不正确',
        });
      }
    }
  })
  .transform((names) => normalizeLocalizedText(names as LocalizedText));

export const nutritionSchema = z.object({
  kcal: finiteNumber.min(0).max(100_000),
  proteinG: finiteNumber.min(0).max(10_000),
  carbsG: finiteNumber.min(0).max(10_000),
  fatG: finiteNumber.min(0).max(10_000),
});

export const targetNutritionSchema = nutritionSchema.superRefine((value, ctx) => {
  if (value.kcal <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['kcal'],
      message: '目标热量必须大于 0',
    });
  }
});

export const servingSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().trim().min(1).max(24),
  grams: finiteNumber.positive().max(10_000),
});

export const foodCategorySchema = z.enum([
  'protein',
  'staple',
  'egg_dairy_soy',
  'vegetable',
  'fruit',
  'fat_nut_condiment',
  'other',
]);

export const foodBasisSchema = z.enum(['raw', 'dry', 'as_sold']);

export const foodSourceSchema = z.enum(['builtin', 'custom', 'imported']);

export const timestampSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: '时间格式不正确',
  });

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_PATTERN, { message: '日期格式必须为 YYYY-MM-DD' })
  .refine(isValidIsoDate, { message: '日期无效' });

export const mealPrepBatchMetaSchema = z
  .object({
    totalGrams: finiteNumber.positive().max(100_000),
    portionGrams: finiteNumber.positive().max(100_000),
    sourceFoodId: z.string().min(1).max(120).optional(),
    disposedAt: timestampSchema.optional(),
  })
  .refine((value) => value.portionGrams <= value.totalGrams, {
    message: '每份重量不能超过总重量',
    path: ['portionGrams'],
  });

export const foodSchema = z.object({
  id: z.string().min(1).max(120),
  names: localizedTextSchema,
  category: foodCategorySchema,
  basis: foodBasisSchema,
  nutritionPer100g: nutritionSchema,
  servings: z.array(servingSchema).max(20),
  batch: mealPrepBatchMetaSchema.optional(),
  source: foodSourceSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

const importedServingSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(24),
  grams: finiteNumber.positive().max(10_000),
});

export const importedFoodSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  names: localizedTextSchema,
  category: foodCategorySchema,
  basis: foodBasisSchema,
  nutritionPer100g: nutritionSchema,
  servings: z.array(importedServingSchema).max(20).optional(),
  batch: mealPrepBatchMetaSchema.optional(),
});

export const foodImportSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: timestampSchema.optional(),
    foods: z.array(importedFoodSchema).min(1).max(1000),
  })
  .superRefine((payload, ctx) => {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    payload.foods.forEach((food, index) => {
      if (food.id) {
        if (seenIds.has(food.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['foods', index, 'id'],
            message: '导入文件内存在重复 ID',
          });
        }
        seenIds.add(food.id);
      }

      const canonicalName = food.names?.[FOOD_NAME_FALLBACK_LOCALE];
      if (typeof canonicalName !== 'string') {
        return;
      }

      const normalizedName = canonicalName
        .trim()
        .toLocaleLowerCase('zh-CN');
      if (seenNames.has(normalizedName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['foods', index, 'names', FOOD_NAME_FALLBACK_LOCALE],
          message: '导入文件内存在重复食物名称',
        });
      }
      seenNames.add(normalizedName);
    });
  });

export type FoodImportPayload = z.infer<typeof foodImportSchema>;

export const foodEntrySchema = z
  .object({
    id: z.string().min(1).max(120),
    foodId: z.string().min(1).max(120),
    foodNames: localizedTextSchema,
    amountGrams: finiteNumber.positive().max(100_000),
    enteredQuantity: finiteNumber.positive().max(100_000),
    enteredUnit: z.enum(['g', 'serving']),
    servingLabel: z.string().trim().min(1).max(24).optional(),
    servingGrams: finiteNumber.positive().max(10_000).optional(),
    nutritionPer100gSnapshot: nutritionSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((entry, ctx) => {
    if (entry.enteredUnit === 'serving') {
      if (!entry.servingLabel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['servingLabel'],
          message: '按份记录时必须提供份量名称',
        });
      }
      if (!entry.servingGrams) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['servingGrams'],
          message: '按份记录时必须提供每份克数',
        });
      }
    }
  });

export const dailyLogSchema = z.object({
  id: z.string().min(1).max(120),
  date: isoDateSchema,
  meals: z.object({
    breakfast: z.array(foodEntrySchema),
    lunch: z.array(foodEntrySchema),
    dinner: z.array(foodEntrySchema),
    snack: z.array(foodEntrySchema),
  }),
  revision: z.number().int().min(0),
  targetSnapshot: nutritionSchema.nullable().optional(),
  weightKgSnapshot: finiteNumber.min(25).max(350).nullable().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

const activityValues = ACTIVITY_LEVELS.map((item) => item.value) as [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

const goalValues = GOALS.map((item) => item.value) as ['lose', 'maintain', 'gain'];

export const userProfileSchema = z.object({
  sex: z.enum(['male', 'female']),
  age: finiteNumber.int().min(14).max(100),
  heightCm: finiteNumber.min(100).max(250),
  weightKg: finiteNumber.min(25).max(350),
  activityLevel: z.enum(activityValues),
  goal: z.enum(goalValues),
  updatedAt: timestampSchema,
});

export const targetSettingsSchema = z.object({
  mode: z.enum(['auto', 'manual']),
  manual: targetNutritionSchema.nullable(),
  updatedAt: timestampSchema,
});

export const appMetaSchema = z.object({
  schemaVersion: z.literal(2),
  seedVersion: z.literal(1),
  createdAt: timestampSchema,
});

export function getZodIssueMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '数据';
    return `${path}：${issue.message}`;
  });
}

export interface FoodImportParseSuccess {
  success: true;
  data: FoodImportPayload;
}

export interface FoodImportParseFailure {
  success: false;
  errors: string[];
}

export function parseFoodImportJson(
  raw: string,
): FoodImportParseSuccess | FoodImportParseFailure {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, errors: ['文件不是有效的 JSON。'] };
  }

  const result = foodImportSchema.safeParse(parsed);

  if (!result.success) {
    return { success: false, errors: getZodIssueMessages(result.error) };
  }

  return { success: true, data: result.data };
}

export function normalizeImportedFood(food: ImportedFoodInput): ImportedFoodInput {
  return {
    ...food,
    names: normalizeLocalizedText(food.names),
    servings: food.servings?.map((serving) => ({
      ...serving,
      label: serving.label.trim(),
    })),
  };
}

export const foodCategoryValues = FOOD_CATEGORIES;
