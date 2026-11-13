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
import {
  FOOD_CATEGORIES,
  MEAL_META,
} from '../domain/constants';
import {
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
import {
  foodSchema,
  targetSettingsSchema,
  userProfileSchema,
} from '../domain/schemas';
import { resolveTargets } from '../domain/targets';
import type {
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
  updateEntry: (
    mealType: MealType,
    entryId: string,
    amount: EntryAmountInput,
  ) => Promise<boolean>;
  deleteEntry: (mealType: MealType, entryId: string) => Promise<boolean>;
  createFood: (draft: FoodDraft) => Promise<Food>;
  updateFood: (foodId: string, draft: FoodDraft) => Promise<Food>;
  deleteFood: (foodId: string) => Promise<void>;
  importFoods: (foods: Food[]) => Promise<void>;
  selectDate: (date: IsoDate) => void;
  requestPersistence: () => Promise<void>;
  refreshStorageInfo: () => Promise<void>;
  retryInitialization: () => void;
  retryLogLoad: () => void;
}

interface AppContextValue {
  status: AppStatus;
  initializationError: string | null;
  profile: UserProfile | null;
  targetSettings: TargetSettings;
  foods: Food[];
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
  return '操作失败，请稍后重试。';
}

function sortFoods(foods: Food[]): Food[] {
  const categoryOrder = new Map(
    FOOD_CATEGORIES.map((category, index) => [category, index]),
  );

  return [...foods].sort((a, b) => {
    const orderA = categoryOrder.get(a.category) ?? 99;
    const orderB = categoryOrder.get(b.category) ?? 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name, 'zh-CN');
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
        const [storedProfile, storedSettings, storedFoods] =
          await Promise.all([
            repository.getProfile(),
            repository.getTargetSettings(),
            repository.listFoods(),
          ]);

        if (cancelled) {
          return;
        }

        setProfile(storedProfile);
        setTargetSettings(storedSettings);
        setFoods(sortFoods(storedFoods));
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
    () => buildDaySummary(currentLog, targets),
    [currentLog, targets],
  );

  const persistLogUpdate = useCallback(
    async (
      update: (log: DailyLog) => DailyLog,
      successMessage?: string,
    ): Promise<boolean> => {
      const log = currentLogRef.current;

      if (!log) {
        showToast('记录还没有准备好，请稍后再试。', 'info');
        return false;
      }

      if (savingRef.current) {
        showToast('正在保存，请稍等。', 'info');
        return false;
      }

      savingRef.current = true;
      setIsSaving(true);

      try {
        const next = update(log);
        const saved = await repository.saveDailyLog(next);

        if (selectedDateRef.current === saved.date) {
          currentLogRef.current = saved;
          setCurrentLog(saved);
          setLastSavedAt(Date.now());
        }

        if (successMessage) {
          showToast(successMessage);
        }

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
    [showToast],
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
        showToast('推荐目标已生成，开始记录吧。');
        return true;
      } catch (error) {
        showToast(errorMessage(error), 'error');
        return false;
      }
    },
    [showToast],
  );

  const saveProfile = useCallback(
    async (input: ProfileInput): Promise<boolean> => {
      try {
        const nextProfile = userProfileSchema.parse({
          ...input,
          updatedAt: nowIsoTimestamp(),
        }) as UserProfile;
        const saved = await repository.saveProfile(nextProfile);
        setProfile(saved);
        showToast('个人资料已更新。');
        return true;
      } catch (error) {
        showToast(errorMessage(error), 'error');
        return false;
      }
    },
    [showToast],
  );

  const saveTargetSettings = useCallback(
    async (input: TargetSettingsInput): Promise<boolean> => {
      try {
        const nextSettings = targetSettingsSchema.parse({
          ...input,
          updatedAt: nowIsoTimestamp(),
        }) as TargetSettings;
        const saved = await repository.saveTargetSettings(nextSettings);
        setTargetSettings(saved);
        showToast(
          saved.mode === 'manual' ? '手动目标已保存。' : '已恢复自动推荐目标。',
        );
        return true;
      } catch (error) {
        showToast(errorMessage(error), 'error');
        return false;
      }
    },
    [showToast],
  );

  const addEntry = useCallback(
    async (
      mealType: MealType,
      food: Food,
      amount: EntryAmountInput,
    ): Promise<boolean> => {
      const entry = createFoodEntry(food, amount);
      return persistLogUpdate(
        (log) => addEntryToMeal(log, mealType, entry),
        `已加入${MEAL_META[mealType].label}`,
      );
    },
    [persistLogUpdate],
  );

  const updateEntry = useCallback(
    async (
      mealType: MealType,
      entryId: string,
      amount: EntryAmountInput,
    ): Promise<boolean> =>
      persistLogUpdate(
        (log) => updateEntryInLog(log, mealType, entryId, amount),
        '份量已更新。',
      ),
    [persistLogUpdate],
  );

  const deleteEntry = useCallback(
    async (mealType: MealType, entryId: string): Promise<boolean> =>
      persistLogUpdate(
        (log) => deleteEntryFromLog(log, mealType, entryId),
        '记录已删除。',
      ),
    [persistLogUpdate],
  );

  const createFood = useCallback(
    async (draft: FoodDraft): Promise<Food> => {
      const now = nowIsoTimestamp();
      const nextFood = foodSchema.parse({
        id: createId('food'),
        name: draft.name.trim(),
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
        showToast(`已添加“${saved.name}”。`);
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
        throw new Error('没有找到要修改的食物。');
      }

      const nextFood = foodSchema.parse({
        ...existing,
        name: draft.name.trim(),
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
        showToast(`“${saved.name}”已更新。`);
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
        showToast('食物已从食物库删除，历史记录不受影响。');
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

  const selectDate = useCallback(
    (date: IsoDate) => {
      if (!isValidIsoDate(date)) {
        showToast('日期格式不正确。', 'error');
        return;
      }
      if (isFutureDate(date)) {
        showToast('还不能记录未来日期。', 'info');
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
        showToast('浏览器已启用持久存储。');
      } else {
        showToast(
          '浏览器暂未授予持久存储。数据仍会写入本机，但清理站点数据会丢失。',
          'info',
        );
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

  const actions = useMemo<AppActions>(
    () => ({
      completeOnboarding,
      saveProfile,
      saveTargetSettings,
      addEntry,
      updateEntry,
      deleteEntry,
      createFood,
      updateFood,
      deleteFood,
      importFoods,
      selectDate,
      requestPersistence,
      refreshStorageInfo,
      retryInitialization,
      retryLogLoad,
    }),
    [
      completeOnboarding,
      saveProfile,
      saveTargetSettings,
      addEntry,
      updateEntry,
      deleteEntry,
      createFood,
      updateFood,
      deleteFood,
      importFoods,
      selectDate,
      requestPersistence,
      refreshStorageInfo,
      retryInitialization,
      retryLogLoad,
    ],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      status,
      initializationError,
      profile,
      targetSettings,
      foods,
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
