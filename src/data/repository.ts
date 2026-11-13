import type { z } from 'zod';
import { nowIsoTimestamp } from '../domain/dates';
import {
  dailyLogSchema,
  foodSchema,
  getZodIssueMessages,
  isoDateSchema,
  targetSettingsSchema,
  userProfileSchema,
} from '../domain/schemas';
import type {
  DailyLog,
  Food,
  TargetSettings,
  UserProfile,
} from '../domain/types';
import { SEED_FOODS, SEED_VERSION } from './seedFoods';

const DEFAULT_DB_NAME = 'calorie-day';
const DB_VERSION = 1;

const STORES = {
  meta: 'meta',
  profile: 'profile',
  settings: 'settings',
  foods: 'foods',
  logs: 'logs',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

interface AppMeta {
  schemaVersion: 1;
  seedVersion: 1;
  createdAt: string;
}

export interface CalorieRepository {
  initialize(): Promise<void>;
  getProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<UserProfile>;
  saveProfileAndTargetSettings(
    profile: UserProfile,
    settings: TargetSettings,
  ): Promise<void>;
  getTargetSettings(): Promise<TargetSettings>;
  saveTargetSettings(settings: TargetSettings): Promise<TargetSettings>;
  listFoods(): Promise<Food[]>;
  saveFood(food: Food): Promise<Food>;
  saveFoods(foods: Food[]): Promise<Food[]>;
  deleteFood(foodId: string): Promise<void>;
  getDailyLog(date: string): Promise<DailyLog | null>;
  saveDailyLog(log: DailyLog): Promise<DailyLog>;
  resetAllData(): Promise<void>;
}

export class StorageError extends Error {
  readonly reason?: unknown;

  constructor(message: string, reason?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.reason = reason;
  }
}

export class StaleWriteError extends StorageError {
  constructor() {
    super('这个日期的数据已在另一个标签页更新，请刷新后再试。');
    this.name = 'StaleWriteError';
  }
}

export class DataIntegrityError extends StorageError {
  constructor(message: string) {
    super(message);
    this.name = 'DataIntegrityError';
  }
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB 请求失败'));
  });
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB 事务失败'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB 事务已取消'));
  });
}

function openDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new StorageError(
          '当前浏览器不支持本地数据库，记录无法安全保存。请使用较新的 Safari、Chrome 或 Edge。',
        ),
      );
      return;
    }

    let blocked = false;
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta);
      }
      if (!db.objectStoreNames.contains(STORES.profile)) {
        db.createObjectStore(STORES.profile);
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings);
      }
      if (!db.objectStoreNames.contains(STORES.foods)) {
        const foods = db.createObjectStore(STORES.foods, { keyPath: 'id' });
        foods.createIndex('by_category', 'category', { unique: false });
        foods.createIndex('by_name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.logs)) {
        const logs = db.createObjectStore(STORES.logs, { keyPath: 'date' });
        logs.createIndex('by_updated_at', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => {
      reject(
        new StorageError(
          '无法打开本地数据库，记录暂时不能保存。请检查浏览器是否禁用了站点存储。',
          request.error,
        ),
      );
    };

    request.onblocked = () => {
      blocked = true;
      reject(
        new StorageError(
          '数据库升级被另一个标签页占用。请关闭其他“每日热量”标签页后刷新。',
        ),
      );
    };
  });
}

function parseStored<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  label: string,
): T {
  const result = schema.safeParse(raw);

  if (!result.success) {
    throw new DataIntegrityError(
      `${label}数据校验失败：${getZodIssueMessages(result.error).join('；')}`,
    );
  }

  return result.data;
}

