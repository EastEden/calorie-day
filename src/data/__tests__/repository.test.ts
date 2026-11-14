import { afterEach, describe, expect, it } from 'vitest';
import {
  DataIntegrityError,
  IndexedDbRepository,
  StaleWriteError,
  deleteDatabaseForTests,
} from '../../data/repository';
import { createEmptyDailyLog, createFoodEntry } from '../../domain/logFactory';
import type {
  BackupPayload,
  DailyLog,
  Food,
  TargetSettings,
  UserProfile,
} from '../../domain/types';
import { SEED_FOODS } from '../../data/seedFoods';

let dbName = '';
let repository: IndexedDbRepository | null = null;

function createRepository(): IndexedDbRepository {
  repository = new IndexedDbRepository({ dbName });
  return repository;
}

const profile: UserProfile = {
  sex: 'female',
  age: 28,
  heightCm: 165,
  weightKg: 58,
  activityLevel: 'light',
  goal: 'lose',
  updatedAt: '2026-11-13T00:00:00.000Z',
};

const settings: TargetSettings = {
  mode: 'manual',
  manual: { kcal: 1800, proteinG: 100, carbsG: 200, fatG: 60 },
  updatedAt: '2026-11-13T00:00:00.000Z',
};

function makeLog(date = '2026-11-13'): DailyLog {
  return createEmptyDailyLog(date);
}

const backupFood: Food = {
  ...SEED_FOODS[0]!,
  id: 'backup-food',
  names: { 'zh-CN': '备份食物' },
};

const backupProfile: UserProfile = {
  ...profile,
  age: 40,
  updatedAt: '2026-11-14T00:00:00.000Z',
};

const backupSettings: TargetSettings = {
  mode: 'manual',
  manual: { kcal: 2100, proteinG: 130, carbsG: 220, fatG: 65 },
  updatedAt: '2026-11-14T00:00:00.000Z',
};

function makeBackupLog(date = '2026-11-14'): DailyLog {
  const log = createEmptyDailyLog(date);
  log.meals.breakfast.push(
    createFoodEntry(backupFood, {
      grams: 120,
      enteredQuantity: 120,
      enteredUnit: 'g',
    }),
  );
  return log;
}

function makeBackupPayload(
  overrides: Partial<BackupPayload> = {},
): BackupPayload {
  return {
    backupVersion: 1,
    exportedAt: '2026-11-14T00:00:00.000Z',
    logsFrom: '2026-11-13',
    logsTo: '2026-11-14',
    profile: backupProfile,
    targetSettings: backupSettings,
    foods: [backupFood],
    logs: [makeBackupLog()],
    ...overrides,
  };
}

