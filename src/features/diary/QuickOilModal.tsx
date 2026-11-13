import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Droplet } from 'lucide-react';
import { MEAL_META } from '../../domain/constants';
import {
  getCookingOilFoods,
  getDefaultCookingOil,
} from '../../domain/cookingOils';
import { formatDecimal, formatKcal } from '../../domain/formatters';
import { getFoodDisplayName } from '../../domain/localizedText';
import { scaleNutrition } from '../../domain/nutrition';
import type { MealType } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

interface QuickOilModalProps {
  open: boolean;
  mealType: MealType;
  onClose: () => void;
}

const QUICK_AMOUNTS = [5, 10, 15];

function parseAmount(value: string): number {
  return Number(value.replace(',', '.'));
}

export function QuickOilModal({
  open,
  mealType,
  onClose,
}: QuickOilModalProps) {
  const { t, locale } = useI18n();
  const { foods, actions, isSaving } = useApp();
  const oils = useMemo(() => getCookingOilFoods(foods), [foods]);
  const [oilId, setOilId] = useState('');
  const [amount, setAmount] = useState('10');
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mealLabel = t(MEAL_META[mealType].labelKey);
  const selectedOil =
    oils.find((food) => food.id === oilId) ?? oils[0];
  const grams = parseAmount(amount);
  const isValid =
    Boolean(selectedOil) &&
    Number.isFinite(grams) &&
    grams > 0 &&
    grams <= 100_000;
  const isBusy = submitting || isSaving;
  const scaled = scaleNutrition(
    selectedOil?.nutritionPer100g ?? {
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    },
    isValid ? grams / 100 : 0,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setOilId(getDefaultCookingOil(oils)?.id ?? '');
    setAmount('10');
    setAttempted(false);
    setSubmitting(false);
  }, [mealType, oils, open]);

  const handleClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);

    if (!selectedOil || !isValid) {
      return;
    }

    setSubmitting(true);
    try {
      const ok = await actions.addEntry(mealType, selectedOil, {
        grams,
        enteredQuantity: grams,
        enteredUnit: 'g',
      });
      if (ok) {
        onClose();
      }
    } catch {
      // The app-level action already surfaces storage errors as toasts.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      title={t('quickOil.title')}
      description={t('quickOil.description', { meal: mealLabel })}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isBusy}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="quick-oil-form"
            loading={submitting}
            disabled={oils.length === 0 || isSaving || submitting}
          >
            {t('quickOil.submit', { meal: mealLabel })}
          </Button>
        </>
      }
    >
      <form
        id="quick-oil-form"
        className="quick-oil"
        onSubmit={handleSubmit}
        noValidate
      >
        {oils.length === 0 ? (
          <div className="quick-oil__empty">
            <span className="quick-oil__empty-icon" aria-hidden="true">
              <Droplet size={20} />
            </span>
            <strong>{t('quickOil.noOilsTitle')}</strong>
            <p>{t('quickOil.noOilsBody')}</p>
            <small>{t('quickOil.noOilsHint')}</small>
          </div>
        ) : (
          <>
            <div className="field">
              <span className="field-label">{t('quickOil.oil')}</span>
              {oils.length === 1 ? (
                <div className="quick-oil__selected">
                  <Droplet size={16} aria-hidden="true" />
                  <strong>
                    {selectedOil
                      ? getFoodDisplayName(selectedOil, locale)
                      : t('quickOil.noSelection')}
                  </strong>
                </div>
              ) : (
                <select
                  value={selectedOil?.id ?? ''}
                  onChange={(event) => setOilId(event.target.value)}
                  disabled={isBusy}
                  aria-label={t('quickOil.oil')}
                >
                  {oils.map((oil) => (
                    <option key={oil.id} value={oil.id}>
                      {getFoodDisplayName(oil, locale)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="field">
              <span className="field-label">{t('quickOil.amount')}</span>
              <div
                className="filter-chips"
                role="group"
                aria-label={t('quickOil.amountAria')}
              >
                {QUICK_AMOUNTS.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={`filter-chip ${
                      grams === value ? 'is-active' : ''
                    }`}
                    onClick={() => setAmount(String(value))}
                    disabled={isBusy}
                  >
                    {t('quickOil.quickAmount', { value })}
                  </button>
                ))}
              </div>
              <label className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100_000}
                  step="any"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  aria-label={t('quickOil.gramsAria')}
                  disabled={isBusy}
                />
                <span>{t('common.gram')}</span>
              </label>
              <span className="field-hint">{t('quickOil.amountHint')}</span>
            </div>

            {attempted && !isValid && (
              <p className="form-error" role="alert">
                {t('quickOil.invalid')}
              </p>
            )}

            <div className="portion-preview">
              <div className="portion-preview__energy">
                <span>{t('quickOil.preview')}</span>
                <strong>{formatKcal(scaled.kcal)}</strong>
                <small>
                  {t('quickOil.previewDetail', {
                    kcal: formatKcal(scaled.kcal),
                    fat: formatDecimal(scaled.fatG),
                  })}
                </small>
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
