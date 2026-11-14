import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getStorageInfo } from '../data/storageInfo';
import {
  IndexedDbRepository,
  StaleWriteError,
  type CalorieRepository,
} from '../data/repository';
import { backupPayloadSchema } from '../domain/backup';
import {
  FOOD_CATEGORIES,
  MEAL_META,
} from '../domain/constants';
import { getCurrentLocale, translate } from '../i18n';
import {
  formatShortDate,
  getTodayIso,
  isFutureDate,
  isValidIsoDate,
  nowIsoTimestamp,
} from '../domain/dates';
import { createId } from '../domain/id';
import {
  addEntryToMeal,
  createEmptyDailyLog,
  createFoodEntry,
  deleteEntryFromLog,
  updateEntryInLog,
  type EntryAmountInput,
} from '../domain/logFactory';
import { buildDaySummary } from '../domain/nutrition';
import { getFoodDisplayName } from '../domain/localizedText';
import {
  foodSchema,
  targetSettingsSchema,
  userProfileSchema,
} from '../domain/schemas';
import { resolveTargets } from '../domain/targets';
import type {
  BackupImportResult,
  BackupPayload,
  DailyLog,
  DaySummary,
  Food,
  FoodDraft,
  IsoDate,
  MealType,
  Nutrition,
  ProfileInput,
  StorageInfo,
  TargetSettings,
  TargetSettingsInput,
  UserProfile,
} from '../domain/types';
import { useToast } from '../ui/ToastProvider';
import {
  clearRecentFoodIds,
  loadRecentFoodIds,
  rememberRecentFoodId,
} from './recentFoods';

const repository: CalorieRepository = new IndexedDbRepository();

const DEFAULT_STORAGE_INFO: StorageInfo = {
  persisted: false,
  supported: false,
  usageBytes: null,
  quotaBytes: null,
};

type AppStatus = 'loading' | 'ready' | 'fatal';

interface AppActions {
  completeOnboarding: (profile: ProfileInput) => Promise<boolean>;
  saveProfile: (profile: ProfileInput) => Promise<boolean>;
  saveTargetSettings: (settings: TargetSettingsInput) => Promise<boolean>;
  addEntry: (
    mealType: MealType,
    food: Food,
    amount: EntryAmountInput,
  ) => Promise<boolean>;
  addEntryForDate: (
    date: IsoDate,
    mealType: MealType,
    food: Food,
    amount: EntryAmountInput,
  ) => Promise<boolean>;
  disposeMealPrepBatch: (batch: Food) => Promise<void>;
  updateEntry: (
    mealType: MealType,
    entryId: string,
    amount: EntryAmountInput,
  ) => Promise<boolean>;
  deleteEntry: (mealType: MealType, entryId: string) => Promise<boolean>;
  createMealPrepBatch: (
    sourceFood: Food,
    totalGrams: number,
    portionGrams: number,
  ) => Promise<Food>;
  createFood: (draft: FoodDraft) => Promise<Food>;
  updateFood: (foodId: string, draft: FoodDraft) => Promise<Food>;
  deleteFood: (foodId: string) => Promise<void>;
  importFoods: (foods: Food[]) => Promise<void>;
  createBackup: (
    from: IsoDate | null,
    to: IsoDate | null,
  ) => Promise<BackupPayload>;
  importBackup: (payload: BackupPayload) => Promise<BackupImportResult>;
  selectDate: (date: IsoDate) => void;
  requestPersistence: () => Promise<void>;
  refreshStorageInfo: () => Promise<void>;
  retryInitialization: () => void;
  retryLogLoad: () => void;
  resetAllData: () => Promise<boolean>;
}

interface AppContextValue {
  status: AppStatus;
  initializationError: string | null;
  profile: UserProfile | null;
  targetSettings: TargetSettings;
  foods: Food[];
  recentFoodIds: string[];
  foodUsage: Record<string, number>;
  targets: Nutrition | null;
  selectedDate: IsoDate;
  currentLog: DailyLog | null;
  summary: DaySummary;
  isLogLoading: boolean;
  isSaving: boolean;
  logError: string | null;
  lastSavedAt: number | null;
  storageInfo: StorageInfo;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return translate('app.unexpectedError');
}

