import { getCurrentLocale } from '../i18n/core';
import type { FoodEntry } from './types';

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(
  kind: 'integer' | 'decimal',
  locale: string,
): Intl.NumberFormat {
  const key = `${kind}:${locale}`;
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(
    locale,
    kind === 'integer'
      ? { maximumFractionDigits: 0 }
      : { maximumFractionDigits: 1, minimumFractionDigits: 0 },
  );
  formatterCache.set(key, formatter);
  return formatter;
}

export function formatKcal(value: number): string {
  return getFormatter('integer', getCurrentLocale()).format(
    Math.round(Number.isFinite(value) ? value : 0),
  );
}

export function formatDecimal(value: number): string {
  return getFormatter('decimal', getCurrentLocale()).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatGrams(value: number): string {
  return `${formatDecimal(value)} g`;
}

export function formatPercent(value: number): string {
  return `${getFormatter('integer', getCurrentLocale()).format(
    Math.round(Number.isFinite(value) ? value : 0),
  )}%`;
}

export function formatSignedKcal(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return '0 kcal';
  }
  return `${rounded > 0 ? '+' : '−'}${formatKcal(Math.abs(rounded))} kcal`;
}

export function formatEntryAmount(entry: FoodEntry): string {
  if (
    entry.enteredUnit === 'serving' &&
    entry.servingLabel &&
    Number.isFinite(entry.enteredQuantity)
  ) {
    return `${formatDecimal(entry.enteredQuantity)} ${entry.servingLabel} · ${formatDecimal(
      entry.amountGrams,
    )} g`;
  }

  return `${formatDecimal(entry.amountGrams)} g`;
}
