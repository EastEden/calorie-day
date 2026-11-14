import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  formatDecimal,
  formatKcal,
} from '../../domain/formatters';
import { createId } from '../../domain/id';
import { getFoodDisplayName } from '../../domain/localizedText';
import { addNutrition, scaleNutrition } from '../../domain/nutrition';
import type { Food } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

interface CreateBatchModalProps {
  open: boolean;
  onClose: () => void;
}

interface ComponentRow {
  key: string;
  foodId: string;
  grams: string;
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

  const [name, setName] = useState('');
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [portions, setPortions] = useState('4');
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resolvedRows = rows.map((row) => ({
    row,
    food: candidates.find((food) => food.id === row.foodId),
    grams: parseNumber(row.grams),
  }));
  const rowsValid =
    resolvedRows.length > 0 &&
    resolvedRows.every(
      (item) =>
        item.food &&
        Number.isFinite(item.grams) &&
        item.grams > 0 &&
        item.grams <= 100_000,
    );
  const totalGrams = resolvedRows.reduce(
    (sum, item) =>
      item.food && Number.isFinite(item.grams) && item.grams > 0
        ? sum + item.grams
        : sum,
    0,
  );
  const portionsNumber = Number(portions);
  const portionsValid =
    Number.isInteger(portionsNumber) &&
    portionsNumber >= 1 &&
    portionsNumber <= 100;
  const totalNutrition = resolvedRows.reduce(
    (total, item) => {
      if (!item.food || !Number.isFinite(item.grams) || item.grams <= 0) {
        return total;
      }
      return addNutrition(
        total,
        scaleNutrition(item.food.nutritionPer100g, item.grams / 100),
      );
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const isValid =
    rowsValid &&
    portionsValid &&
    totalGrams > 0 &&
    totalGrams <= 100_000;
  const isBusy = submitting || isSaving;

  useEffect(() => {
    if (!open) {
      return;
    }
    const first = candidates[0];
    setName('');
    setRows(
      first
        ? [
            {
              key: createId('batch-row'),
              foodId: first.id,
              grams: '500',
            },
          ]
        : [],
    );
    setPortions('4');
    setAttempted(false);
    setSubmitting(false);
    setSubmitError(null);
  }, [candidates, open]);

  const addRow = () => {
    const used = new Set(rows.map((row) => row.foodId));
    const nextFood =
      candidates.find((food) => !used.has(food.id)) ?? candidates[0];
    if (!nextFood) {
      return;
    }
    setRows((current) => [
      ...current,
      {
        key: createId('batch-row'),
        foodId: nextFood.id,
        grams: '200',
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<ComponentRow>) => {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    );
  };

  const removeRow = (key: string) => {
    setRows((current) =>
      current.length <= 1
        ? current
        : current.filter((row) => row.key !== key),
    );
  };

  const handleClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setSubmitError(null);

    if (!isValid || isBusy) {
      return;
    }

    const components = resolvedRows
      .filter(
        (item): item is typeof item & { food: Food } =>
          Boolean(item.food),
      )
      .map((item) => ({
        food: item.food,
        grams: item.grams,
      }));

    setSubmitting(true);
    try {
      await actions.createMealPrepBatch({
        name,
        components,
        portions: portionsNumber,
      });
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t('batch.invalidComponents'),
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
              <span className="field-label">{t('batch.groupName')}</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('batch.groupNamePlaceholder')}
                maxLength={80}
                disabled={isBusy}
              />
            </label>

            <div className="field">
              <span className="field-label">{t('batch.components')}</span>
              <div className="meal-prep-components">
                {rows.map((row, index) => (
                  <div className="meal-prep-component-row" key={row.key}>
                    <select
                      value={row.foodId}
                      onChange={(event) =>
                        updateRow(row.key, {
                          foodId: event.target.value,
                        })
                      }
                      aria-label={t('batch.componentFoodAria', {
                        index: index + 1,
                      })}
                      disabled={isBusy}
                    >
                      {candidates.map((food) => (
                        <option key={food.id} value={food.id}>
                          {getFoodDisplayName(food, locale)}
                        </option>
                      ))}
                    </select>
                    <label className="meal-prep-component-grams">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={100_000}
                        step="any"
                        value={row.grams}
                        onChange={(event) =>
                          updateRow(row.key, {
                            grams: event.target.value,
                          })
                        }
                        aria-label={t('batch.componentGramsAria', {
                          index: index + 1,
                        })}
                        disabled={isBusy}
                      />
                      <span>{t('common.gram')}</span>
                    </label>
                    <button
                      type="button"
                      className="icon-button meal-prep-component-remove"
                      onClick={() => removeRow(row.key)}
                      disabled={isBusy || rows.length <= 1}
                      aria-label={t('batch.removeComponentAria', {
                        index: index + 1,
                      })}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={14} />}
                onClick={addRow}
                disabled={isBusy || rows.length >= candidates.length}
              >
                {t('batch.addComponent')}
              </Button>
            </div>

            <label className="field">
              <span className="field-label">{t('batch.portionCount')}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={portions}
                onChange={(event) => setPortions(event.target.value)}
                disabled={isBusy}
              />
              <span className="field-hint">{t('batch.portionCountHint')}</span>
            </label>

            <p className="field-hint">{t('batch.nutritionHint')}</p>

            {attempted && !rowsValid && (
              <p className="form-error" role="alert">
                {t('batch.invalidComponents')}
              </p>
            )}
            {attempted && rowsValid && !portionsValid && (
              <p className="form-error" role="alert">
                {t('batch.invalidPortions')}
              </p>
            )}

            {isValid && (
              <div className="portion-preview">
                <div className="portion-preview__energy">
                  <span>
                    {t('batch.groupPreview', {
                      grams: formatDecimal(totalGrams),
                      portions: portionsNumber,
                    })}
                  </span>
                  <strong>
                    {formatKcal(totalNutrition.kcal)} {t('common.kcal')}
                  </strong>
                  <small>
                    {name.trim() || t('batch.defaultName')}
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
