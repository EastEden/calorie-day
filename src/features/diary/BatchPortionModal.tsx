import { useEffect, useState } from 'react';
import { formatDecimal } from '../../domain/formatters';
import { getFoodDisplayName } from '../../domain/localizedText';
import type { Food, MealType } from '../../domain/types';
import { MEAL_META, MEAL_TYPES } from '../../domain/constants';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { PortionForm } from './PortionForm';

interface BatchPortionModalProps {
  open: boolean;
  batch: Food | null;
  onClose: () => void;
}

function getSuggestedMeal(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) {
    return 'breakfast';
  }
  if (hour < 15) {
    return 'lunch';
  }
  if (hour < 21) {
    return 'dinner';
  }
  return 'snack';
}

export function BatchPortionModal({
  open,
  batch,
  onClose,
}: BatchPortionModalProps) {
  const { t, locale } = useI18n();
  const { foodUsage, actions, isSaving } = useApp();
  const [mealType, setMealType] = useState<MealType>(getSuggestedMeal);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const used = batch ? foodUsage[batch.id] ?? 0 : 0;
  const remaining = batch?.batch
    ? Math.max(0, batch.batch.totalGrams - used)
    : 0;
  const mealLabel = t(MEAL_META[mealType].labelKey);
  const isBusy = isSaving;

  useEffect(() => {
    if (open) {
      setMealType(getSuggestedMeal());
      setSubmitError(null);
    }
  }, [open]);

  if (!batch?.batch) {
    return null;
  }

  const handleClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      title={t('batch.recordTitle')}
      description={t('batch.recordDescription', {
        name: getFoodDisplayName(batch, locale),
        grams: formatDecimal(remaining),
      })}
      footer={
        <Button variant="ghost" onClick={handleClose} disabled={isBusy}>
          {t('common.cancel')}
        </Button>
      }
    >
      <div className="meal-prep-portion">
        <div className="field">
          <span className="field-label">{t('batch.meal')}</span>
          <div
            className="segmented segmented--wide"
            role="group"
            aria-label={t('batch.meal')}
          >
            {MEAL_TYPES.map((meal) => (
              <button
                type="button"
                key={meal}
                className={`segmented__option ${
                  mealType === meal ? 'is-active' : ''
                }`}
                onClick={() => setMealType(meal)}
                disabled={isBusy}
              >
                {t(MEAL_META[meal].labelKey)}
              </button>
            ))}
          </div>
        </div>

        {remaining <= 0 ? (
          <p className="form-error" role="alert">
            {t('batch.finished')}
          </p>
        ) : (
          <>
            <PortionForm
              key={`${batch.id}-${open}`}
              nutritionPer100g={batch.nutritionPer100g}
              servings={batch.servings}
              initial={{
                enteredQuantity: Math.min(
                  batch.batch.portionGrams,
                  remaining,
                ),
                enteredUnit: 'g',
              }}
              submitLabel={t('batch.recordSubmit', { meal: mealLabel })}
              disabled={isBusy || remaining <= 0}
              onSubmit={async (amount) => {
                if (amount.grams > remaining + 0.001) {
                  setSubmitError(t('batch.overRemaining'));
                  return false;
                }
                setSubmitError(null);
                const ok = await actions.addEntry(mealType, batch, amount);
                if (ok) {
                  onClose();
                }
                return ok;
              }}
            />
            {submitError && (
              <p className="form-error" role="alert">
                {submitError}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
