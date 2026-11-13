import type { IsoDate } from './types';

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const monthDayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
});

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', {
  weekday: 'short',
});

const longDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});

export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function parseIsoDate(value: IsoDate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function addDays(value: IsoDate, amount: number): IsoDate {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

export function isToday(value: IsoDate, today = getTodayIso()): boolean {
  return value === today;
}

export function isFutureDate(value: IsoDate, today = getTodayIso()): boolean {
  return value > today;
}

export function formatMonthDay(value: IsoDate): string {
  return monthDayFormatter.format(parseIsoDate(value));
}

export function formatWeekday(value: IsoDate): string {
  return weekdayFormatter.format(parseIsoDate(value));
}

export function formatShortDate(value: IsoDate): string {
  return `${formatMonthDay(value)} ${formatWeekday(value)}`;
}

export function formatLongDate(value: IsoDate): string {
  return longDateFormatter
    .format(parseIsoDate(value))
    .replace(/(日)(星期)/, '$1 $2');
}

export function formatRelativeDay(value: IsoDate, today = getTodayIso()): string {
  if (value === today) {
    return '今天';
  }

  if (value === addDays(today, -1)) {
    return '昨天';
  }

  return formatShortDate(value);
}

export function formatDayContext(value: IsoDate, today = getTodayIso()): string {
  if (value === today) {
    return `今天 · ${formatShortDate(value)}`;
  }

  return formatShortDate(value);
}

export function formatSavedAt(isoTimestamp: string): string {
  return timeFormatter.format(new Date(isoTimestamp));
}

export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}
