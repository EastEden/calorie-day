import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_RECENT_FOODS,
  clearRecentFoodIds,
  loadRecentFoodIds,
  rememberRecentFoodId,
} from '../recentFoods';

describe('recentFoods', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads an empty list when nothing has been remembered', () => {
    expect(loadRecentFoodIds()).toEqual([]);
  });

  it('moves a repeated food to the front without duplicating it', () => {
    let ids: string[] = [];
    ids = rememberRecentFoodId(ids, 'a');
    ids = rememberRecentFoodId(ids, 'b');
    ids = rememberRecentFoodId(ids, 'a');

    expect(ids).toEqual(['a', 'b']);
    expect(loadRecentFoodIds()).toEqual(['a', 'b']);
  });

  it('clears recent foods on a full local reset', () => {
    rememberRecentFoodId([], 'a');
    clearRecentFoodIds();
    expect(loadRecentFoodIds()).toEqual([]);
  });

  it('keeps only the most recent foods', () => {
    let ids: string[] = [];
    for (let index = 0; index < MAX_RECENT_FOODS + 3; index += 1) {
      ids = rememberRecentFoodId(ids, `food-${index}`);
    }

    expect(ids).toHaveLength(MAX_RECENT_FOODS);
    expect(ids[0]).toBe(`food-${MAX_RECENT_FOODS + 2}`);
  });
});
