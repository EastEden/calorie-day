import { describe, expect, it } from 'vitest';
import { addDays } from '../../domain/dates';
import { createEmptyDailyLog, createFoodEntry } from '../../domain/logFactory';
import { buildTrendData } from '../../domain/trends';
import type {
  DailyLog,
  Food,
  IsoDate,
  Nutrition,
} from '../../domain/types';

const food: Food = {
  id: 'trend-food',
  names: { 'zh-CN': '趋势测试食物' },
  category: 'other',
  basis: 'as_sold',
  nutritionPer100g: {
    kcal: 100,
    proteinG: 10,
    carbsG: 10,
    fatG: 5,
  },
  servings: [],
  source: 'custom',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const target: Nutrition = {
  kcal: 2000,
  proteinG: 100,
  carbsG: 200,
  fatG: 60,
};

function makeLog(
  date: IsoDate,
  kcal: number,
  targetSnapshot: Nutrition | null = target,
): DailyLog {
  const log = createEmptyDailyLog(date);
  log.targetSnapshot = targetSnapshot;
  log.meals.breakfast.push(
    createFoodEntry(food, {
      grams: kcal,
      enteredQuantity: kcal,
      enteredUnit: 'g',
    }),
  );
  return log;
}

const today = '2026-11-21';
const from7 = addDays(today, -6);

describe('trends', () => {
  it('builds one point per day for 7 and 30 day ranges', () => {
    const seven = buildTrendData({
      logs: [],
      rangeDays: 7,
      from: from7,
      to: today,
      today,
      fallbackTarget: target,
    });
    expect(seven.points).toHaveLength(7);
    expect(seven.points[0]?.date).toBe('2026-11-15');
    expect(seven.points[6]?.date).toBe(today);
    expect(seven.points[6]?.isToday).toBe(true);
    expect(seven.points[0]?.isComplete).toBe(true);

    const thirty = buildTrendData({
      logs: [],
      rangeDays: 30,
      from: addDays(today, -29),
      to: today,
      today,
      fallbackTarget: target,
    });
    expect(thirty.points).toHaveLength(30);
  });

  it('keeps missing days as gaps and excludes them from averages', () => {
    const logs = [
      makeLog('2026-11-16', 1000),
      makeLog('2026-11-19', 3000),
    ];
    const data = buildTrendData({
      logs,
      rangeDays: 7,
      from: from7,
      to: today,
      today,
      fallbackTarget: target,
    });

    const missing = data.points.find((point) => point.date === '2026-11-17');
    expect(missing?.hasEntries).toBe(false);
    expect(missing?.entryCount).toBe(0);
    expect(missing?.totals.kcal).toBe(0);
    expect(data.loggedDays).toBe(2);
    expect(data.averageIntake?.kcal).toBe(2000);
  });

  it('excludes today from average and target adherence', () => {
    const logs = [
      makeLog('2026-11-19', 1000),
      makeLog(today, 500),
    ];
    const data = buildTrendData({
      logs,
      rangeDays: 7,
      from: from7,
      to: today,
      today,
      fallbackTarget: target,
    });

    expect(data.loggedDays).toBe(2);
    expect(data.completedLoggedDays).toBe(1);
    expect(data.averageIntake?.kcal).toBe(1000);
    expect(data.withinTargetDays).toBe(1);
    expect(data.overTargetDays).toBe(0);
  });

  it('uses the day target snapshot and falls back to the current target', () => {
    const lowTarget: Nutrition = {
      kcal: 1500,
      proteinG: 80,
      carbsG: 150,
      fatG: 50,
    };
    const logs = [
      makeLog('2026-11-19', 1800, lowTarget),
      makeLog('2026-11-20', 1800, null),
    ];
    const data = buildTrendData({
      logs,
      rangeDays: 7,
      from: from7,
      to: today,
      today,
      fallbackTarget: target,
    });

    expect(data.points.find((point) => point.date === '2026-11-19')?.target)
      .toEqual(lowTarget);
    expect(data.points.find((point) => point.date === '2026-11-20')?.target)
      .toEqual(target);
    expect(data.overTargetDays).toBe(1);
    expect(data.withinTargetDays).toBe(1);
  });

  it('keeps dates continuous across month boundaries', () => {
    const data = buildTrendData({
      logs: [],
      rangeDays: 7,
      from: '2026-10-29',
      to: '2026-11-04',
      today: '2026-11-04',
      fallbackTarget: null,
    });

    expect(data.points.map((point) => point.date)).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
  });

  it('returns empty aggregates when there are no entries', () => {
    const data = buildTrendData({
      logs: [],
      rangeDays: 7,
      from: from7,
      to: today,
      today,
      fallbackTarget: target,
    });

    expect(data.loggedDays).toBe(0);
    expect(data.completedLoggedDays).toBe(0);
    expect(data.averageIntake).toBeNull();
    expect(data.averageTargetKcal).toBeNull();
    expect(data.withinTargetDays).toBe(0);
    expect(data.overTargetDays).toBe(0);
  });

  it('rejects an inverted date range', () => {
    expect(() =>
      buildTrendData({
        logs: [],
        rangeDays: 7,
        from: today,
        to: from7,
        today,
        fallbackTarget: target,
      }),
    ).toThrow();
  });
});
