import type {
  Food,
  FoodEntry,
  LocalizedText,
} from './types';

export const FOOD_NAME_FALLBACK_LOCALE = 'zh-CN';
export const MAX_FOOD_NAME_LOCALES = 20;
export const MAX_FOOD_NAME_LENGTH = 80;

/**
 * A deliberately light BCP 47-style pattern. It accepts language-only tags
 * such as `en` and common tag forms such as `zh-CN`, `pt-BR` and `zh-Hans`.
 * It is used by validation only; display code compares locale tags
 * case-insensitively.
 */
export const FOOD_NAME_LOCALE_PATTERN =
  /^[a-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;

function languageOf(locale: string): string {
  return locale.split('-')[0]?.toLocaleLowerCase() ?? '';
}

function valuesByLowerLocale(
  names: LocalizedText,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [locale, value] of Object.entries(names)) {
    if (value.trim()) {
      map.set(locale.toLocaleLowerCase(), value.trim());
    }
  }
  return map;
}

/**
 * Resolves the best available translation for a locale.
 *
 * Order: exact tag, case-insensitive tag, same language, zh-CN fallback,
 * then the first available translation. This is deliberately independent of
 * React and i18n resources so it can be reused after a future backend split.
 */
export function resolveLocalizedText(
  names: LocalizedText,
  locale: string,
): string {
  const values = valuesByLowerLocale(names);
  const requested = locale.trim().toLocaleLowerCase();

  if (!requested) {
    return names[FOOD_NAME_FALLBACK_LOCALE]?.trim() ?? '';
  }

  const exact = values.get(requested);
  if (exact) {
    return exact;
  }

  const base = languageOf(requested);
  if (base) {
    const exactBase = values.get(base);
    if (exactBase) {
      return exactBase;
    }
  }

  if (base) {
    for (const [availableLocale, value] of values) {
      if (languageOf(availableLocale) === base) {
        return value;
      }
    }
  }

  const fallback = values.get(
    FOOD_NAME_FALLBACK_LOCALE.toLocaleLowerCase(),
  );
  if (fallback) {
    return fallback;
  }

  return values.values().next().value ?? '';
}

export function getFoodDisplayName(food: Food, locale: string): string {
  return resolveLocalizedText(food.names, locale);
}

export function getEntryDisplayName(
  entry: FoodEntry,
  locale: string,
): string {
  return resolveLocalizedText(entry.foodNames, locale);
}

/** All localized names, used for search rather than identity. */
export function getFoodSearchText(food: Food): string {
  return Object.values(food.names).join(' ');
}

/**
 * Trims all values and drops empty ones. Callers should validate the result;
 * this function intentionally does not invent a missing `zh-CN` fallback.
 */
export function normalizeLocalizedText(
  names: LocalizedText,
): LocalizedText {
  const entries = Object.entries(names)
    .map(([locale, value]) => [locale.trim(), value.trim()] as const)
    .filter(([, value]) => value.length > 0);

  return Object.fromEntries(entries) as LocalizedText;
}

/** Adds or replaces the required zh-CN name while preserving other locales. */
export function withZhCnName(
  names: LocalizedText | undefined,
  name: string,
): LocalizedText {
  return {
    ...(names ?? {}),
    'zh-CN': name.trim(),
  };
}
