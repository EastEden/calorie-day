import { z } from 'zod';
import { addDays, getTodayIso } from './dates';
import {
  dailyLogSchema,
  foodSchema,
  getZodIssueMessages,
  isoDateSchema,
  targetSettingsSchema,
  timestampSchema,
  userProfileSchema,
} from './schemas';
import type { BackupPayload, IsoDate } from './types';

export const BACKUP_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_BACKUP_FOODS = 5_000;
export const MAX_BACKUP_LOGS = 10_000;

export const BACKUP_RANGE_PRESETS = [
  '7d',
  '30d',
  '90d',
  'all',
  'custom',
] as const;

export type BackupExportPreset = (typeof BACKUP_RANGE_PRESETS)[number];

export interface BackupDateRange {
  from: IsoDate | null;
  to: IsoDate | null;
}

export const backupPayloadSchema = z
  .object({
    backupVersion: z.literal(BACKUP_VERSION),
    exportedAt: timestampSchema,
    logsFrom: isoDateSchema.nullable(),
    logsTo: isoDateSchema.nullable(),
    profile: userProfileSchema.nullable(),
    targetSettings: targetSettingsSchema.nullable(),
    foods: z.array(foodSchema).max(MAX_BACKUP_FOODS),
    logs: z.array(dailyLogSchema).max(MAX_BACKUP_LOGS),
  })
  .superRefine((payload, ctx) => {
    if ((payload.logsFrom === null) !== (payload.logsTo === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['logsFrom'],
        message: '饮食记录范围必须同时提供开始日期和结束日期',
      });
    }

    if (
      payload.logsFrom &&
      payload.logsTo &&
      payload.logsFrom > payload.logsTo
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['logsFrom'],
        message: '饮食记录开始日期不能晚于结束日期',
      });
    }

    const foodIds = new Set<string>();
    payload.foods.forEach((food, index) => {
      if (foodIds.has(food.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['foods', index, 'id'],
          message: '备份内存在重复的食物 ID',
        });
      }
      foodIds.add(food.id);
    });

    const logDates = new Set<string>();
    payload.logs.forEach((log, index) => {
      if (logDates.has(log.date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['logs', index, 'date'],
          message: '备份内存在重复的饮食记录日期',
        });
      }
      logDates.add(log.date);
    });
  });

export function getBackupDateRange(
  preset: BackupExportPreset,
  customFrom: IsoDate,
  customTo: IsoDate,
  today = getTodayIso(),
): BackupDateRange {
  if (preset === 'all') {
    return { from: null, to: null };
  }

  if (preset === 'custom') {
    return {
      from: customFrom || null,
      to: customTo || null,
    };
  }

  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return {
    from: addDays(today, -(days - 1)),
    to: today,
  };
}

export interface BackupParseSuccess {
  success: true;
  data: BackupPayload;
}

export interface BackupParseFailure {
  success: false;
  errors: string[];
}

export function parseBackupJson(
  raw: string,
): BackupParseSuccess | BackupParseFailure {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, errors: ['文件不是有效的 JSON。'] };
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'schemaVersion' in parsed &&
    !('backupVersion' in parsed)
  ) {
    return {
      success: false,
      errors: ['这是食物库导入文件，请使用“导入 JSON”功能。'],
    };
  }

  const result = backupPayloadSchema.safeParse(parsed);

  if (!result.success) {
    return {
      success: false,
      errors: getZodIssueMessages(result.error),
    };
  }

  return {
    success: true,
    data: result.data as BackupPayload,
  };
}
