import { afterEach, describe, expect, it } from 'vitest';
import {
  DataIntegrityError,
  IndexedDbRepository,
  StaleWriteError,
  deleteDatabaseForTests,
} from '../../data/repository';
import { createEmptyDailyLog, createFoodEntry } from '../../domain/logFactory';
import type { DailyLog, TargetSettings, UserProfile } from '../../domain/types';

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
    expect(foods).toHaveLength(2);
    const legacyFood = foods.find((food) => food.id === 'legacy-food');
    expect(legacyFood?.names).toEqual({ 'zh-CN': '旧版鸡胸肉' });
    expect('name' in (legacyFood ?? {})).toBe(false);
    expect(foods.some((food) => food.id === 'builtin-peanut-oil')).toBe(
      true,
    );

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
    expect(meta?.seedVersion).toBe(2);
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