export class IndexedDbRepository implements CalorieRepository {
  private readonly dbName: string;
  private readonly seedFoods: Food[];
  private dbPromise: Promise<IDBDatabase> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(options?: { dbName?: string; seedFoods?: Food[] }) {
    this.dbName = options?.dbName ?? DEFAULT_DB_NAME;
    this.seedFoods = options?.seedFoods ?? SEED_FOODS;
  }

  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInitialize().catch((error: unknown) => {
        this.initPromise = null;
        throw error;
      });
    }

    await this.initPromise;
  }

  async close(): Promise<void> {
    const db = this.dbPromise ? await this.dbPromise.catch(() => null) : null;
    db?.close();
    this.dbPromise = null;
    this.initPromise = null;
  }

  /**
   * Deletes the app's IndexedDB database. Only for local testing tools:
   * the next initialization creates a fresh database with seed foods.
   */
  async resetAllData(): Promise<void> {
    await this.close();

    if (typeof indexedDB === 'undefined') {
      throw new StorageError('当前浏览器不支持本地数据库，无法重置。');
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const request = indexedDB.deleteDatabase(this.dbName);

      const rejectOnce = (error: StorageError) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      request.onsuccess = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      request.onerror = () => {
        rejectOnce(
          new StorageError(
            '无法重置本地数据，请稍后重试。',
            request.error,
          ),
        );
      };

      request.onblocked = () => {
        rejectOnce(
          new StorageError(
            '无法重置：另一个标签页仍在使用本地数据。请关闭其他“每日热量”标签页后再试。',
          ),
        );
      };
    });
  }

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase(this.dbName).catch((error: unknown) => {
        this.dbPromise = null;
        throw error;
      });
    }

    return this.dbPromise;
  }

  private async doInitialize(): Promise<void> {
    const db = await this.getDb();
    const existingMeta = await this.readSingle<unknown>(
      db,
      STORES.meta,
      'app',
    );

    if (existingMeta !== undefined) {
      return;
    }

    const foodCount = await this.countFoods(db);
    const now = nowIsoTimestamp();
    const meta: AppMeta = {
      schemaVersion: 1,
      seedVersion: SEED_VERSION,
      createdAt: now,
    };

    const transaction = db.transaction(
      [STORES.meta, STORES.foods],
      'readwrite',
    );

    if (foodCount === 0) {
      const foodStore = transaction.objectStore(STORES.foods);
      for (const food of this.seedFoods) {
        foodStore.put(foodSchema.parse(food) satisfies Food);
      }
    }

    transaction.objectStore(STORES.meta).put(meta, 'app');
    await transactionAsPromise(transaction);
  }

  private async readSingle<T>(
    db: IDBDatabase,
    storeName: StoreName,
    key: IDBValidKey,
  ): Promise<T | undefined> {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    const value = (await requestAsPromise(request)) as T | undefined;
    await transactionAsPromise(transaction);
    return value;
  }

  private async readAll<T>(
    db: IDBDatabase,
    storeName: StoreName,
  ): Promise<T[]> {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    const value = (await requestAsPromise(request)) as T[];
    await transactionAsPromise(transaction);
    return value;
  }

  private async countFoods(db: IDBDatabase): Promise<number> {
    const transaction = db.transaction(STORES.foods, 'readonly');
    const request = transaction.objectStore(STORES.foods).count();
    const count = await requestAsPromise(request);
    await transactionAsPromise(transaction);
    return count;
  }

  async getProfile(): Promise<UserProfile | null> {
    await this.initialize();
    const db = await this.getDb();
    const raw = await this.readSingle<unknown>(db, STORES.profile, 'current');
    if (raw === undefined) {
      return null;
    }
    return parseStored(userProfileSchema, raw, '用户资料');
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    await this.initialize();
    const validated = userProfileSchema.parse(profile) as UserProfile;
    const db = await this.getDb();
    const transaction = db.transaction(STORES.profile, 'readwrite');
    transaction.objectStore(STORES.profile).put(validated, 'current');
    await transactionAsPromise(transaction);
    return validated;
  }

  async saveProfileAndTargetSettings(
    profile: UserProfile,
    settings: TargetSettings,
  ): Promise<void> {
    await this.initialize();
    const validatedProfile = userProfileSchema.parse(profile) as UserProfile;
    const validatedSettings = targetSettingsSchema.parse(
      settings,
    ) as TargetSettings;
    const db = await this.getDb();
    const transaction = db.transaction(
      [STORES.profile, STORES.settings],
      'readwrite',
    );
    transaction.objectStore(STORES.profile).put(validatedProfile, 'current');
    transaction.objectStore(STORES.settings).put(validatedSettings, 'current');
    await transactionAsPromise(transaction);
  }

  async getTargetSettings(): Promise<TargetSettings> {
    await this.initialize();
    const db = await this.getDb();
    const raw = await this.readSingle<unknown>(db, STORES.settings, 'current');
    if (raw === undefined) {
      return {
        mode: 'auto',
        manual: null,
        updatedAt: nowIsoTimestamp(),
      };
    }
    return parseStored(targetSettingsSchema, raw, '目标设置');
  }

  async saveTargetSettings(settings: TargetSettings): Promise<TargetSettings> {
    await this.initialize();
    const validated = targetSettingsSchema.parse(settings) as TargetSettings;
    const db = await this.getDb();
    const transaction = db.transaction(STORES.settings, 'readwrite');
    transaction.objectStore(STORES.settings).put(validated, 'current');
    await transactionAsPromise(transaction);
    return validated;
  }

  async listFoods(): Promise<Food[]> {
    await this.initialize();
    const db = await this.getDb();
    const raw = await this.readAll<unknown>(db, STORES.foods);
    return raw.map((item, index) =>
      parseStored(foodSchema, item, `食物库第 ${index + 1} 条`),
    );
  }

  async saveFood(food: Food): Promise<Food> {
    await this.initialize();
    const validated = foodSchema.parse(food) as Food;
    const db = await this.getDb();
    const transaction = db.transaction(STORES.foods, 'readwrite');
    transaction.objectStore(STORES.foods).put(validated);
    await transactionAsPromise(transaction);
    return validated;
  }

  async saveFoods(foods: Food[]): Promise<Food[]> {
    await this.initialize();
    if (foods.length === 0) {
      return [];
    }
    const validated = foods.map((food) => foodSchema.parse(food) as Food);
    const db = await this.getDb();
    const transaction = db.transaction(STORES.foods, 'readwrite');
    const store = transaction.objectStore(STORES.foods);
    for (const food of validated) {
      store.put(food);
    }
    await transactionAsPromise(transaction);
    return validated;
  }

  async deleteFood(foodId: string): Promise<void> {
    await this.initialize();
    const db = await this.getDb();
    const transaction = db.transaction(STORES.foods, 'readwrite');
    transaction.objectStore(STORES.foods).delete(foodId);
    await transactionAsPromise(transaction);
  }

  async getDailyLog(date: string): Promise<DailyLog | null> {
    await this.initialize();
    const isoDate = isoDateSchema.parse(date);
    const db = await this.getDb();
    const raw = await this.readSingle<unknown>(db, STORES.logs, isoDate);
    if (raw === undefined) {
      return null;
    }
    return parseStored(dailyLogSchema, raw, '每日记录');
  }

  /**
   * Writes one day's log only after checking the stored revision.
   * The promise resolves only after the IndexedDB transaction commits.
   */
  async saveDailyLog(log: DailyLog): Promise<DailyLog> {
    await this.initialize();
    const incoming = dailyLogSchema.parse(log) as DailyLog;
    const db = await this.getDb();

    return new Promise<DailyLog>((resolve, reject) => {
      let settled = false;
      let nextLog: DailyLog | null = null;
      const transaction = db.transaction(STORES.logs, 'readwrite');
      const store = transaction.objectStore(STORES.logs);
      const getRequest = store.get(incoming.date);

      const rejectOnce = (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(
          error instanceof Error
            ? error
            : new StorageError('每日记录写入失败', error),
        );
      };

      getRequest.onsuccess = () => {
        try {
          const rawExisting = getRequest.result as unknown;
          let existing: DailyLog | null = null;

          if (rawExisting !== undefined) {
            existing = parseStored(
              dailyLogSchema,
              rawExisting,
              '已保存的每日记录',
            );
          }

          const storedRevision = existing?.revision ?? 0;
          if (incoming.revision !== storedRevision) {
            transaction.abort();
            throw new StaleWriteError();
          }

          nextLog = {
            ...incoming,
            revision: storedRevision + 1,
            createdAt: existing?.createdAt ?? incoming.createdAt,
            updatedAt: nowIsoTimestamp(),
          };

          dailyLogSchema.parse(nextLog);
          store.put(nextLog);
        } catch (error) {
          try {
            transaction.abort();
          } catch {
            // The transaction may already be inactive; rejection below still
            // communicates the original failure.
          }
          rejectOnce(error);
        }
      };

      getRequest.onerror = () => {
        rejectOnce(
          new StorageError(
            '读取当日记录失败，未写入任何内容。',
            getRequest.error,
          ),
        );
      };

      transaction.oncomplete = () => {
        if (settled) {
          return;
        }
        if (!nextLog) {
          rejectOnce(new StorageError('每日记录写入后未生成有效数据。'));
          return;
        }
        settled = true;
        resolve(nextLog);
      };

      transaction.onerror = () => {
        rejectOnce(
          new StorageError(
            '每日记录写入失败，请检查浏览器存储空间。',
            transaction.error,
          ),
        );
      };

      transaction.onabort = () => {
        rejectOnce(
          new StorageError('每日记录写入已取消，数据未保存。', transaction.error),
        );
      };
    });
  }
}

export async function deleteDatabaseForTests(dbName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new StorageError('测试数据库无法删除：仍有连接未关闭。'));
  });
}
