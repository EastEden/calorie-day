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
import type { Food, FoodDraft } from '../../../domain/types';
import { initializeI18n } from '../../../i18n';
import { FoodEditorModal } from '../FoodEditorModal';

const createFoodMock = vi.fn<(draft: FoodDraft) => Promise<Food>>();
const updateFoodMock = vi.fn<
  (foodId: string, draft: FoodDraft) => Promise<Food>
>();
const deleteFoodMock = vi.fn<(foodId: string) => Promise<void>>();

vi.mock('../../../state/AppContext', () => ({
  useApp: () => ({
    isSaving: false,
    actions: {
      createFood: createFoodMock,
      updateFood: updateFoodMock,
      deleteFood: deleteFoodMock,
    },
  }),
}));

const sampleFood: Food = {
  id: 'food-existing',
  names: { 'zh-CN': '全麦麦片' },
  category: 'staple',
  basis: 'dry',
  nutritionPer100g: {
    kcal: 400,
    proteinG: 12,
    carbsG: 70,
    fatG: 8,
  },
  servings: [{ id: 'serving-1', label: '份', grams: 30 }],
  source: 'custom',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  );
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function getInputByLabel(labelText: string): HTMLInputElement {
  const labels = Array.from(document.body.querySelectorAll('label'));
  const match = labels.find((label) => {
    const firstSpan = label.querySelector('span');
    return firstSpan?.textContent?.trim() === labelText;
  });
  const input = match?.querySelector('input');
  if (!input) {
    throw new Error(`Input not found for label: ${labelText}`);
  }
  return input;
}

function getButtonByText(text: string): HTMLButtonElement {
  const buttons = Array.from(document.body.querySelectorAll('button'));
  const match = buttons.find((button) => button.textContent?.trim() === text);
  if (!match) {
    throw new Error(`Button not found: ${text}`);
  }
  return match;
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  const buttons = Array.from(document.body.querySelectorAll('button'));
  return buttons.find((button) => button.textContent?.trim() === text);
}

async function renderModal(food: Food | null, onClose = vi.fn()) {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root!.render(
      <FoodEditorModal open={true} food={food} onClose={onClose} />,
    );
  });
  return { onClose };
}

