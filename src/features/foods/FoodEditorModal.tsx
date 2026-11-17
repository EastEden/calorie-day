import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  AmountUnit,
  Food,
  FoodBasis,
  FoodCategory,
} from '../../domain/types';
import {
  FOOD_BASIS_LABEL_KEYS,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABEL_KEYS,
  FOOD_SOURCE_LABEL_KEYS,
} from '../../domain/constants';
import { createId } from '../../domain/id';
import { withZhCnName } from '../../domain/localizedText';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

interface FoodEditorModalProps {
  open: boolean;
  food: Food | null;
  onClose: () => void;
}

interface ServingRow {
  key: string;
  label: string;
  amount: string;
  unit: AmountUnit;
}

interface FieldErrors {
  name?: string;
  nutrition?: string;
  servings?: string;
  form?: string;
}

const BASIS_OPTIONS: FoodBasis[] = ['raw', 'dry', 'as_sold'];

function makeServingRows(food: Food | null): ServingRow[] {
  return (food?.servings ?? []).map((serving) => ({
    key: createId('serving-row'),
    label: serving.label,
    amount: String(serving.amount),
    unit: serving.unit,
  }));
}

export function FoodEditorModal({
  open,
  food,
  onClose,
}: FoodEditorModalProps) {
  const { t } = useI18n();
  const { actions, isSaving } = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('protein');
  const [basis, setBasis] = useState<FoodBasis>('raw');
  const [nutritionUnit, setNutritionUnit] = useState<AmountUnit>('g');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servings, setServings] = useState<ServingRow[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialUnit: AmountUnit = !food
      ? 'g'
      : food.nutritionPer100g
        ? food.defaultUnit === 'ml' && food.nutritionPer100ml
          ? 'ml'
          : 'g'
        : 'ml';
    const nutrition =
      initialUnit === 'ml'
        ? food?.nutritionPer100ml
        : food?.nutritionPer100g;
    setName(food?.names['zh-CN'] ?? '');
    setCategory(food?.category ?? 'protein');
    setBasis(food?.basis ?? 'raw');
    setNutritionUnit(initialUnit);
    setKcal(nutrition ? String(nutrition.kcal) : '');
    setProtein(nutrition ? String(nutrition.proteinG) : '');
    setCarbs(nutrition ? String(nutrition.carbsG) : '');
    setFat(nutrition ? String(nutrition.fatG) : '');
    setServings(makeServingRows(food));
    setErrors({});
    setSubmitting(false);
    setConfirmDelete(false);
    setDeleting(false);
    setDeleteError(null);
  }, [open, food]);

  const title = food ? t('foodEditor.titleEdit') : t('foodEditor.titleAdd');
  const sourceLabel = food
    ? t(FOOD_SOURCE_LABEL_KEYS[food.source])
    : null;
  const description = food
    ? t('foodEditor.descriptionEdit', { source: sourceLabel ?? '' })
    : t('foodEditor.descriptionAdd');

  const switchNutritionUnit = (nextUnit: AmountUnit) => {
    if (nextUnit === nutritionUnit) {
      return;
    }
    const reference =
      nextUnit === 'ml'
        ? food?.nutritionPer100ml
        : food?.nutritionPer100g;
    setNutritionUnit(nextUnit);
    if (!food) {
      setServings((current) =>
        current.map((serving) => ({ ...serving, unit: nextUnit })),
      );
    }
    setKcal(reference ? String(reference.kcal) : '');
    setProtein(reference ? String(reference.proteinG) : '');
    setCarbs(reference ? String(reference.carbsG) : '');
    setFat(reference ? String(reference.fatG) : '');
    setErrors((current) => ({
      ...current,
      nutrition: undefined,
    }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!name.trim()) {
      next.name = t('foodEditor.nameRequired');
    } else if (name.trim().length > 80) {
      next.name = t('foodEditor.nameTooLong');
    }

    const numericFields = [
      { labelKey: 'common.calories' as const, value: kcal },
      { labelKey: 'common.protein' as const, value: protein },
      { labelKey: 'common.carbs' as const, value: carbs },
      { labelKey: 'common.fat' as const, value: fat },
    ];

    for (const field of numericFields) {
      const parsed = Number(field.value);
      if (
        field.value.trim() === '' ||
        !Number.isFinite(parsed) ||
        parsed < 0
      ) {
        next.nutrition = t('foodEditor.invalidNutrition', {
          field: t(field.labelKey),
        });
        break;
      }
    }

    for (const serving of servings) {
      if (!serving.label.trim()) {
        next.servings = t('foodEditor.servingNameRequired');
        break;
      }
      const amountValue = Number(serving.amount);
      if (
        serving.amount.trim() === '' ||
        !Number.isFinite(amountValue) ||
        amountValue <= 0
      ) {
        next.servings = t('foodEditor.servingAmountRequired');
        break;
      }
    }

    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const nutrition = {
      kcal: Number(kcal),
      proteinG: Number(protein),
      carbsG: Number(carbs),
      fatG: Number(fat),
    };
    const draft = {
      names: withZhCnName(food?.names, name),
      category,
      basis,
      defaultUnit: nutritionUnit,
      ...(nutritionUnit === 'g'
        ? { nutritionPer100g: nutrition }
        : { nutritionPer100ml: nutrition }),
      servings: servings.map((serving) => ({
        label: serving.label.trim(),
        amount: Number(serving.amount),
        unit: serving.unit,
      })),
    };

    setSubmitting(true);
    try {
      if (food) {
        await actions.updateFood(food.id, draft);
      } else {
        await actions.createFood(draft);
      }
      onClose();
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : t('foodEditor.saveFailed'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!food) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await actions.deleteFood(food.id);
      onClose();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : t('foodEditor.deleteFailed'),
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!submitting && !deleting && !isSaving) {
      onClose();
    }
  };

  const servingUnits = (['g', 'ml'] as const).filter(
    (unit) =>
      nutritionUnit === unit ||
      (unit === 'g' && food?.nutritionPer100g) ||
      (unit === 'ml' && food?.nutritionPer100ml),
  );

  const updateServing = (
    key: string,
    field: 'label' | 'amount' | 'unit',
    value: string,
  ) => {
    setServings((current) =>
      current.map((serving) =>
        serving.key === key ? { ...serving, [field]: value } : serving,
      ),
    );
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={submitting || deleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="food-editor-form"
            loading={submitting}
            disabled={deleting}
          >
            {food ? t('foodEditor.saveEdit') : t('foodEditor.add')}
          </Button>
        </>
      }
    >
      <form
        id="food-editor-form"
        className="food-editor"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="food-editor__top">
          <label className="field field--grow">
            <span className="field-label">{t('foodEditor.name')}</span>
            <input
              type="text"
              value={name}
              maxLength={80}
              placeholder={t('foodEditor.namePlaceholder')}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              autoFocus
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
            <span className="field-hint">{t('foodEditor.nameHint')}</span>
          </label>

          {sourceLabel && (
            <span className="source-badge">{sourceLabel}</span>
          )}
        </div>

        <fieldset className="form-section form-section--plain">
          <legend className="field-label">{t('foodEditor.category')}</legend>
          <div className="filter-chips">
            {FOOD_CATEGORIES.map((item) => (
              <button
                type="button"
                key={item}
                className={`filter-chip ${
                  category === item ? 'is-active' : ''
                }`}
                onClick={() => setCategory(item)}
              >
                {t(FOOD_CATEGORY_LABEL_KEYS[item])}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="form-section form-section--plain">
          <legend className="field-label">{t('foodEditor.basis')}</legend>
          <div
            className="segmented segmented--wide"
            role="group"
            aria-label={t('foodEditor.basis')}
          >
            {BASIS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                className={`segmented__option ${
                  basis === option ? 'is-active' : ''
                }`}
                aria-pressed={basis === option}
                onClick={() => setBasis(option)}
              >
                {t(FOOD_BASIS_LABEL_KEYS[option])}
              </button>
            ))}
          </div>
          <p className="field-hint">{t('foodEditor.basisHint')}</p>
        </fieldset>

        <fieldset className="form-section form-section--plain">
          <legend className="field-label">
            {t('foodEditor.nutritionUnit')}
          </legend>
          <div
            className="segmented segmented--wide"
            role="group"
            aria-label={t('foodEditor.nutritionUnit')}
          >
            {(['g', 'ml'] as const).map((option) => (
              <button
                type="button"
                key={option}
                className={`segmented__option ${
                  nutritionUnit === option ? 'is-active' : ''
                }`}
                aria-pressed={nutritionUnit === option}
                onClick={() => switchNutritionUnit(option)}
              >
                {option === 'g'
                  ? t('foodEditor.unitG')
                  : t('foodEditor.unitMl')}
              </button>
            ))}
          </div>
          <p className="field-hint">
            {t('foodEditor.nutritionUnitHint')}
          </p>
        </fieldset>

        <fieldset className="form-section form-section--plain">
          <legend className="field-label">
            {nutritionUnit === 'ml'
              ? t('foodEditor.per100Ml')
              : t('foodEditor.per100')}
          </legend>
          <div className="nutrition-input-grid">
            <label className="field">
              <span>{t('common.calories')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={kcal}
                  placeholder="0"
                  onChange={(event) => {
                    setKcal(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      nutrition: undefined,
                    }));
                  }}
                />
                <span>{t('common.kcal')}</span>
              </span>
            </label>
            <label className="field">
              <span>{t('common.protein')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={protein}
                  placeholder="0"
                  onChange={(event) => {
                    setProtein(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      nutrition: undefined,
                    }));
                  }}
                />
                <span>{t('common.gram')}</span>
              </span>
            </label>
            <label className="field">
              <span>{t('common.carbs')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={carbs}
                  placeholder="0"
                  onChange={(event) => {
                    setCarbs(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      nutrition: undefined,
                    }));
                  }}
                />
                <span>{t('common.gram')}</span>
              </span>
            </label>
            <label className="field">
              <span>{t('common.fat')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={fat}
                  placeholder="0"
                  onChange={(event) => {
                    setFat(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      nutrition: undefined,
                    }));
                  }}
                />
                <span>{t('common.gram')}</span>
              </span>
            </label>
          </div>
          {errors.nutrition && (
            <p className="field-error">{errors.nutrition}</p>
          )}
        </fieldset>

        <fieldset className="form-section form-section--plain">
          <div className="form-section__title-row">
            <legend className="field-label">
              {t('foodEditor.servings')}
            </legend>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setServings((current) => [
                  ...current,
                  {
                    key: createId('serving-row'),
                    label: '',
                    amount: '',
                    unit: servingUnits.includes(nutritionUnit)
                      ? nutritionUnit
                      : servingUnits[0] ?? 'g',
                  },
                ]);
                setErrors((current) => ({
                  ...current,
                  servings: undefined,
                }));
              }}
            >
              <Plus size={15} aria-hidden="true" />
              {t('foodEditor.addServing')}
            </button>
          </div>
          <p className="field-hint">{t('foodEditor.servingHint')}</p>
          {servings.length > 0 && (
            <div className="serving-editor">
              {servings.map((serving) => (
                <div className="serving-editor__row" key={serving.key}>
                  <input
                    type="text"
                    value={serving.label}
                    placeholder={t('foodEditor.servingNamePlaceholder')}
                    maxLength={24}
                    onChange={(event) =>
                      updateServing(serving.key, 'label', event.target.value)
                    }
                    aria-label={t('foodEditor.servingNameAria')}
                  />
                  <span className="serving-editor__times">=</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={serving.amount}
                    placeholder={t('foodEditor.servingAmountPlaceholder')}
                    onChange={(event) =>
                      updateServing(serving.key, 'amount', event.target.value)
                    }
                    aria-label={t('foodEditor.servingAmountAria')}
                  />
                  {servingUnits.length > 1 ? (
                    <select
                      className="serving-editor__unit-select"
                      value={serving.unit}
                      onChange={(event) =>
                        updateServing(
                          serving.key,
                          'unit',
                          event.target.value as AmountUnit,
                        )
                      }
                      aria-label={t('foodEditor.servingUnitAria')}
                    >
                      {servingUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="serving-editor__unit">
                      {serving.unit}
                    </span>
                  )}
                  <button
                    type="button"
                    className="icon-button icon-button--muted"
                    onClick={() =>
                      setServings((current) =>
                        current.filter((item) => item.key !== serving.key),
                      )
                    }
                    aria-label={t('foodEditor.deleteServingAria')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {errors.servings && (
            <p className="field-error">{errors.servings}</p>
          )}
        </fieldset>

        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}

        {food && (
          <div className="entry-delete-zone food-editor__danger">
            {!confirmDelete ? (
              <button
                type="button"
                className="text-button text-button--danger"
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
              >
                <Trash2 size={15} aria-hidden="true" />
                {t('foodEditor.deleteFood')}
              </button>
            ) : (
              <div className="delete-confirm">
                <p>{t('foodEditor.deleteConfirm')}</p>
                {deleteError && (
                  <p className="form-error" role="alert">
                    {deleteError}
                  </p>
                )}
                <div className="delete-confirm__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deleting}
                    onClick={() => void handleDelete()}
                  >
                    {t('foodEditor.confirmDelete')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
