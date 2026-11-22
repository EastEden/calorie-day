import { addDays } from './dates';
import { MEAL_TYPES } from './constants';
import {
  addNutrition,
  emptyNutrition,
  scaleNutrition,
  sumEntries,
} from './nutrition';
import type {
  DailyLog,
  IsoDate,
  Nutrition,
} from './types';

export type TrendRangeDays = 7 | 30;

export interface TrendDayPoint {
  date: IsoDate;
  hasEntries: boolean;
  entryCount: number;
  totals: Nutrition;
  target: Nutrition | null;
  isToday: boolean;
  isComplete: boolean;
}

export interface TrendData {
  rangeDays: TrendRangeDays;
  from: IsoDate;
  to: IsoDate;
  points: TrendDayPoint[];
  totalDays: number;
  loggedDays: number;
  completedLoggedDays: number;
  averageIntake: Nutrition | null;
  averageTargetKcal: number | null;
  withinTargetDays: number;
  overTargetDays: number;
}

interface BuildTrendDataInput {
  logs: DailyLog[];
  rangeDays: TrendRangeDays;
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
  fallbackTarget: Nutrition | null;
}

function getLogTotals(log: DailyLog | undefined): {
  totals: Nutrition;
  entryCount: number;
} {
  if (!log) {
    return { totals: emptyNutrition(), entryCount: 0 };
  }

  let totals = emptyNutrition();
  let entryCount = 0;
  for (const mealType of MEAL_TYPES) {
    const entries = log.meals[mealType];
    totals = addNutrition(totals, sumEntries(entries));
    entryCount += entries.length;
  }
  return { totals, entryCount };
}

export function buildTrendData({
  logs,
  rangeDays,
  from,
  to,
  today,
  fallbackTarget,
}: BuildTrendDataInput): TrendData {
  if (from > to) {
    throw new Error('趋势日期范围无效');
  }

  const logByDate = new Map(logs.map((log) => [log.date, log]));
  const points: TrendDayPoint[] = [];

  let cursor = from;
  while (cursor <= to) {
    const log = logByDate.get(cursor);
    const { totals, entryCount } = getLogTotals(log);
    points.push({
      date: cursor,
      hasEntries: entryCount > 0,
      entryCount,
      totals,
      target: log?.targetSnapshot ?? fallbackTarget,
      isToday: cursor === today,
      isComplete: cursor < today,
    });
    cursor = addDays(cursor, 1);
  }

  const loggedPoints = points.filter((point) => point.hasEntries);
  const completedLoggedPoints = loggedPoints.filter(
    (point) => point.isComplete,
  );
  const averageIntake =
    completedLoggedPoints.length > 0
      ? scaleNutrition(
          completedLoggedPoints.reduce(
            (total, point) => addNutrition(total, point.totals),
            emptyNutrition(),
          ),
          1 / completedLoggedPoints.length,
        )
      : null;

  const completedTargetKcal = completedLoggedPoints
    .map((point) => point.target?.kcal)
    .filter((value): value is number => typeof value === 'number');
  const averageTargetKcal =
    completedTargetKcal.length > 0
      ? completedTargetKcal.reduce((sum, value) => sum + value, 0) /
        completedTargetKcal.length
      : null;

  const withinTargetDays = completedLoggedPoints.filter(
    (point) =>
      point.target !== null && point.totals.kcal <= point.target.kcal,
  ).length;
  const overTargetDays = completedLoggedPoints.filter(
    (point) =>
      point.target !== null && point.totals.kcal > point.target.kcal,
  ).length;

  return {
    rangeDays,
    from,
    to,
    points,
    totalDays: points.length,
    loggedDays: loggedPoints.length,
    completedLoggedDays: completedLoggedPoints.length,
    averageIntake,
    averageTargetKcal,
    withinTargetDays,
    overTargetDays,
  };
}
