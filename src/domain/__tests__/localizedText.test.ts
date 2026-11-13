import { describe, expect, it } from 'vitest';
import {
  getFoodDisplayName,
  getFoodSearchText,
  normalizeLocalizedText,
  resolveLocalizedText,
  withZhCnName,
} from '../localizedText';
import type { Food } from '../types';

const names = {
  'zh-CN': '鸡胸肉',
  'en-US': 'Chicken breast',
};

describe('localizedText', () => {
  it('resolves exact and language-level matches', () => {
    expect(resolveLocalizedText(names, 'zh-CN')).toBe('鸡胸肉');
    expect(resolveLocalizedText(names, 'en-US')).toBe('Chicken breast');
    expect(resolveLocalizedText(names, 'en-GB')).toBe('Chicken breast');
    expect(resolveLocalizedText(names, 'en')).toBe('Chicken breast');
  });

  it('falls back to zh-CN', () => {
    expect(resolveLocalizedText(names, 'fr-FR')).toBe('鸡胸肉');
    expect(
      resolveLocalizedText({ 'zh-CN': '苹果' }, 'en-US'),
    ).toBe('苹果');
  });

  it('normalizes names and preserves other locales when editing zh-CN', () => {
    expect(
      normalizeLocalizedText({
        'zh-CN': ' 鸡胸肉 ',
        'en-US': ' Chicken breast ',
      }),
    ).toEqual(names);

    expect(withZhCnName(names, ' 去皮鸡胸肉 ')).toEqual({
      'zh-CN': '去皮鸡胸肉',
      'en-US': 'Chicken breast',
    });
  });

  it('provides display and search helpers', () => {
    const food = {
      id: 'food-1',
      names,
      category: 'protein',
      basis: 'raw',
      nutritionPer100g: {
        kcal: 120,
        proteinG: 22,
        carbsG: 0,
        fatG: 2,
      },
      servings: [],
      source: 'custom',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies Food;

    expect(getFoodDisplayName(food, 'en-US')).toBe('Chicken breast');
    expect(getFoodSearchText(food)).toContain('鸡胸肉');
    expect(getFoodSearchText(food)).toContain('Chicken breast');
  });
});
