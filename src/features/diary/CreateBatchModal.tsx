import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { formatDecimal } from '../../domain/formatters';
import { getFoodDisplayName } from '../../domain/localizedText';
import type { Food } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

interface CreateBatchModalProps {
  open: boolean;
  onClose: () => void;
}

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

export function CreateBatchModal({
  open,
  onClose,
}: CreateBatchModalProps) {
  const { t, locale } = useI18n();
  const { foods, recentFoodIds, actions, isSaving } = useApp();
  const candidates = useMemo(() => {
    const ranks = new Map(
      recentFoodIds.map((foodId, index) => [foodId, index]),
    );
    return foods
      .filter((food) => !food.batch)
      .sort((a, b) => {
        const rankA = ranks.get(a.id);
        const rankB = ranks.get(b.id);
        if (rankA === undefined && rankB === undefined) {
          return 0;
        }
        if (rankA === undefined) {
          return 1;
        }
        if (rankB === undefined) {
          return -1;
        }
        return rankA - rankB;
      });
  }, [foods, recentFoodIds]);

  const [foodId, setFoodId] = useState('');
  const [totalGrams, setTotalGrams] = useState('1000');
  const [portionGrams, setPortionGrams] = useState('250');
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedFood: Food | undefined =
    candidates.find((food) => food.id === foodId) ?? candidates[0];
  const total = parseNumber(totalGrams);
  const portion = parseNumber(portionGrams);
  const totalValid =
    Number.isFinite(total) && total > 0 && total <= 100_000;
  const portionValid =
    Number.isFinite(portion) &&
    portion > 0 &&
    portion <= 100_000 &&
    totalValid &&
    portion <= total;
  const portions =
    totalValid && portionValid ? Math.floor(total / portion) : 0;
  const isBusy = submitting || isSaving;

  useEffect(() => {
    if (!open) {
      return;
    }
    setFoodId(candidates[0]?.id ?? '');
    setTotalGrams('1000');
    setPortionGrams('250');
    setAttempted(false);
    setSubmitting(false);
    setSubmitError(null);
  }, [candidates, open]);

  const handleClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setSubmitError(null);

    if (!selectedFood || !totalValid || !portionValid || isBusy) {
      return;
    }

    setSubmitting(true);
    try {
      await actions.createMealPrepBatch(selectedFood, total, portion);
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t('batch.invalidTotal'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      title={t('batch.createTitle')}
      description={t('batch.createDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isBusy}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-batch-form"
            loading={submitting}
            disabled={isBusy || candidates.length === 0}
          >
            {t('batch.create')}
          </Button>
        </>
      }
    >
      <form
        id="create-batch-form"
        className="meal-prep-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {candidates.length === 0 ? (
          <p className="form-error" role="alert">
            {t('batch.noFoods')}
          </p>
        ) : (
          <>
            <label className="field">
              <span className="field-label">{t('batch.food')}</span>
              <select
                value={selectedFood?.id ?? ''}
                onChange={(event) => setFoodId(event.target.value)}
                disabled={isBusy}
              >
                {candidates.map((food) => (
                  <option key={food.id} value={food.id}>
                    {getFoodDisplayName(food, locale)}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-row">
              <label className="field">
                <span className="field-label">
                  {t('batch.totalGrams')}
                </span>
                <span className="input-with-suffix">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={100_000}
                    step="any"
                    value={totalGrams}
                    onChange={(event) => setTotalGrams(event.target.value)}
                    disabled={isBusy}
                  />
                  <span>{t('common.gram')}</span>
                </span>
              </label>

              <label className="field">
                <span className="field-label">
                  {t('batch.portionGrams')}
                </span>
                <span className="input-with-suffix">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={100_000}
                    step="any"
                    value={portionGrams}
                    onChange={(event) => setPortionGrams(event.target.value)}
                    disabled={isBusy}
                  />
                  <span>{t('common.gram')}</span>
                </span>
              </label>
            </div>

            <p className="field-hint">{t('batch.nutritionHint')}</p>

            {attempted && !totalValid && (
              <p className="form-error" role="alert">
                {t('batch.invalidTotal')}
              </p>
            )}
            {attempted && totalValid && !portionValid && (
              <p className="form-error" role="alert">
                {t('batch.invalidPortion')}
              </p>
            )}

            {selectedFood && totalValid && portionValid && (
              <div className="portion-preview">
                <div className="portion-preview__energy">
                  <span>{t('batch.portionPreview', {
                    n: portions,
                    grams: formatDecimal(portion),
                  })}</span>
                  <strong>
                    {formatDecimal(portions)} × {formatDecimal(portion)}g
                  </strong>
                  <small>
                    {getFoodDisplayName(selectedFood, locale)} ·{' '}
                    {formatDecimal(total)}g
                  </small>
                </div>
              </div>
            )}

            {submitError && (
              <p className="form-error" role="alert">
                {submitError}
              </p>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