async function submitForm() {
  const form = document.body.querySelector<HTMLFormElement>('#food-editor-form');
  if (!form) {
    throw new Error('Food editor form not found');
  }
  await act(async () => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
}

describe('FoodEditorModal', () => {
  beforeAll(async () => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    await initializeI18n();
  });

  beforeEach(() => {
    createFoodMock.mockReset();
    updateFoodMock.mockReset();
    deleteFoodMock.mockReset();
    createFoodMock.mockResolvedValue(sampleFood);
    updateFoodMock.mockResolvedValue(sampleFood);
    deleteFoodMock.mockResolvedValue();
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

  it('creates a new food in per-serving mode and converts nutrition to per 100g', async () => {
    const { onClose } = await renderModal(null);

    await act(async () => {
      setInputValue(getInputByLabel('食物名称'), '燕麦脆');
      getButtonByText('按每份').click();
    });

    await act(async () => {
      setInputValue(getInputByLabel('每份重量'), '30');
      setInputValue(getInputByLabel('热量'), '120');
      setInputValue(getInputByLabel('蛋白质'), '5');
      setInputValue(getInputByLabel('碳水'), '15');
      setInputValue(getInputByLabel('脂肪'), '4');
    });

    const preview = document.body.querySelector(
      '.food-editor__converted-preview',
    );
    expect(preview?.textContent).toContain('400 kcal');
    expect(preview?.textContent).toContain('碳水 50g');
    expect(preview?.textContent).toContain('蛋白 16.7g');
    expect(preview?.textContent).toContain('脂肪 13.3g');

    await submitForm();

    expect(createFoodMock).toHaveBeenCalledTimes(1);
    expect(createFoodMock).toHaveBeenCalledWith(
      expect.objectContaining({
        names: { 'zh-CN': '燕麦脆' },
        nutritionPer100g: {
          kcal: 400,
          proteinG: 16.7,
          carbsG: 50,
          fatG: 13.3,
        },
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-converts per-serving inputs when switching back to per-100g mode', async () => {
    await renderModal(null);

    await act(async () => {
      setInputValue(getInputByLabel('食物名称'), '坚果棒');
      setInputValue(getInputByLabel('热量'), '400');
      setInputValue(getInputByLabel('蛋白质'), '10');
      setInputValue(getInputByLabel('碳水'), '50');
      setInputValue(getInputByLabel('脂肪'), '12');
      getButtonByText('按每份').click();
    });

    // Reference weight is empty on first switch: per-100g values must not leak into per-serving fields.
    expect(getInputByLabel('热量').value).toBe('');
    expect(getInputByLabel('蛋白质').value).toBe('');

    await act(async () => {
      setInputValue(getInputByLabel('每份重量'), '30');
      setInputValue(getInputByLabel('热量'), '120');
      setInputValue(getInputByLabel('蛋白质'), '5');
      setInputValue(getInputByLabel('碳水'), '15');
      setInputValue(getInputByLabel('脂肪'), '4');
      getButtonByText('按每 100g').click();
    });

    // Switching back to per 100g populates converted values instead of keeping 120.
    expect(getInputByLabel('热量').value).toBe('400');
    expect(getInputByLabel('蛋白质').value).toBe('16.7');
    expect(getInputByLabel('碳水').value).toBe('50');
    expect(getInputByLabel('脂肪').value).toBe('13.3');

    await submitForm();

    expect(createFoodMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nutritionPer100g: {
          kcal: 400,
          proteinG: 16.7,
          carbsG: 50,
          fatG: 13.3,
        },
      }),
    );
  });

  it('converts per-100g edits back to per-serving when reference weight is already set', async () => {
    await renderModal(null);

    await act(async () => {
      getButtonByText('按每份').click();
    });

    await act(async () => {
      setInputValue(getInputByLabel('每份重量'), '30');
      setInputValue(getInputByLabel('热量'), '120');
      setInputValue(getInputByLabel('蛋白质'), '5');
      setInputValue(getInputByLabel('碳水'), '15');
      setInputValue(getInputByLabel('脂肪'), '4');
      getButtonByText('按每 100g').click();
    });

    // Edit kcal in per-100g mode, then switch back to per-serving mode.
    await act(async () => {
      setInputValue(getInputByLabel('热量'), '500');
      getButtonByText('按每份').click();
    });

    expect(getInputByLabel('每份重量').value).toBe('30');
    expect(getInputByLabel('热量').value).toBe('150');
    expect(getInputByLabel('蛋白质').value).toBe('5');
    expect(getInputByLabel('碳水').value).toBe('15');
    expect(getInputByLabel('脂肪').value).toBe('4');
  });

  it('hides the per-serving toggle when editing an existing food and updates per-100g directly', async () => {
    const { onClose } = await renderModal(sampleFood);

    expect(findButtonByText('按每份')).toBeUndefined();
    expect(findButtonByText('按每 100g')).toBeUndefined();
    expect(getInputByLabel('热量').value).toBe('400');

    await act(async () => {
      setInputValue(getInputByLabel('热量'), '410');
    });

    await submitForm();

    expect(updateFoodMock).toHaveBeenCalledTimes(1);
    expect(updateFoodMock).toHaveBeenCalledWith(
      'food-existing',
      expect.objectContaining({
        nutritionPer100g: {
          kcal: 410,
          proteinG: 12,
          carbsG: 70,
          fatG: 8,
        },
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('validates missing reference weight and out-of-range converted nutrition', async () => {
    await renderModal(null);

    await act(async () => {
      setInputValue(getInputByLabel('食物名称'), '测试食品');
      getButtonByText('按每份').click();
    });

    await act(async () => {
      setInputValue(getInputByLabel('热量'), '120');
      setInputValue(getInputByLabel('蛋白质'), '5');
      setInputValue(getInputByLabel('碳水'), '15');
      setInputValue(getInputByLabel('脂肪'), '4');
    });

    await submitForm();
    expect(createFoodMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('每份重量必须是大于 0');

    await act(async () => {
      setInputValue(getInputByLabel('每份重量'), '0.001');
    });

    await submitForm();
    expect(createFoodMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('换算为每 100g 后数值超出允许范围');
  });

  it('uses valid aria-labelledby group semantics instead of nested legends', async () => {
    await renderModal(null);

    const invalidLegends = document.body.querySelectorAll('fieldset div legend');
    expect(invalidLegends).toHaveLength(0);
  });
});
