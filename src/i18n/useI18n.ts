import {
  useCallback,
  useSyncExternalStore,
} from 'react';
import {
  getCurrentLocale,
  subscribeToLocale,
  translate,
  type TranslationKey,
  type TranslationOptions,
} from './core';

export function useI18n() {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getCurrentLocale,
    getCurrentLocale,
  );

  const t = useCallback(
    (key: TranslationKey, options?: TranslationOptions) =>
      translate(key, options, locale),
    [locale],
  );

  return {
    locale,
    t,
  };
}
