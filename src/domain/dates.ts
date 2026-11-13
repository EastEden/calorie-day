import { getCurrentLocale } from '../i18n/core';
import type { IsoDate } from './types';

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type FormatterKind = 'monthDay' | 'weekday' | 'longDate' | 'time';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(kind: FormatterKind, locale: string): Intl.DateTimeFormat {
  const key = `${kind}:${locale}`;
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }

  const options: Intl.DateTimeFormatOptions =
    kind === 'monthDay'
      ? { month: 'long', day: 'numeric' }
      : kind === 'weekday'
        ? { weekday: 'short' }
        : kind === 'longDate'
          ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
          : { hour: '2-digit', minute: '2-digit' };

  const formatter = new Intl.DateTimeFormat(locale, options);
  formatterCache.set(key, formatter);
  return formatter;
}

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
  return getFormatter('monthDay', getCurrentLocale()).format(
    parseIsoDate(value),
  );
}

export function formatWeekday(value: IsoDate): string {
  return getFormatter('weekday', getCurrentLocale()).format(
    parseIsoDate(value),
  );
}

export function formatShortDate(value: IsoDate): string {
  return `${formatMonthDay(value)} ${formatWeekday(value)}`;
}

export function formatLongDate(value: IsoDate): string {
  const locale = getCurrentLocale();
  const formatted = getFormatter('longDate', locale).format(
    parseIsoDate(value),
  );

  return locale.startsWith('zh')
    ? formatted.replace(/(日)(星期)/, '$1 $2')
    : formatted;
}

export function formatSavedAt(isoTimestamp: string): string {
  return getFormatter('time', getCurrentLocale()).format(
    new Date(isoTimestamp),
  );
}

export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}
