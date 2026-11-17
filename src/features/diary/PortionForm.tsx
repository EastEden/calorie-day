import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type {
  AmountUnit,
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
  nutritionByUnit: Partial<Record<AmountUnit, Nutrition>>;
  defaultUnit: AmountUnit;
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
  nutritionByUnit,
  defaultUnit,
  servings,
  initial,
  submitLabel,
  onSubmit,
  disabled = false,
  secondaryAction,
}: PortionFormProps) {
  const { t } = useI18n();
  const hasGrams = Boolean(nutritionByUnit.g);
  const hasMilliliters = Boolean(nutritionByUnit.ml);
  const availableServings = hasGrams ? servings : [];

  const initialServing = useMemo<ServingOption | null>(() => {
    if (
      initial?.enteredUnit !== 'serving' ||
      !initial.servingLabel ||
      !initial.servingGrams
    ) {
      return null;
    }

    const existing = availableServings.find(
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
  }, [availableServings, initial]);

  const servingsWithInitial = useMemo(() => {
    if (!initialServing) {
      return availableServings;
    }
    if (
      availableServings.some(
        (serving) => serving.id === initialServing.id,
      )
    ) {
      return availableServings;
    }
    return [initialServing, ...availableServings];
  }, [availableServings, initialServing]);

  const initialUnit: EntryUnit = (() => {
    if (initial?.enteredUnit === 'serving' && servingsWithInitial.length > 0) {
      return 'serving';
    }
    if (initial?.enteredUnit === 'ml' && hasMilliliters) {
      return 'ml';
    }
    if (initial?.enteredUnit === 'g' && hasGrams) {
      return 'g';
    }
    if (servingsWithInitial.length > 0) {
      return 'serving';
    }
    return defaultUnit === 'ml' && hasMilliliters ? 'ml' : 'g';
  })();

  const [unit, setUnit] = useState<EntryUnit>(initialUnit);
  const [quantity, setQuantity] = useState(
    initial
      ? String(initial.enteredQuantity)
      : initialUnit === 'serving'
        ? '1'
        : initialUnit === 'ml'
          ? '250'
          : '100',
  );
  const [servingId, setServingId] = useState(
    initialServing?.id ?? servingsWithInitial[0]?.id ?? '',
  );
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedServing =
    servingsWithInitial.find((serving) => serving.id === servingId) ??
    servingsWithInitial[0];

  const parsedQuantity = normalizeNumericInput(quantity);
  const amount =
    unit === 'serving'
      ? parsedQuantity * (selectedServing?.grams ?? 0)
      : parsedQuantity;
  const amountUnit: AmountUnit = unit === 'ml' ? 'ml' : 'g';
  const referenceNutrition = nutritionByUnit[amountUnit];
  const isValid =
    Boolean(referenceNutrition) &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 100_000 &&
    (unit === 'g' || unit === 'ml' || Boolean(selectedServing));
  const scaled = scaleNutrition(
    referenceNutrition ?? {
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    },
    isValid ? amount / 100 : 0,
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
      const target = selectedServing ?? servingsWithInitial[0];
      if (!target) {
        return;
      }
      if (isValid) {
        setQuantityFromNumber(amount / target.grams);
      }
      setServingId(target.id);
      setUnit('serving');
      return;
    }

    if (unit === 'serving' && isValid) {
      setQuantityFromNumber(amount);
    }
    setUnit(nextUnit);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setSubmitError(null);

    if (!isValid || !referenceNutrition) {
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onSubmit({
        amount,
        unit: amountUnit,
        enteredQuantity: parsedQuantity,
        enteredUnit: unit,
        servingLabel:
          unit === 'serving' ? selectedServing?.label : undefined,
        servingGrams:
          unit === 'serving' ? selectedServing?.grams : undefined,
        nutritionPer100Snapshot: referenceNutrition,
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

  const per100Label =
    unit === 'ml' ? t('portion.per100Ml') : t('portion.per100');
  const quantityLabel =
    unit === 'serving'
      ? t('portion.servingsLabel')
      : unit === 'ml'
        ? t('portion.millilitersLabel')
        : t('portion.gramsLabel');
  const quantitySuffix =
    unit === 'serving'
      ? selectedServing?.label ?? t('portion.servingFallback')
      : unit === 'ml'
        ? t('common.ml')
        : t('common.gram');

  return (
    <form className="portion-form" onSubmit={handleSubmit}>
      <div className="portion-form__per100">
        <span>{per100Label}</span>
        <strong>
          {formatKcal(referenceNutrition?.kcal ?? 0)} {t('common.kcal')}
        </strong>
        <small>
          {t('common.carbs')}{' '}
          {formatDecimal(referenceNutrition?.carbsG ?? 0)}
          {t('common.gram')} · {t('common.proteinShort')}{' '}
          {formatDecimal(referenceNutrition?.proteinG ?? 0)}
          {t('common.gram')} · {t('common.fat')}{' '}
          {formatDecimal(referenceNutrition?.fatG ?? 0)}
          {t('common.gram')}
        </small>
      </div>

      {(hasGrams || hasMilliliters || servingsWithInitial.length > 0) && (
        <div
          className="segmented"
          role="group"
          aria-label={t('portion.modeAria')}
        >
          {hasGrams && (
            <button
              type="button"
              className={`segmented__option ${
                unit === 'g' ? 'is-active' : ''
              }`}
              onClick={() => switchUnit('g')}
              disabled={isBusy}
            >
              {t('portion.modeGrams')}
            </button>
          )}
          {hasMilliliters && (
            <button
              type="button"
              className={`segmented__option ${
                unit === 'ml' ? 'is-active' : ''
              }`}
              onClick={() => switchUnit('ml')}
              disabled={isBusy}
            >
              {t('portion.modeMl')}
            </button>
          )}
          {servingsWithInitial.length > 0 && (
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
          )}
        </div>
      )}

      {unit === 'serving' && servingsWithInitial.length > 0 && (
        <div className="serving-picker">
          <span className="field-label">{t('portion.chooseServing')}</span>
          <div className="choice-chips">
            {servingsWithInitial.map((serving) => (
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
        <label htmlFor="portion-quantity">{quantityLabel}</label>
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
          <span id="portion-unit-label">{quantitySuffix}</span>
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
          : unit === 'ml'
            ? [100, 200, 250, 300].map((value) => (
                <button
                  type="button"
                  key={value}
                  className="quick-amount"
                  onClick={() => setQuantity(String(value))}
                  disabled={isBusy}
                >
                  {t('portion.quickMl', { value })}
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
                  grams: formatDecimal(isValid ? amount : 0),
                })
              : unit === 'ml'
                ? t('portion.mlDetail', {
                    ml: formatDecimal(isValid ? amount : 0),
                  })
                : t('portion.gramsDetail', {
                    grams: formatDecimal(isValid ? amount : 0),
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
