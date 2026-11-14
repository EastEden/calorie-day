const STORAGE_KEY = 'calorie-day:recent-foods';
export const MAX_RECENT_FOODS = 8;

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadRecentFoodIds(): string[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, MAX_RECENT_FOODS);
  } catch {
    return [];
  }
}

export function clearRecentFoodIds(): void {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Recent selections are a convenience; storage failures must not block.
  }
}

export function rememberRecentFoodId(
  current: string[],
  foodId: string,
): string[] {
  const next = [foodId, ...current.filter((id) => id !== foodId)].slice(
    0,
    MAX_RECENT_FOODS,
  );

  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Recent selections are a convenience; storage failures must not block.
  }

  return next;
}