function sortFoods(foods: Food[], locale = getCurrentLocale()): Food[] {
  const categoryOrder = new Map(
    FOOD_CATEGORIES.map((category, index) => [category, index]),
  );

  return [...foods].sort((a, b) => {
    const orderA = categoryOrder.get(a.category) ?? 99;
    const orderB = categoryOrder.get(b.category) ?? 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return getFoodDisplayName(a, locale).localeCompare(
      getFoodDisplayName(b, locale),
      locale,
    );
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<AppStatus>('loading');
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targetSettings, setTargetSettings] = useState<TargetSettings>({
    mode: 'auto',
    manual: null,
    updatedAt: nowIsoTimestamp(),
  });
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodUsage, setFoodUsage] = useState<Record<string, number>>({});
  const [recentFoodIds, setRecentFoodIds] = useState<string[]>(
    loadRecentFoodIds,
  );
  const [selectedDate, setSelectedDate] = useState<DailyLog['date']>(
    getTodayIso(),
  );
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null);
  const [isLogLoading, setIsLogLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [storageInfo, setStorageInfo] =
    useState<StorageInfo>(DEFAULT_STORAGE_INFO);
  const [initReloadToken, setInitReloadToken] = useState(0);
  const [logReloadToken, setLogReloadToken] = useState(0);

  const currentLogRef = useRef<DailyLog | null>(null);
  const selectedDateRef = useRef(selectedDate);
  const savingRef = useRef(false);

  selectedDateRef.current = selectedDate;
  currentLogRef.current = currentLog;

  const refreshStorageInfo = useCallback(async () => {
    try {
      const info = await getStorageInfo(false);
      setStorageInfo(info);
    } catch {
      // Storage status is informational and never blocks the diary.
    }
  }, []);

  const refreshFoodUsage = useCallback(async () => {
    try {
      setFoodUsage(await repository.getFoodUsage());
    } catch {
      // Batch remaining amounts are informational; the diary still works.
    }
  }, []);

  useEffect(() => {
    let knownToday = getTodayIso();

    const checkForNewDay = () => {
      const nextToday = getTodayIso();
      if (nextToday === knownToday) {
        return;
      }
      const previousToday = knownToday;
      knownToday = nextToday;
      setSelectedDate((current) =>
        current === previousToday ? nextToday : current,
      );
    };

    const interval = window.setInterval(checkForNewDay, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForNewDay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setStatus('loading');
    setInitializationError(null);

    async function initialize() {
      try {
        await repository.initialize();
        const [storedProfile, storedSettings, storedFoods, storedUsage] =
          await Promise.all([
            repository.getProfile(),
            repository.getTargetSettings(),
            repository.listFoods(),
            repository.getFoodUsage(),
          ]);

        if (cancelled) {
          return;
        }

        const storedTargets = resolveTargets(storedProfile, storedSettings);
        if (storedTargets) {
          await repository.backfillDailyLogSnapshots(
            storedTargets,
            storedProfile?.weightKg ?? null,
          );
        }

        if (cancelled) {
          return;
        }

        setProfile(storedProfile);
        setTargetSettings(storedSettings);
        setFoods(sortFoods(storedFoods));
        setFoodUsage(storedUsage);
        setStatus('ready');
        void refreshStorageInfo();
      } catch (error) {
        if (cancelled) {
          return;
        }
        setInitializationError(errorMessage(error));
        setStatus('fatal');
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [initReloadToken, refreshStorageInfo]);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    let cancelled = false;
    currentLogRef.current = null;
    setCurrentLog(null);
    setIsLogLoading(true);
    setLogError(null);
    setLastSavedAt(null);

    async function loadLog() {
      try {
        const loaded = await repository.getDailyLog(selectedDate);
        if (cancelled) {
          return;
        }
        const next = loaded ?? createEmptyDailyLog(selectedDate);
        currentLogRef.current = next;
        setCurrentLog(next);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLogError(errorMessage(error));
        setCurrentLog(null);
        currentLogRef.current = null;
      } finally {
        if (!cancelled) {
          setIsLogLoading(false);
        }
      }
    }

    void loadLog();

    return () => {
      cancelled = true;
    };
  }, [status, selectedDate, logReloadToken]);

  const targets = useMemo(
    () => resolveTargets(profile, targetSettings),
    [profile, targetSettings],
  );

  const summary = useMemo(
    () =>
      buildDaySummary(
        currentLog,
        currentLog?.targetSnapshot ?? targets,
      ),
    [currentLog, targets],
  );

  const persistLogUpdate = useCallback(
    async (
      update: (log: DailyLog) => DailyLog,
      successMessage?: string,
    ): Promise<boolean> => {
      const log = currentLogRef.current;

      if (!log) {
        showToast(translate('toast.recordsNotReady'), 'info');
        return false;
      }

      if (savingRef.current) {
        showToast(translate('toast.savingWait'), 'info');
        return false;
      }

      savingRef.current = true;
      setIsSaving(true);

      try {
        const next = update(log);
        const withSnapshots: DailyLog = {
          ...next,
          targetSnapshot: next.targetSnapshot ?? targets,
          weightKgSnapshot:
            next.weightKgSnapshot ?? profile?.weightKg ?? null,
        };
        const saved = await repository.saveDailyLog(withSnapshots);

        if (selectedDateRef.current === saved.date) {
          currentLogRef.current = saved;
          setCurrentLog(saved);
          setLastSavedAt(Date.now());
        }

        if (successMessage) {
          showToast(successMessage);
        }

        void refreshFoodUsage();
        return true;
      } catch (error) {
        if (error instanceof StaleWriteError) {
          try {
            const latest = await repository.getDailyLog(log.date);
            if (latest && selectedDateRef.current === latest.date) {
              currentLogRef.current = latest;
              setCurrentLog(latest);
            }
          } catch {
            // The original stale-write message still tells the user what to do.
          }
          showToast(error.message, 'error');
        } else {
          showToast(errorMessage(error), 'error');
        }
        return false;
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [profile?.weightKg, refreshFoodUsage, showToast, targets],
  );

  const completeOnboarding = useCallback(
    async (input: ProfileInput): Promise<boolean> => {
      try {
        const now = nowIsoTimestamp();
        const nextProfile = userProfileSchema.parse({
          ...input,
          updatedAt: now,
        }) as UserProfile;
        const nextSettings = targetSettingsSchema.parse({
          mode: 'auto',
          manual: null,
          updatedAt: now,
        }) as TargetSettings;

        await repository.saveProfileAndTargetSettings(
          nextProfile,
          nextSettings,
        );
        setProfile(nextProfile);
        setTargetSettings(nextSettings);
        showToast(translate('toast.targetGenerated'));
        return true;
      } catch (error) {
        showToast(errorMessage(error), 'error');
        return false;
      }
    },
    [showToast],
  );

  const syncTodayTargetSnapshot = useCallback(
    async (target: Nutrition | null, weightKg: number | null) => {
      if (!target) {
        return;
      }
      const today = getTodayIso();
      await repository.updateDailyLogSnapshot(today, target, weightKg);
      if (currentLogRef.current?.date === today) {
        const updated: DailyLog = {
          ...currentLogRef.current,
          targetSnapshot: { ...target },
          weightKgSnapshot: weightKg,
        };
        currentLogRef.current = updated;
        setCurrentLog(updated);
      }
    },
    [],
  );

  const saveProfile = useCallback(
    async (input: ProfileInput): Promise<boolean> => {
      try {
        const nextProfile = userProfileSchema.parse({
          ...input,
          updatedAt: nowIsoTimestamp(),
        }) as UserProfile;
        if (targets) {
          await repository.backfillDailyLogSnapshots(
            targets,
            profile?.weightKg ?? null,
          );
        }
        const saved = await repository.saveProfile(nextProfile);
        setProfile(saved);
        await syncTodayTargetSnapshot(
          resolveTargets(saved, targetSettings),
          saved.weightKg,
        );
        showToast(translate('toast.profileUpdated'));
        return true;
      } catch (error) {
        showToast(errorMessage(error), 'error');
        return false;
      }
    },
    [
      profile?.weightKg,
      showToast,
      syncTodayTargetSnapshot,
      targetSettings,
      targets,
    ],
  );

  const saveTargetSettings = useCallback(
    async (input: TargetSettingsInput): Promise<boolean> => {
      try {
        const nextSettings = targetSettingsSchema.parse({
          ...input,
          updatedAt: nowIsoTimestamp(),
        }) as TargetSettings;
        if (targets) {
          await repository.backfillDailyLogSnapshots(
            targets,
            profile?.weightKg ?? null,
          );
        }
        const saved = await repository.saveTargetSettings(nextSettings);
        setTargetSettings(saved);
        await syncTodayTargetSnapshot(
          resolveTargets(profile, saved),
          profile?.weightKg ?? null,
        );
        showToast(
          saved.mode === 'manual'
            ? translate('toast.manualTargetSaved')
            : translate('toast.autoTargetRestored'),
        );
        return true;
      } catch (error) {
        showToast(errorMessage(error), 'error');
        return false;
      }
    },
    [
      profile,
      profile?.weightKg,
      showToast,
      syncTodayTargetSnapshot,
      targets,
    ],
  );

  const addEntry = useCallback(
    async (
      mealType: MealType,
      food: Food,
      amount: EntryAmountInput,
    ): Promise<boolean> => {
      const entry = createFoodEntry(food, amount);
      const ok = await persistLogUpdate(
        (log) => addEntryToMeal(log, mealType, entry),
        translate('toast.mealAdded', {
          meal: translate(MEAL_META[mealType].labelKey),
        }),
      );
      if (ok && foods.some((item) => item.id === food.id)) {
        setRecentFoodIds((current) =>
          rememberRecentFoodId(current, food.id),
        );
      }
      return ok;
    },
    [foods, persistLogUpdate],
  );

  const addEntryForDate = useCallback(
    async (
      date: IsoDate,
      mealType: MealType,
      food: Food,
      amount: EntryAmountInput,
    ): Promise<boolean> => {
      if (!isValidIsoDate(date)) {
        showToast(translate('toast.dateInvalid'), 'error');
        return false;
      }
      if (savingRef.current) {
        showToast(translate('toast.savingWait'), 'info');
        return false;
      }

      savingRef.current = true;
      setIsSaving(true);

      try {
        const existing = await repository.getDailyLog(date);
        const log = existing ?? createEmptyDailyLog(date);
        const entry = createFoodEntry(food, amount);
        const next = addEntryToMeal(log, mealType, entry);
        const isFuture = date > getTodayIso();
        const saved = await repository.saveDailyLog({
          ...next,
          // A planned future meal should use the target in effect when that
          // day actually arrives, not the target at planning time.
          targetSnapshot: isFuture
            ? null
            : next.targetSnapshot ?? targets,
          weightKgSnapshot: isFuture
            ? null
            : next.weightKgSnapshot ?? profile?.weightKg ?? null,
        });

        if (selectedDateRef.current === saved.date) {
          currentLogRef.current = saved;
          setCurrentLog(saved);
          setLastSavedAt(Date.now());
        }

        if (foods.some((item) => item.id === food.id)) {
          setRecentFoodIds((current) =>
            rememberRecentFoodId(current, food.id),
          );
        }

        showToast(
          translate('toast.mealAddedForDate', {
            date: formatShortDate(saved.date),
            meal: translate(MEAL_META[mealType].labelKey),
          }),
        );
        void refreshFoodUsage();
        return true;
      } catch (error) {
        if (error instanceof StaleWriteError) {
          showToast(translate('toast.recordChanged'), 'error');
        } else {
          showToast(errorMessage(error), 'error');
        }
        return false;
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [
      foods,
      profile?.weightKg,
      refreshFoodUsage,
      showToast,
      targets,
    ],
  );

  const disposeMealPrepBatch = useCallback(
    async (batch: Food): Promise<void> => {
      if (!batch.batch) {
        return;
      }
      const now = nowIsoTimestamp();
      const nextFood = foodSchema.parse({
        ...batch,
        batch: {
          ...batch.batch,
          disposedAt: now,
        },
        updatedAt: now,
      }) as Food;

      try {
        const saved = await repository.saveFood(nextFood);
        setFoods((current) =>
          sortFoods(
            current.map((food) =>
              food.id === saved.id ? saved : food,
            ),
          ),
        );
        showToast(translate('toast.batchDisposed'));
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    [showToast],
  );

  const updateEntry = useCallback(
    async (
      mealType: MealType,
      entryId: string,
      amount: EntryAmountInput,
    ): Promise<boolean> =>
      persistLogUpdate(
        (log) => updateEntryInLog(log, mealType, entryId, amount),
        translate('toast.servingUpdated'),
      ),
    [persistLogUpdate],
  );

  const deleteEntry = useCallback(
    async (mealType: MealType, entryId: string): Promise<boolean> =>
      persistLogUpdate(
        (log) => deleteEntryFromLog(log, mealType, entryId),
        translate('toast.entryDeleted'),
      ),
    [persistLogUpdate],
  );

  const createMealPrepBatch = useCallback(
    async (
      sourceFood: Food,
      totalGrams: number,
      portionGrams: number,
    ): Promise<Food> => {
      const now = nowIsoTimestamp();
      const batchName = translate('batch.foodName', {
        name: getFoodDisplayName(sourceFood, getCurrentLocale()),
      });
      const nextFood = foodSchema.parse({
        ...sourceFood,
        id: createId('food'),
        names: {
          ...sourceFood.names,
          'zh-CN': batchName,
        },
        servings: [
          {
            id: createId('serving'),
            label: translate('batch.portionLabel'),
            grams: portionGrams,
          },
        ],
        batch: {
          totalGrams,
          portionGrams,
          sourceFoodId: sourceFood.id,
        },
        source: 'custom',
        createdAt: now,
        updatedAt: now,
      }) as Food;

      try {
        const saved = await repository.saveFood(nextFood);
        setFoods((current) => sortFoods([...current, saved]));
        showToast(translate('toast.batchCreated'));
        return saved;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    [showToast],
  );

  const createFood = useCallback(
    async (draft: FoodDraft): Promise<Food> => {
      const now = nowIsoTimestamp();
      const nextFood = foodSchema.parse({
        id: createId('food'),
        names: draft.names,
        category: draft.category,
        basis: draft.basis,
        nutritionPer100g: { ...draft.nutritionPer100g },
        servings: draft.servings.map((serving) => ({
          id: createId('serving'),
          label: serving.label.trim(),
          grams: serving.grams,
        })),
        source: 'custom',
        createdAt: now,
        updatedAt: now,
      }) as Food;

      try {
        const saved = await repository.saveFood(nextFood);
        setFoods((current) => sortFoods([...current, saved]));
        showToast(
          translate('toast.foodAdded', {
            name: getFoodDisplayName(saved, getCurrentLocale()),
          }),
        );
        return saved;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    [showToast],
  );

  const updateFood = useCallback(
    async (foodId: string, draft: FoodDraft): Promise<Food> => {
      const existing = foods.find((food) => food.id === foodId);
      if (!existing) {
        throw new Error(translate('toast.noFoodToUpdate'));
      }

      const nextFood = foodSchema.parse({
        ...existing,
        names: draft.names,
        category: draft.category,
        basis: draft.basis,
        nutritionPer100g: { ...draft.nutritionPer100g },
        servings: draft.servings.map((serving) => ({
          id: createId('serving'),
          label: serving.label.trim(),
          grams: serving.grams,
        })),
        updatedAt: nowIsoTimestamp(),
      }) as Food;

      try {
        const saved = await repository.saveFood(nextFood);
        setFoods((current) =>
          sortFoods(current.map((food) => (food.id === saved.id ? saved : food))),
        );
        showToast(
          translate('toast.foodUpdated', {
            name: getFoodDisplayName(saved, getCurrentLocale()),
          }),
        );
        return saved;
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    [foods, showToast],
  );

  const deleteFood = useCallback(
    async (foodId: string): Promise<void> => {
      try {
        await repository.deleteFood(foodId);
        setFoods((current) => current.filter((food) => food.id !== foodId));
        showToast(translate('toast.foodDeleted'));
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    [showToast],
  );

  const importFoods = useCallback(
    async (incomingFoods: Food[]): Promise<void> => {
      try {
        const savedFoods = await repository.saveFoods(incomingFoods);
        setFoods((current) => {
          const byId = new Map(current.map((food) => [food.id, food]));
          for (const food of savedFoods) {
            byId.set(food.id, food);
          }
          return sortFoods([...byId.values()]);
        });
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    [],
  );

  const createBackup = useCallback(
    async (
      from: IsoDate | null,
      to: IsoDate | null,
    ): Promise<BackupPayload> => {
      if (savingRef.current) {
        throw new Error(translate('toast.savingWait'));
      }

      const [storedProfile, storedSettings, storedFoods, logs] =
        await Promise.all([
          repository.getProfile(),
          repository.getTargetSettings(),
          repository.listFoods(),
          repository.listDailyLogs(from ?? undefined, to ?? undefined),
        ]);

      return backupPayloadSchema.parse({
        backupVersion: 1,
        exportedAt: nowIsoTimestamp(),
        logsFrom: from,
        logsTo: to,
        profile: storedProfile,
        targetSettings: storedSettings,
        foods: storedFoods,
        logs,
      }) as BackupPayload;
    },
    [],
  );

  const importBackup = useCallback(
    async (payload: BackupPayload): Promise<BackupImportResult> => {
      if (savingRef.current) {
        throw new Error(translate('toast.saveInProgress'));
      }

      savingRef.current = true;
      setIsSaving(true);

      try {
        const result = await repository.importBackup(payload);
        const [storedProfile, storedSettings, storedFoods, storedUsage] =
          await Promise.all([
            repository.getProfile(),
            repository.getTargetSettings(),
            repository.listFoods(),
            repository.getFoodUsage(),
          ]);
        const storedTargets = resolveTargets(storedProfile, storedSettings);
        if (storedTargets) {
          await repository.backfillDailyLogSnapshots(
            storedTargets,
            storedProfile?.weightKg ?? null,
          );
        }

        setProfile(storedProfile);
        setTargetSettings(storedSettings);
        setFoods(sortFoods(storedFoods));
        setFoodUsage(storedUsage);
        setLogReloadToken((value) => value + 1);
        void refreshStorageInfo();
        return result;
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [refreshStorageInfo],
  );

  const selectDate = useCallback(
    (date: IsoDate) => {
      if (!isValidIsoDate(date)) {
        showToast(translate('toast.dateInvalid'), 'error');
        return;
      }
      if (isFutureDate(date)) {
        showToast(translate('toast.futureDate'), 'info');
        return;
      }
      setSelectedDate((current) => (current === date ? current : date));
    },
    [showToast],
  );

  const requestPersistence = useCallback(async () => {
    try {
      const info = await getStorageInfo(true);
      setStorageInfo(info);
      if (info.persisted) {
        showToast(translate('toast.persistenceEnabled'));
      } else {
        showToast(translate('toast.persistenceDenied'), 'info');
      }
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  }, [showToast]);

  const retryInitialization = useCallback(() => {
    setInitReloadToken((value) => value + 1);
  }, []);

  const retryLogLoad = useCallback(() => {
    setLogReloadToken((value) => value + 1);
  }, []);

  const resetAllData = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) {
      showToast(translate('toast.saveInProgress'), 'info');
      return false;
    }

    try {
      await repository.resetAllData();
      clearRecentFoodIds();
      window.location.reload();
      return true;
    } catch (error) {
      showToast(errorMessage(error), 'error');
      return false;
    }
  }, [showToast]);

  const actions = useMemo<AppActions>(
    () => ({
      completeOnboarding,
      saveProfile,
      saveTargetSettings,
      addEntry,
      addEntryForDate,
      disposeMealPrepBatch,
      updateEntry,
      deleteEntry,
      createMealPrepBatch,
      createFood,
      updateFood,
      deleteFood,
      importFoods,
      createBackup,
      importBackup,
      selectDate,
      requestPersistence,
      refreshStorageInfo,
      retryInitialization,
      retryLogLoad,
      resetAllData,
    }),
    [
      completeOnboarding,
      saveProfile,
      saveTargetSettings,
      addEntry,
      addEntryForDate,
      disposeMealPrepBatch,
      updateEntry,
      deleteEntry,
      createMealPrepBatch,
      createFood,
      updateFood,
      deleteFood,
      importFoods,
      createBackup,
      importBackup,
      selectDate,
      requestPersistence,
      refreshStorageInfo,
      retryInitialization,
      retryLogLoad,
      resetAllData,
    ],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      status,
      initializationError,
      profile,
      targetSettings,
      foods,
      recentFoodIds,
      foodUsage,
      targets,
      selectedDate,
      currentLog,
      summary,
      isLogLoading,
      isSaving,
      logError,
      lastSavedAt,
      storageInfo,
      actions,
    }),
    [
      status,
      initializationError,
      profile,
      targetSettings,
      foods,
      recentFoodIds,
      foodUsage,
      targets,
      selectedDate,
      currentLog,
      summary,
      isLogLoading,
      isSaving,
      logError,
      lastSavedAt,
      storageInfo,
      actions,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp 必须在 AppProvider 内使用');
  }
  return context;
}
