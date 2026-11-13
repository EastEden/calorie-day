import i18n from 'i18next';
import {
  zhCN,
  type TranslationKey,
} from './locales/zh-CN';

export const DEFAULT_LOCALE = 'zh-CN';
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE] as const;

export type { TranslationKey };
export type TranslationOptions = Record<string, string | number>;

let initPromise: Promise<void> | null = null;
let metadataListenerAttached = false;

function updateDocumentMetadata() {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = i18n.language || DEFAULT_LOCALE;
  document.title = i18n.t('document.title') as string;

  const description = document.querySelector('meta[name="description"]');
  description?.setAttribute(
    'content',
    i18n.t('document.description') as string,
  );
}

async function doInitialize() {
  if (!i18n.isInitialized) {
    await i18n.init({
      resources: {
        [DEFAULT_LOCALE]: {
          translation: zhCN,
        },
      },
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: [...SUPPORTED_LOCALES],
      keySeparator: false,
      nsSeparator: false,
      interpolation: {
        escapeValue: false,
      },
      returnNull: false,
      initImmediate: false,
    });
  }

  if (!metadataListenerAttached) {
    i18n.on('languageChanged', updateDocumentMetadata);
    metadataListenerAttached = true;
  }

  updateDocumentMetadata();
}

export function initializeI18n(): Promise<void> {
  if (!initPromise) {
    initPromise = doInitialize().catch((error: unknown) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

export function getCurrentLocale(): string {
  return i18n.resolvedLanguage || i18n.language || DEFAULT_LOCALE;
}

export function translate(
  key: TranslationKey,
  options?: TranslationOptions,
  locale?: string,
): string {
  return i18n.t(key, {
    ...options,
    lng: locale ?? getCurrentLocale(),
  }) as string;
}

export function subscribeToLocale(listener: () => void): () => void {
  i18n.on('languageChanged', listener);
  return () => {
    i18n.off('languageChanged', listener);
  };
}
