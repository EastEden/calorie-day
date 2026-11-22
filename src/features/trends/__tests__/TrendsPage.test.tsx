import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { addDays, getTodayIso } from '../../../domain/dates';
import { createEmptyDailyLog, createFoodEntry } from '../../../domain/logFactory';
import type { DailyLog, Food } from '../../../domain/types';
import { initializeI18n } from '../../../i18n';
import { TrendsPage } from '../TrendsPage';

const mocks = vi.hoisted(() => ({
  loadTrendLogs: vi.fn(),
  targets: {
    kcal: 2000,
    proteinG: 100,
    carbsG: 200,
    fatG: 60,
  },
}));

vi.mock('../../../state/AppContext', () => ({
  useApp: () => ({
    actions: {
      loadTrendLogs: mocks.loadTrendLogs,
    },
    targets: mocks.targets,
  }),
}));

const food: Food = {
  id: 'trend-test-food',
  names: { 'zh-CN': '测试食物' },
  category: 'other',
  basis: 'as_sold',
  nutritionPer100g: {
    kcal: 100,
    proteinG: 10,
    carbsG: 10,
    fatG: 5,
  },
  servings: [],
  source: 'custom',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeLog(date: string, kcal: number): DailyLog {
  const log = createEmptyDailyLog(date);
  log.targetSnapshot = {
    kcal: 2000,
    proteinG: 100,
    carbsG: 200,
    fatG: 60,
  };
  log.meals.breakfast.push(
    createFoodEntry(food, {
      grams: kcal,
      enteredQuantity: kcal,
      enteredUnit: 'g',
    }),
  );
  return log;
}

function makeLogs(): DailyLog[] {
  const today = getTodayIso();
  return [
    makeLog(addDays(today, -1), 1800),
    makeLog(today, 1200),
  ];
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor(
  predicate: () => boolean,
  message: string,
): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await flush();
  }
  throw new Error(message);
}

async function renderPage() {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root!.render(<TrendsPage />);
  });
  await waitFor(
    () => document.querySelector('.trend-summary') !== null ||
      document.body.textContent?.includes('趋势加载失败') === true,
    'TrendsPage did not finish loading',
  );
}

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === text,
  );
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  return button;
}

function click(element: Element) {
  return act(async () => {
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  });
}

describe('TrendsPage', () => {
  beforeAll(async () => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    await initializeI18n();
  });

  beforeEach(() => {
    mocks.loadTrendLogs.mockReset();
    mocks.loadTrendLogs.mockResolvedValue(makeLogs());
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
  });

  it('renders the 7-day table and opens a day dialog with macros in order', async () => {
    await renderPage();

    expect(
      document.body.querySelectorAll('.trend-table tbody tr'),
    ).toHaveLength(7);
    expect(document.body.textContent).toContain('点击柱体查看当天各营养素重量。');

    const hit = document.body.querySelector('.trend-chart__hit');
    expect(hit).not.toBeNull();
    await click(hit!);
    await waitFor(
      () => document.querySelector('[role="dialog"]') !== null,
      'trend dialog did not open',
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    const text = dialog!.textContent ?? '';
    expect(text).toContain('总热量');
    const carbsIndex = text.indexOf('碳水');
    const proteinIndex = text.indexOf('蛋白质');
    const fatIndex = text.indexOf('脂肪');
    expect(carbsIndex).toBeGreaterThanOrEqual(0);
    expect(proteinIndex).toBeGreaterThan(carbsIndex);
    expect(fatIndex).toBeGreaterThan(proteinIndex);
  });

  it('keeps the previous content visible while switching ranges', async () => {
    await renderPage();

    let resolveLoad: ((logs: DailyLog[]) => void) | null = null;
    mocks.loadTrendLogs.mockImplementationOnce(
      () =>
        new Promise<DailyLog[]>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    await click(findButton('30 天'));

    expect(document.body.querySelector('.trends-skeleton')).toBeNull();
    expect(
      document.body.querySelectorAll('.trend-table tbody tr'),
    ).toHaveLength(7);

    await act(async () => {
      resolveLoad?.(makeLogs());
      await Promise.resolve();
    });
    await waitFor(
      () =>
        document.querySelectorAll('.trend-table tbody tr').length === 30,
      '30-day table did not replace the previous range',
    );

    expect(
      document.body.querySelectorAll('.trend-chart__hit'),
    ).toHaveLength(0);
    expect(document.body.textContent).not.toContain(
      '点击柱体查看当天各营养素重量。',
    );

    const labels = Array.from(
      document.body.querySelectorAll('.trend-chart__date-label'),
    ).map((label) => label.textContent);
    expect(labels).toHaveLength(6);
    expect(labels[0]).toMatch(/^\d+\/\d+$/);
  });

  it('shows em dashes for averages when only today is logged', async () => {
    mocks.loadTrendLogs.mockResolvedValue([makeLog(getTodayIso(), 1200)]);
    await renderPage();

    const cards = document.body.querySelectorAll('.trend-summary__card');
    expect(cards[0]?.textContent).toContain('—');
    expect(cards[2]?.textContent).toContain('—');
    expect(cards[2]?.textContent).not.toContain('0 天');
  });

  it('shows an empty state when there are no entries', async () => {
    mocks.loadTrendLogs.mockResolvedValue([]);
    await renderPage();

    expect(document.body.textContent).toContain('还没有可展示的趋势');
    expect(
      document.body.querySelectorAll('.trend-table tbody tr'),
    ).toHaveLength(0);
  });

  it('retries after a load error', async () => {
    mocks.loadTrendLogs
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(makeLogs());
    await renderPage();

    expect(document.body.textContent).toContain('趋势加载失败');
    await click(findButton('重试'));
    await waitFor(
      () =>
        document.body.textContent?.includes('趋势加载失败') === false &&
        document.querySelectorAll('.trend-table tbody tr').length === 7,
      'trends did not recover after retry',
    );
  });
});
