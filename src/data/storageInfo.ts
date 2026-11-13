import type { StorageInfo } from '../domain/types';
import { translate } from '../i18n/core';

export async function getStorageInfo(
  requestPersistence = false,
): Promise<StorageInfo> {
  const storage =
    typeof navigator !== 'undefined' ? navigator.storage : undefined;

  if (!storage) {
    return {
      persisted: false,
      supported: false,
      usageBytes: null,
      quotaBytes: null,
    };
  }

  let persisted = false;

  try {
    if (typeof storage.persisted === 'function') {
      persisted = await storage.persisted();
    }

    if (!persisted && requestPersistence && typeof storage.persist === 'function') {
      persisted = await storage.persist();
    }
  } catch {
    persisted = false;
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;

  try {
    if (typeof storage.estimate === 'function') {
      const estimate = await storage.estimate();
      usageBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
    }
  } catch {
    // Storage estimates are optional; failure should not block the app.
  }

  return {
    persisted,
    supported: true,
    usageBytes,
    quotaBytes,
  };
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return translate('storage.unknown');
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
