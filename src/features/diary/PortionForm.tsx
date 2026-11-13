import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type {
  EntryUnit,
  Nutrition,
  ServingOption,
} from '../../domain/types';
import type { EntryAmountInput } from '../../domain/logFactory';
import {
  formatDecimal,
  formatKcal,
} from '../../domain/formatters';
import { scaleNutrition } from '../../domain/nutrition';
import { Button } from '../../ui/Button';

export interface PortionInitial {
  enteredQuantity: number;
  enteredUnit: EntryUnit;
  servingLabel?: string;
  servingGrams?: number;
}

interface PortionFormProps {
  nutritionPer100g: Nutrition;
  servings: ServingOption[];
  initial?: PortionInitial;
  submitLabel: string;
  onSubmit: (amount: EntryAmountInput) => Promise<boolean>;
  disabled?: boolean;
  secondaryAction?: ReactNode;
}

function normalizeNumericInput(value: string): number {
  return Number(value.replace(',', '.'));
}

export function PortionForm({
  nutritionPer100g,
  servings,
  initial,
  submitLabel,
  onSubmit,
  disabled = false,
  secondaryAction,
}: PortionFormProps) {
  const initialServing = useMemo<ServingOption | null>(() => {
    if (
      initial?.enteredUnit !== 'serving' ||
      !initial.servingLabel ||
      !initial.servingGrams
    ) {
      return null;
    }

    const existing = servings.find(
      (serving) =>
        serving.label === initial.servingLabel &&
        serving.grams === initial.servingGrams,
    );

    return (
      existing ?? {
        id: 'entry-current-serving',
        label: initial.servingLabel,
        grams: initial.servingGrams,
      }
    );
  }, [initial, servings]);

  const availableServings = useMemo(() => {
    if (!initialServing) {
      return servings;
    }
    if (servings.some((serving) => serving.id === initialServing.id)) {
      return servings;
    }
    return [initialServing, ...servings];
  }, [initialServing, servings]);

  const initialUnit: EntryUnit =
    initial?.enteredUnit ??
    (availableServings.length > 0 ? 'serving' : 'g');
  const [unit, setUnit] = useState<EntryUnit>(initialUnit);
  const [quantity, setQuantity] = useState(
    initial
      ? String(initial.enteredQuantity)
      : initialUnit === 'serving'
        ? '1'
        : '100',
  );
  const [servingId, setServingId] = useState(
    initialServing?.id ?? availableServings[0]?.id ?? '',
  );
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedServing =
    availableServings.find((serving) => serving.id === servingId) ??
    availableServings[0];

  const parsedQuantity = normalizeNumericInput(quantity);
  const grams =
    unit === 'serving'
      ? parsedQuantity * (selectedServing?.grams ?? 0)
      : parsedQuantity;
  const isValid =
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    Number.isFinite(grams) &&
    grams > 0 &&
    grams <= 100_000 &&
    (unit === 'g' || Boolean(selectedServing));
  const scaled = scaleNutrition(
    nutritionPer100g,
    isValid ? grams / 100 : 0,
  );
  const isBusy = submitting || disabled;

  const setQuantityFromNumber = (value: number) => {
    if (Number.isFinite(value) && value > 0) {
      setQuantity(String(Math.round(value * 100) / 100));
    }
  };

  const switchUnit = (nextUnit: EntryUnit) => {
    if (nextUnit === unit) {
      return;
    }

    if (nextUnit === 'serving') {
      const target = selectedServing ?? availableServings[0];
      if (!target) {
        return;
      }
      if (isValid) {
        setQuantityFromNumber(grams / target.grams);
      }
      setServingId(target.id);
    } else if (isValid) {
      setQuantityFromNumber(grams);
    }

    setUnit(nextUnit);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setSubmitError(null);

    if (!isValid) {
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onSubmit({
        grams,
        enteredQuantity: parsedQuantity,
        enteredUnit: unit,
        servingLabel:
          unit === 'serving' ? selectedServing?.label : undefined,
        servingGrams:
          unit === 'serving' ? selectedServing?.grams : undefined,
      });
      if (!ok) {
        setSubmitError('保存失败，请重试。');
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : '保存失败，请重试。',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="portion-form" onSubmit={handleSubmit}>
      <div className="portion-form__per100">
        <span>每 100g</span>
        <strong>{formatKcal(nutritionPer100g.kcal)} kcal</strong>
        <small>
          碳水 {formatDecimal(nutritionPer100g.carbsG)}g · 蛋白{' '}
          {formatDecimal(nutritionPer100g.proteinG)}g · 脂肪{' '}
          {formatDecimal(nutritionPer100g.fatG)}g
        </small>
      </div>

      {availableServings.length > 0 && (
        <div className="segmented" role="group" aria-label="计量方式">
          <button
            type="button"
            className={`segmented__option ${unit === 'g' ? 'is-active' : ''}`}
            onClick={() => switchUnit('g')}
            disabled={isBusy}
          >
            按克
          </button>
          <button
            type="button"
            className={`segmented__option ${
              unit === 'serving' ? 'is-active' : ''
            }`}
            onClick={() => switchUnit('serving')}
            disabled={isBusy}
          >
            按份
          </button>
        </div>
      )}

      {unit === 'serving' && availableServings.length > 0 && (
        <div className="serving-picker">
          <span className="field-label">选择份量</span>
          <div className="choice-chips">
            {availableServings.map((serving) => (
              <button
                type="button"
                key={serving.id}
                className={`choice-chip ${
                  selectedServing?.id === serving.id ? 'is-active' : ''
                }`}
                onClick={() => setServingId(serving.id)}
                disabled={isBusy}
              >
                {serving.label}
                <small>{formatDecimal(serving.grams)}g</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="amount-field">
        <label htmlFor="portion-quantity">
          {unit === 'serving' ? '份数' : '克数'}
        </label>
        <div className="amount-field__control">
          <input
            id="portion-quantity"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-describedby="portion-unit-label"
            disabled={isBusy}
          />
          <span id="portion-unit-label">
            {unit === 'serving' ? selectedServing?.label ?? '份' : 'g'}
          </span>
        </div>
      </div>

      <div className="quick-amounts" aria-label="快捷份量">
        {unit === 'g'
          ? [50, 100, 150, 200].map((value) => (
              <button
                type="button"
                key={value}
                className="quick-amount"
                onClick={() => setQuantity(String(value))}
                disabled={isBusy}
              >
                {value}g
              </button>
            ))
          : [0.5, 1, 1.5, 2].map((value) => (
              <button
                type="button"
                key={value}
                className="quick-amount"
                onClick={() => setQuantity(String(value))}
                disabled={isBusy}
              >
                {value} 份
              </button>
            ))}
      </div>

      {attempted && !isValid && (
        <p className="form-error" role="alert">
          请输入大于 0 的有效份量。
        </p>
      )}
      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}

      <div className="portion-preview">
        <div className="portion-preview__energy">
          <span>本次摄入</span>
          <strong>{formatKcal(scaled.kcal)} kcal</strong>
          <small>
            {unit === 'serving' && selectedServing
              ? `${formatDecimal(parsedQuantity || 0)} ${selectedServing.label} · ${formatDecimal(
                  isValid ? grams : 0,
                )}g`
              : `${formatDecimal(isValid ? grams : 0)}g`}
          </small>
        </div>
        <div className="portion-preview__macros">
          <span>
            碳水 <strong>{formatDecimal(scaled.carbsG)}g</strong>
          </span>
          <span>
            蛋白 <strong>{formatDecimal(scaled.proteinG)}g</strong>
          </span>
          <span>
            脂肪 <strong>{formatDecimal(scaled.fatG)}g</strong>
          </span>
        </div>
      </div>

      <Button
        type="submit"
        fullWidth
        loading={submitting}
        disabled={disabled}
      >
        {submitLabel}
      </Button>

      {secondaryAction && (
        <div className="portion-form__secondary">{secondaryAction}</div>
      )}
    </form>
  );
}
