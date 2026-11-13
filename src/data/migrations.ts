const STORE_NAMES = {
  meta: 'meta',
  foods: 'foods',
  logs: 'logs',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * v1 foods stored a single `name` string. v2 stores locale -> name maps and
 * requires zh-CN. Existing Chinese names become the zh-CN fallback.
 */
export function migrateStoredFoodV1ToV2(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const { name, ...rest } = value;

  if (isRecord(value.names)) {
    return name === undefined ? value : rest;
  }

  if (typeof name !== 'string') {
    return value;
  }

  return {
    ...rest,
    names: {
      'zh-CN': name,
    },
  };
}

export function migrateFoodEntryV1ToV2(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const { foodName, ...rest } = value;

  if (isRecord(value.foodNames)) {
    return foodName === undefined ? value : rest;
  }

  if (typeof foodName !== 'string') {
    return value;
  }

  return {
    ...rest,
    foodNames: {
      'zh-CN': foodName,
    },
  };
}

function migrateEntries(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((entry) => migrateFoodEntryV1ToV2(entry));
}

export function migrateDailyLogV1ToV2(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.meals)) {
    return value;
  }

  const meals = Object.fromEntries(
    Object.entries(value.meals).map(([mealType, entries]) => [
      mealType,
      migrateEntries(entries),
    ]),
  );

  return {
    ...value,
    meals,
  };
}

function migrateStore(
  store: IDBObjectStore,
  migrate: (value: unknown) => unknown,
) {
  const request = store.openCursor();

  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) {
      return;
    }

    const nextValue = migrate(cursor.value);
    if (nextValue !== cursor.value) {
      cursor.update(nextValue);
    }
    cursor.continue();
  };
}

function migrateMetaStore(transaction: IDBTransaction) {
  const store = transaction.objectStore(STORE_NAMES.meta);
  const request = store.get('app');

  request.onsuccess = () => {
    const meta = request.result;
    if (!isRecord(meta) || meta.schemaVersion === 2) {
      return;
    }

    store.put(
      {
        ...meta,
        schemaVersion: 2,
      },
      'app',
    );
  };
}

/**
 * Runs inside the IndexedDB versionchange transaction. It removes the old
 * `by_name` index, migrates foods/logs, and updates the app metadata version.
 */
export function upgradeDatabaseV1ToV2(transaction: IDBTransaction) {
  if (transaction.objectStoreNames.contains(STORE_NAMES.foods)) {
    const foodStore = transaction.objectStore(STORE_NAMES.foods);
    if (foodStore.indexNames.contains('by_name')) {
      foodStore.deleteIndex('by_name');
    }
    migrateStore(foodStore, migrateStoredFoodV1ToV2);
  }

  if (transaction.objectStoreNames.contains(STORE_NAMES.logs)) {
    migrateStore(
      transaction.objectStore(STORE_NAMES.logs),
      migrateDailyLogV1ToV2,
    );
  }

  if (transaction.objectStoreNames.contains(STORE_NAMES.meta)) {
    migrateMetaStore(transaction);
  }
}
