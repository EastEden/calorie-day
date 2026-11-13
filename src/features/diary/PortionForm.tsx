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
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();
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
        setSubmitError(t('portion.saveError'));
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t('portion.saveError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="portion-form" onSubmit={handleSubmit}>
      <div className="portion-form__per100">
        <span>{t('portion.per100')}</span>
        <strong>
          {formatKcal(nutritionPer100g.kcal)} {t('common.kcal')}
        </strong>
        <small>
          {t('common.carbs')} {formatDecimal(nutritionPer100g.carbsG)}
          {t('common.gram')} · {t('common.proteinShort')}{' '}
          {formatDecimal(nutritionPer100g.proteinG)}
          {t('common.gram')} · {t('common.fat')}{' '}
          {formatDecimal(nutritionPer100g.fatG)}
          {t('common.gram')}
        </small>
      </div>

      {availableServings.length > 0 && (
        <div
          className="segmented"
          role="group"
          aria-label={t('portion.modeAria')}
        >
          <button
            type="button"
            className={`segmented__option ${unit === 'g' ? 'is-active' : ''}`}
            onClick={() => switchUnit('g')}
            disabled={isBusy}
          >
            {t('portion.modeGrams')}
          </button>
          <button
            type="button"
            className={`segmented__option ${
              unit === 'serving' ? 'is-active' : ''
            }`}
            onClick={() => switchUnit('serving')}
            disabled={isBusy}
          >
            {t('portion.modeServing')}
          </button>
        </div>
      )}

      {unit === 'serving' && availableServings.length > 0 && (
        <div className="serving-picker">
          <span className="field-label">{t('portion.chooseServing')}</span>
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
                <small>
                  {formatDecimal(serving.grams)}
                  {t('common.gram')}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="amount-field">
        <label htmlFor="portion-quantity">
          {unit === 'serving'
            ? t('portion.servingsLabel')
            : t('portion.gramsLabel')}
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
            {unit === 'serving'
              ? selectedServing?.label ?? t('portion.servingFallback')
              : t('common.gram')}
          </span>
        </div>
      </div>

      <div
        className="quick-amounts"
        aria-label={t('portion.quickAria')}
      >
        {unit === 'g'
          ? [50, 100, 150, 200].map((value) => (
              <button
                type="button"
                key={value}
                className="quick-amount"
                onClick={() => setQuantity(String(value))}
                disabled={isBusy}
              >
                {t('portion.quickGram', { value })}
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
                {t('portion.quickServing', { value })}
              </button>
            ))}
      </div>

      {attempted && !isValid && (
        <p className="form-error" role="alert">
          {t('portion.invalid')}
        </p>
      )}
      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}

      <div className="portion-preview">
        <div className="portion-preview__energy">
          <span>{t('portion.thisIntake')}</span>
          <strong>
            {formatKcal(scaled.kcal)} {t('common.kcal')}
          </strong>
          <small>
            {unit === 'serving' && selectedServing
              ? t('portion.servingDetail', {
                  quantity: formatDecimal(parsedQuantity || 0),
                  label: selectedServing.label,
                  grams: formatDecimal(isValid ? grams : 0),
                })
              : t('portion.gramsDetail', {
                  grams: formatDecimal(isValid ? grams : 0),
                })}
          </small>
        </div>
        <div className="portion-preview__macros">
          <span>
            {t('common.carbs')}{' '}
            <strong>
              {formatDecimal(scaled.carbsG)}
              {t('common.gram')}
            </strong>
          </span>
          <span>
            {t('common.proteinShort')}{' '}
            <strong>
              {formatDecimal(scaled.proteinG)}
              {t('common.gram')}
            </strong>
          </span>
          <span>
            {t('common.fat')}{' '}
            <strong>
              {formatDecimal(scaled.fatG)}
              {t('common.gram')}
            </strong>
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
