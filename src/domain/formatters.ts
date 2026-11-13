import type { FoodEntry } from './types';

const numberFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function formatKcal(value: number): string {
  return numberFormatter.format(Math.round(Number.isFinite(value) ? value : 0));
}

export function formatDecimal(value: number): string {
  return decimalFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatGrams(value: number): string {
  return `${formatDecimal(value)} g`;
}

export function formatPercent(value: number): string {
  return `${numberFormatter.format(Math.round(Number.isFinite(value) ? value : 0))}%`;
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
    return `${formatDecimal(entry.enteredQuantity)} ${entry.servingLabel} · ${formatKcal(
      entry.amountGrams,
    )} g`;
  }

  return `${formatKcal(entry.amountGrams)} g`;
}
