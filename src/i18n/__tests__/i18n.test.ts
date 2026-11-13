import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getCurrentLocale,
  initializeI18n,
  translate,
} from '../index';

describe('i18n', () => {
  beforeAll(async () => {
    await initializeI18n();
  });

  it('uses zh-CN as the only supported locale for now', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN');
    expect([...SUPPORTED_LOCALES]).toEqual(['zh-CN']);
    expect(getCurrentLocale()).toBe('zh-CN');
  });

  it('returns Chinese UI copy for typed keys', () => {
    expect(translate('nav.diary')).toBe('今日');
    expect(translate('meals.breakfast.label')).toBe('早餐');
    expect(translate('common.kcal')).toBe('kcal');
  });

  it('interpolates values', () => {
    expect(translate('diary.target', { kcal: '2,030' })).toBe(
      '推荐目标 2,030 kcal',
    );
    expect(translate('common.foodCount', { n: 7 })).toBe('7 项食物');
  });

  it('updates the document language and metadata', () => {
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.title).toBe('每日热量 · 卡路里记录');
  });
});
