import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../../data/seedFoods';
import {
  getBackupDateRange,
  parseBackupJson,
  type BackupExportPreset,
} from '../backup';
import { createEmptyDailyLog, createFoodEntry } from '../logFactory';
import type {
  BackupPayload,
  DailyLog,
  Food,
  TargetSettings,
  UserProfile,
} from '../types';

const food: Food = {
  ...SEED_FOODS[0]!,
  id: 'backup-food',
  names: { 'zh-CN': '备份食物' },
};

const profile: UserProfile = {
  sex: 'male',
  age: 32,
  heightCm: 178,
  weightKg: 75,
  activityLevel: 'moderate',
  goal: 'maintain',
  updatedAt: '2026-11-13T00:00:00.000Z',
};

const settings: TargetSettings = {
  mode: 'manual',
  manual: { kcal: 2200, proteinG: 120, carbsG: 250, fatG: 60 },
  updatedAt: '2026-11-13T00:00:00.000Z',
};

function makeLog(date: string): DailyLog {
  const log = createEmptyDailyLog(date);
  log.meals.breakfast.push(
    createFoodEntry(food, {
      grams: 100,
      enteredQuantity: 100,
      enteredUnit: 'g',
    }),
  );
  return log;
}

function makeBackup(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    backupVersion: 1,
    exportedAt: '2026-11-13T12:00:00.000Z',
    logsFrom: '2026-11-12',
    logsTo: '2026-11-13',
    profile,
    targetSettings: settings,
    foods: [food],
    logs: [makeLog('2026-11-12'), makeLog('2026-11-13')],
    ...overrides,
  };
}

describe('backup', () => {
  it('calculates preset and custom date ranges', () => {
    const today = '2026-11-13';
    const cases: {
      preset: BackupExportPreset;
      from: string | null;
      to: string | null;
    }[] = [
      { preset: '7d', from: '2026-11-07', to: today },
      { preset: '30d', from: '2026-10-15', to: today },
      { preset: '90d', from: '2026-08-16', to: today },
      { preset: 'all', from: null, to: null },
    ];

    for (const item of cases) {
      expect(
        getBackupDateRange(item.preset, '2026-01-01', today, today),
      ).toEqual({ from: item.from, to: item.to });
    }

    expect(
      getBackupDateRange('custom', '2026-11-01', '2026-11-05', today),
    ).toEqual({ from: '2026-11-01', to: '2026-11-05' });
  });

  it('parses a full backup with foods, logs, profile and settings', () => {
    const result = parseBackupJson(JSON.stringify(makeBackup()));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backupVersion).toBe(1);
      expect(result.data.foods[0]?.names['zh-CN']).toBe('备份食物');
      expect(result.data.logs).toHaveLength(2);
      expect(result.data.profile?.age).toBe(32);
      expect(result.data.targetSettings?.mode).toBe('manual');
    }
  });

  it('rejects duplicate food IDs and log dates', () => {
    const result = parseBackupJson(
      JSON.stringify(
        makeBackup({
          foods: [food, food],
          logs: [makeLog('2026-11-12'), makeLog('2026-11-12')],
        }),
      ),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(' ')).toContain('重复的食物 ID');
      expect(result.errors.join(' ')).toContain('重复的饮食记录日期');
    }
  });

  it('rejects unsupported backup versions', () => {
    const result = parseBackupJson(
      JSON.stringify({ ...makeBackup(), backupVersion: 2 }),
    );
    expect(result.success).toBe(false);
  });

  it('explains when a food-library import file is selected', () => {
    const result = parseBackupJson(
      JSON.stringify({ schemaVersion: 2, foods: [] }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('食物库导入文件');
    }
  });

  it('rejects an invalid custom range', () => {
    const result = parseBackupJson(
      JSON.stringify(
        makeBackup({ logsFrom: '2026-11-14', logsTo: '2026-11-13' }),
      ),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join(' ')).toContain('开始日期不能晚于结束日期');
    }
  });
});