function createLegacyV1Database(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      const transaction = request.transaction!;

      db.createObjectStore('meta');
      db.createObjectStore('profile');
      db.createObjectStore('settings');
      const foods = db.createObjectStore('foods', { keyPath: 'id' });
      foods.createIndex('by_category', 'category', { unique: false });
      foods.createIndex('by_name', 'name', { unique: false });
      const logs = db.createObjectStore('logs', { keyPath: 'date' });
      logs.createIndex('by_updated_at', 'updatedAt', { unique: false });

      const food = {
        id: 'legacy-food',
        name: '旧版鸡胸肉',
        category: 'protein',
        basis: 'raw',
        nutritionPer100g: {
          kcal: 120,
          proteinG: 22.5,
          carbsG: 0,
          fatG: 2.6,
        },
        servings: [],
        source: 'custom',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const log = {
        id: 'legacy-log',
        date: '2026-11-13',
        meals: {
          breakfast: [
            {
              id: 'legacy-entry',
              foodId: food.id,
              foodName: food.name,
              amountGrams: 100,
              enteredQuantity: 100,
              enteredUnit: 'g',
              nutritionPer100gSnapshot: food.nutritionPer100g,
              createdAt: food.createdAt,
              updatedAt: food.updatedAt,
            },
          ],
          lunch: [],
          dinner: [],
          snack: [],
        },
        revision: 1,
        createdAt: food.createdAt,
        updatedAt: food.updatedAt,
      };

      transaction.objectStore('foods').put(food);
      transaction.objectStore('logs').put(log);
      transaction.objectStore('meta').put(
        {
          schemaVersion: 1,
          seedVersion: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        'app',
      );
    };

    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

afterEach(async () => {
  if (repository) {
    await repository.close();
    repository = null;
  }
  if (dbName) {
    await deleteDatabaseForTests(dbName);
  }
  dbName = '';
});

describe('IndexedDbRepository', () => {
  it('seeds the built-in food library and does not duplicate it on reopen', async () => {
    dbName = `calorie-test-seed-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    const firstCount = (await repo.listFoods()).length;
    expect(firstCount).toBeGreaterThan(50);

    await repo.close();
    const reopened = createRepository();
    await reopened.initialize();

    expect((await reopened.listFoods()).length).toBe(firstCount);
  });

  it('resets only built-in foods when the seed version changes', async () => {
    dbName = `calorie-test-seed-reset-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();

    const customFood: Food = {
      ...SEED_FOODS[0]!,
      id: 'custom-keep',
      names: { 'zh-CN': '保留的自定义食物' },
      source: 'custom',
    };
    await repo.saveFood(customFood);
    await repo.saveDailyLog(makeLog('2026-11-13'));

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        ['meta', 'foods'],
        'readwrite',
      );
      transaction.objectStore('foods').delete('builtin-black-coffee');
      const metaStore = transaction.objectStore('meta');
      const get = metaStore.get('app');
      get.onsuccess = () => {
        metaStore.put(
          { ...get.result, seedVersion: 4 },
          'app',
        );
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    await repo.close();

    const reopened = createRepository();
    await reopened.initialize();
    const foods = await reopened.listFoods();

    expect(foods).toHaveLength(57);
    expect(
      foods.some((food) => food.id === 'builtin-black-coffee'),
    ).toBe(true);
    expect(
      foods.some((food) => food.id === 'custom-keep'),
    ).toBe(true);
    expect(await reopened.getDailyLog('2026-11-13')).not.toBeNull();
  });

  it('persists profile and target settings across repository instances', async () => {
    dbName = `calorie-test-profile-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    await repo.saveProfile(profile);
    await repo.saveTargetSettings(settings);
    await repo.close();

    const reopened = createRepository();
    await reopened.initialize();
    expect(await reopened.getProfile()).toEqual(profile);
    expect(await reopened.getTargetSettings()).toEqual(settings);
  });

  it('persists a daily log across repository instances', async () => {
    dbName = `calorie-test-log-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    const food = (await repo.listFoods())[0];
    expect(food).toBeDefined();

    const log = makeLog();
    const entry = createFoodEntry(food!, {
      grams: 150,
      enteredQuantity: 150,
      enteredUnit: 'g',
    });
    log.meals.breakfast.push(entry);

    const saved = await repo.saveDailyLog(log);
    expect(saved.revision).toBe(1);

    await repo.close();
    const reopened = createRepository();
    await reopened.initialize();
    const loaded = await reopened.getDailyLog('2026-11-13');

    expect(loaded?.meals.breakfast).toHaveLength(1);
    expect(loaded?.meals.breakfast[0]?.foodNames['zh-CN']).toBe(
      food!.names['zh-CN'],
    );
    expect(loaded?.meals.breakfast[0]?.amountGrams).toBe(150);
    expect(loaded?.revision).toBe(1);
  });

  it('lists daily logs within a date range', async () => {
    dbName = `calorie-test-log-range-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();

    for (const date of ['2026-11-10', '2026-11-11', '2026-11-12']) {
      await repo.saveDailyLog(makeLog(date));
    }

    const logs = await repo.listDailyLogs('2026-11-11', '2026-11-12');
    expect(logs.map((log) => log.date)).toEqual([
      '2026-11-11',
      '2026-11-12',
    ]);
    expect(await repo.listDailyLogs()).toHaveLength(3);
  });

  it('backfills log target and weight snapshots only when missing', async () => {
    dbName = `calorie-test-snapshots-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    await repo.saveDailyLog(makeLog('2026-11-10'));
    await repo.saveDailyLog(makeLog('2026-11-11'));

    const target = {
      kcal: 1800,
      proteinG: 100,
      carbsG: 200,
      fatG: 60,
    };
    await repo.backfillDailyLogSnapshots(target, 58);

    const first = await repo.getDailyLog('2026-11-10');
    expect(first?.targetSnapshot).toEqual(target);
    expect(first?.weightKgSnapshot).toBe(58);

    const customTarget = {
      kcal: 2000,
      proteinG: 110,
      carbsG: 220,
      fatG: 65,
    };
    const customLog = makeLog('2026-11-12');
    customLog.targetSnapshot = customTarget;
    customLog.weightKgSnapshot = 60;
    await repo.saveDailyLog(customLog);
    await repo.backfillDailyLogSnapshots(target, 58);

    const preserved = await repo.getDailyLog('2026-11-12');
    expect(preserved?.targetSnapshot).toEqual(customTarget);
    expect(preserved?.weightKgSnapshot).toBe(60);

    await repo.updateDailyLogSnapshot('2026-11-10', customTarget, 60);
    const updatedToday = await repo.getDailyLog('2026-11-10');
    expect(updatedToday?.targetSnapshot).toEqual(customTarget);
    expect(updatedToday?.weightKgSnapshot).toBe(60);
  });

  it('sums consumed grams for a batch food across daily logs', async () => {
    dbName = `calorie-test-food-usage-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    const batchFood: Food = {
      ...SEED_FOODS[0]!,
      id: 'batch-food',
      names: { 'zh-CN': '备餐测试' },
      batch: { totalGrams: 1000, portionGrams: 250 },
    };
    await repo.saveFood(batchFood);

    for (const [date, grams] of [
      ['2026-11-10', 200],
      ['2026-11-11', 300],
    ] as const) {
      const log = makeLog(date);
      log.meals.lunch.push(
        createFoodEntry(batchFood, {
          grams,
          enteredQuantity: grams,
          enteredUnit: 'g',
        }),
      );
      await repo.saveDailyLog(log);
    }

    expect(await repo.getFoodUsage()).toMatchObject({
      'batch-food': 500,
    });
  });

  it('imports missing profile, settings, foods and logs from a backup', async () => {
    dbName = `calorie-test-backup-fill-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();

    const result = await repo.importBackup(makeBackupPayload());

    expect(result).toEqual({
      foodsAdded: 1,
      foodsSkipped: 0,
      logsAdded: 1,
      logsSkipped: 0,
      profileImported: true,
      settingsImported: true,
    });
    expect((await repo.getProfile())?.age).toBe(40);
    expect((await repo.getTargetSettings()).manual).toEqual(
      backupSettings.manual,
    );
    expect(
      (await repo.listFoods()).some((food) => food.id === 'backup-food'),
    ).toBe(true);
    expect(
      (await repo.getDailyLog('2026-11-14'))?.meals.breakfast,
    ).toHaveLength(1);
  });

  it('preserves existing data when importing a full backup', async () => {
    dbName = `calorie-test-backup-merge-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    await repo.saveProfile(profile);
    await repo.saveTargetSettings(settings);
    await repo.saveDailyLog(makeLog('2026-11-13'));

    const result = await repo.importBackup(
      makeBackupPayload({
        profile: backupProfile,
        targetSettings: backupSettings,
        logs: [
          makeBackupLog('2026-11-13'),
          makeBackupLog('2026-11-14'),
        ],
      }),
    );

    expect(result).toEqual({
      foodsAdded: 1,
      foodsSkipped: 0,
      logsAdded: 1,
      logsSkipped: 1,
      profileImported: false,
      settingsImported: false,
    });
    expect((await repo.getProfile())?.age).toBe(28);
    expect((await repo.getTargetSettings()).manual).toEqual(settings.manual);
    expect(
      (await repo.getDailyLog('2026-11-13'))?.meals.breakfast,
    ).toHaveLength(0);
    expect(
      (await repo.getDailyLog('2026-11-14'))?.meals.breakfast,
    ).toHaveLength(1);
  });

  it('rejects a stale write and leaves the stored record unchanged', async () => {
    dbName = `calorie-test-stale-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    const food = (await repo.listFoods())[0]!;
    const log = makeLog();
    log.meals.breakfast.push(
      createFoodEntry(food, {
        grams: 100,
        enteredQuantity: 100,
        enteredUnit: 'g',
      }),
    );

    const saved = await repo.saveDailyLog(log);

    await expect(repo.saveDailyLog(log)).rejects.toBeInstanceOf(
      StaleWriteError,
    );

    const loaded = await repo.getDailyLog('2026-11-13');
    expect(loaded?.revision).toBe(saved.revision);
    expect(loaded?.meals.breakfast).toHaveLength(1);
  });

  it('writes a later revision using the revision returned by the repository', async () => {
    dbName = `calorie-test-revision-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    const food = (await repo.listFoods())[0]!;
    const log = makeLog();
    const saved = await repo.saveDailyLog(log);

    const updated: DailyLog = {
      ...saved,
      meals: {
        ...saved.meals,
        lunch: [
          createFoodEntry(food, {
            grams: 80,
            enteredQuantity: 80,
            enteredUnit: 'g',
          }),
        ],
      },
    };

    const second = await repo.saveDailyLog(updated);
    expect(second.revision).toBe(2);
    expect((await repo.getDailyLog('2026-11-13'))?.meals.lunch).toHaveLength(1);
  });

  it('does not reseed built-in foods after the user deletes one', async () => {
    dbName = `calorie-test-delete-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    const foods = await repo.listFoods();
    const initialCount = foods.length;
    await repo.deleteFood(foods[0]!.id);
    await repo.close();

    const reopened = createRepository();
    await reopened.initialize();
    expect((await reopened.listFoods()).length).toBe(initialCount - 1);
  });

  it('deletes all app data and re-seeds a fresh database on reset', async () => {
    dbName = `calorie-test-reset-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();
    const food = (await repo.listFoods())[0]!;
    await repo.saveProfile(profile);
    await repo.saveTargetSettings(settings);

    const log = makeLog();
    log.meals.breakfast.push(
      createFoodEntry(food, {
        grams: 100,
        enteredQuantity: 100,
        enteredUnit: 'g',
      }),
    );
    await repo.saveDailyLog(log);

    await repo.resetAllData();
    await repo.initialize();

    expect(await repo.getProfile()).toBeNull();
    expect((await repo.getDailyLog('2026-11-13'))).toBeNull();
    expect((await repo.getTargetSettings()).mode).toBe('auto');
    expect((await repo.listFoods()).length).toBeGreaterThan(50);
  });

  it('migrates v1 food names and entry snapshots to localized maps', async () => {
    dbName = `calorie-test-migration-${Date.now()}-${Math.random()}`;
    await createLegacyV1Database(dbName);
    const repo = createRepository();
    await repo.initialize();

    const foods = await repo.listFoods();
    expect(foods).toHaveLength(1);
    const legacyFood = foods.find((food) => food.id === 'legacy-food');
    expect(legacyFood?.names).toEqual({ 'zh-CN': '旧版鸡胸肉' });
    expect('name' in (legacyFood ?? {})).toBe(false);

    const log = await repo.getDailyLog('2026-11-13');
    expect(log?.meals.breakfast[0]?.foodNames).toEqual({
      'zh-CN': '旧版鸡胸肉',
    });
    expect(
      'foodName' in (log?.meals.breakfast[0] ?? {}),
    ).toBe(false);

    const rawDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(rawDb.version).toBe(2);
    const meta = await new Promise<{
      schemaVersion?: number;
      seedVersion?: number;
    } | undefined>(
      (resolve, reject) => {
        const transaction = rawDb.transaction('meta', 'readonly');
        const request = transaction.objectStore('meta').get('app');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    expect(meta?.schemaVersion).toBe(2);
    expect(meta?.seedVersion).toBe(1);
    rawDb.close();
  });

  it('reports corrupted stored data instead of silently overwriting it', async () => {
    dbName = `calorie-test-integrity-${Date.now()}-${Math.random()}`;
    const repo = createRepository();
    await repo.initialize();

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('profile', 'readwrite');
      transaction.objectStore('profile').put({ broken: true }, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();

    await expect(repo.getProfile()).rejects.toBeInstanceOf(DataIntegrityError);
  });
});
