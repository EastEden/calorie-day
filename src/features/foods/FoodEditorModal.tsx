import {
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react';
import {
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  Food,
  FoodBasis,
  FoodCategory,
  Nutrition,
} from '../../domain/types';
import {
  FOOD_BASIS_LABEL_KEYS,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABEL_KEYS,
  FOOD_SOURCE_LABEL_KEYS,
} from '../../domain/constants';
import { formatDecimal } from '../../domain/formatters';
import { createId } from '../../domain/id';
import { withZhCnName } from '../../domain/localizedText';
import {
  normalizeNutritionToPer100g,
  scaleNutritionFromPer100g,
} from '../../domain/nutrition';
import { nutritionSchema } from '../../domain/schemas';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

interface FoodEditorModalProps {
  open: boolean;
  food: Food | null;
  onClose: () => void;
}

type NutritionInputMode = 'per100g' | 'perServing';

interface NutritionDraft {
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

interface ServingRow {
  key: string;
  label: string;
  grams: string;
}

interface FieldErrors {
  name?: string;
  referenceGrams?: string;
  nutrition?: string;
  servings?: string;
  form?: string;
}

const BASIS_OPTIONS: FoodBasis[] = ['raw', 'dry', 'as_sold'];
const MAX_REFERENCE_GRAMS = 10_000;
const EMPTY_NUTRITION_DRAFT: NutritionDraft = {
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
};

function parseDecimalInput(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

function nutritionToDraft(nutrition: Nutrition): NutritionDraft {
  return {
    kcal: String(nutrition.kcal),
    protein: String(nutrition.proteinG),
    carbs: String(nutrition.carbsG),
    fat: String(nutrition.fatG),
  };
}

function isEmptyNutritionDraft(draft: NutritionDraft): boolean {
  return (
    draft.kcal.trim() === '' &&
    draft.protein.trim() === '' &&
    draft.carbs.trim() === '' &&
    draft.fat.trim() === ''
  );
}

function parseNutritionDraft(draft: NutritionDraft): Nutrition | null {
  if (
    draft.kcal.trim() === '' ||
    draft.protein.trim() === '' ||
    draft.carbs.trim() === '' ||
    draft.fat.trim() === ''
  ) {
    return null;
  }
  const candidate: Nutrition = {
    kcal: parseDecimalInput(draft.kcal),
    proteinG: parseDecimalInput(draft.protein),
    carbsG: parseDecimalInput(draft.carbs),
    fatG: parseDecimalInput(draft.fat),
  };
  if (
    !Number.isFinite(candidate.kcal) ||
    candidate.kcal < 0 ||
    !Number.isFinite(candidate.proteinG) ||
    candidate.proteinG < 0 ||
    !Number.isFinite(candidate.carbsG) ||
    candidate.carbsG < 0 ||
    !Number.isFinite(candidate.fatG) ||
    candidate.fatG < 0
  ) {
    return null;
  }
  return candidate;
}

function makeServingRows(food: Food | null): ServingRow[] {
  return (food?.servings ?? []).map((serving) => ({
    key: createId('serving-row'),
    label: serving.label,
    grams: String(serving.grams),
  }));
}

export function FoodEditorModal({
  open,
  food,
  onClose,
}: FoodEditorModalProps) {
  const { t } = useI18n();
  const { actions, isSaving } = useApp();
  const nutritionLabelId = useId();
  const servingsLabelId = useId();
  const isCreateMode = food === null;
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('protein');
  const [basis, setBasis] = useState<FoodBasis>('raw');
  const [nutritionMode, setNutritionMode] =
    useState<NutritionInputMode>('per100g');
  const [referenceGrams, setReferenceGrams] = useState('');
  const [per100gDraft, setPer100gDraft] = useState<NutritionDraft>(
    EMPTY_NUTRITION_DRAFT,
  );
  const [perServingDraft, setPerServingDraft] = useState<NutritionDraft>(
    EMPTY_NUTRITION_DRAFT,
  );
  const [lastEditedMode, setLastEditedMode] =
    useState<NutritionInputMode | null>(null);
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

    setName(food?.names['zh-CN'] ?? '');
    setCategory(food?.category ?? 'protein');
    setBasis(food?.basis ?? 'raw');
    setNutritionMode('per100g');
    setReferenceGrams('');
    setPer100gDraft(
      food ? nutritionToDraft(food.nutritionPer100g) : EMPTY_NUTRITION_DRAFT,
    );
    setPerServingDraft(EMPTY_NUTRITION_DRAFT);
    setLastEditedMode(null);
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

  const activeMode: NutritionInputMode = isCreateMode
    ? nutritionMode
    : 'per100g';
  const activeDraft =
    activeMode === 'perServing' ? perServingDraft : per100gDraft;

  const parsedReferenceGrams =
    referenceGrams.trim() === ''
      ? Number.NaN
      : parseDecimalInput(referenceGrams);
  const hasValidReferenceGrams =
    Number.isFinite(parsedReferenceGrams) &&
    parsedReferenceGrams > 0 &&
    parsedReferenceGrams <= MAX_REFERENCE_GRAMS;

  const parsedEnteredNutrition = parseNutritionDraft(activeDraft);

  const convertedPreview: Nutrition | null = (() => {
    if (
      activeMode !== 'perServing' ||
      !hasValidReferenceGrams ||
      !parsedEnteredNutrition
    ) {
      return null;
    }
    const candidate = normalizeNutritionToPer100g(
      parsedEnteredNutrition,
      parsedReferenceGrams,
    );
    return nutritionSchema.safeParse(candidate).success ? candidate : null;
  })();

  const nutritionLegend =
    activeMode === 'perServing'
      ? hasValidReferenceGrams
        ? t('foodEditor.perServingWithGrams', {
            grams: formatDecimal(parsedReferenceGrams),
          })
        : t('foodEditor.perServing')
      : t('foodEditor.per100');

  const updateNutritionField = (
    field: keyof NutritionDraft,
    value: string,
  ) => {
    if (activeMode === 'perServing') {
      setPerServingDraft((current) => ({ ...current, [field]: value }));
      setLastEditedMode('perServing');
    } else {
      setPer100gDraft((current) => ({ ...current, [field]: value }));
      setLastEditedMode('per100g');
    }
    setErrors((current) => ({
      ...current,
      nutrition: undefined,
    }));
  };

  const switchNutritionMode = (nextMode: NutritionInputMode) => {
    if (!isCreateMode || nextMode === nutritionMode) {
      return;
    }

    if (nextMode === 'per100g') {
      const servingNutrition = parseNutritionDraft(perServingDraft);
      if (
        hasValidReferenceGrams &&
        servingNutrition &&
        (lastEditedMode === 'perServing' || isEmptyNutritionDraft(per100gDraft))
      ) {
        const converted = normalizeNutritionToPer100g(
          servingNutrition,
          parsedReferenceGrams,
        );
        if (nutritionSchema.safeParse(converted).success) {
          setPer100gDraft(nutritionToDraft(converted));
          setLastEditedMode(null);
        }
      }
    } else {
      const per100gNutrition = parseNutritionDraft(per100gDraft);
      if (
        hasValidReferenceGrams &&
        per100gNutrition &&
        (lastEditedMode === 'per100g' || isEmptyNutritionDraft(perServingDraft))
      ) {
        const converted = scaleNutritionFromPer100g(
          per100gNutrition,
          parsedReferenceGrams,
        );
        if (nutritionSchema.safeParse(converted).success) {
          setPerServingDraft(nutritionToDraft(converted));
          setLastEditedMode(null);
        }
      }
    }

    setNutritionMode(nextMode);
    setErrors((current) => ({
      ...current,
      referenceGrams: undefined,
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

    if (activeMode === 'perServing' && !hasValidReferenceGrams) {
      next.referenceGrams = t('foodEditor.referenceGramsRequired');
    }

    const numericFields = [
      { labelKey: 'common.calories' as const, value: activeDraft.kcal },
      { labelKey: 'common.protein' as const, value: activeDraft.protein },
      { labelKey: 'common.carbs' as const, value: activeDraft.carbs },
      { labelKey: 'common.fat' as const, value: activeDraft.fat },
    ];

    for (const field of numericFields) {
      const parsed = parseDecimalInput(field.value);
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

    if (!next.nutrition && parsedEnteredNutrition) {
      const candidatePer100g =
        activeMode === 'perServing'
          ? hasValidReferenceGrams
            ? normalizeNutritionToPer100g(
                parsedEnteredNutrition,
                parsedReferenceGrams,
              )
            : null
          : parsedEnteredNutrition;
      if (
        candidatePer100g &&
        !nutritionSchema.safeParse(candidatePer100g).success
      ) {
        next.nutrition = t('foodEditor.convertedOutOfRange');
      }
    }

    for (const serving of servings) {
      if (!serving.label.trim()) {
        next.servings = t('foodEditor.servingNameRequired');
        break;
      }
      const gramsValue = parseDecimalInput(serving.grams);
      if (
        serving.grams.trim() === '' ||
        !Number.isFinite(gramsValue) ||
        gramsValue <= 0
      ) {
        next.servings = t('foodEditor.servingGramsRequired');
        break;
      }
    }

    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !parsedEnteredNutrition) {
      return;
    }

    const nutritionPer100g =
      activeMode === 'perServing'
        ? normalizeNutritionToPer100g(
            parsedEnteredNutrition,
            parsedReferenceGrams,
          )
        : parsedEnteredNutrition;

    const draft = {
      names: withZhCnName(food?.names, name),
      category,
      basis,
      nutritionPer100g,
      servings: servings.map((serving) => ({
        label: serving.label.trim(),
        grams: parseDecimalInput(serving.grams),
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

  const updateServing = (
    key: string,
    field: 'label' | 'grams',
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

        <div
          className="form-section form-section--plain"
          role="group"
          aria-labelledby={nutritionLabelId}
        >
          <div className="form-section__title-row">
            <span id={nutritionLabelId} className="field-label">
              {nutritionLegend}
            </span>
            {isCreateMode && (
              <div
                className="segmented food-editor__mode-toggle"
                role="group"
                aria-label={t('foodEditor.nutritionModeAria')}
              >
                {(['per100g', 'perServing'] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    className={`segmented__option ${
                      activeMode === mode ? 'is-active' : ''
                    }`}
                    aria-pressed={activeMode === mode}
                    onClick={() => switchNutritionMode(mode)}
                  >
                    {mode === 'per100g'
                      ? t('foodEditor.modePer100g')
                      : t('foodEditor.modePerServing')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isCreateMode && (
            <p className="field-hint">{t('foodEditor.modeSwitchHint')}</p>
          )}

          {activeMode === 'perServing' && (
            <label className="field food-editor__reference-field">
              <span>{t('foodEditor.referenceGrams')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={MAX_REFERENCE_GRAMS}
                  step="any"
                  value={referenceGrams}
                  placeholder={t('foodEditor.referenceGramsPlaceholder')}
                  onChange={(event) => {
                    setReferenceGrams(event.target.value);
                    setLastEditedMode('perServing');
                    setErrors((current) => ({
                      ...current,
                      referenceGrams: undefined,
                      nutrition: undefined,
                    }));
                  }}
                />
                <span>{t('common.gram')}</span>
              </span>
              {errors.referenceGrams && (
                <span className="field-error">{errors.referenceGrams}</span>
              )}
            </label>
          )}

          <div className="nutrition-input-grid">
            <label className="field">
              <span>{t('common.calories')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={activeDraft.kcal}
                  placeholder="0"
                  onChange={(event) =>
                    updateNutritionField('kcal', event.target.value)
                  }
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
                  value={activeDraft.protein}
                  placeholder="0"
                  onChange={(event) =>
                    updateNutritionField('protein', event.target.value)
                  }
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
                  value={activeDraft.carbs}
                  placeholder="0"
                  onChange={(event) =>
                    updateNutritionField('carbs', event.target.value)
                  }
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
                  value={activeDraft.fat}
                  placeholder="0"
                  onChange={(event) =>
                    updateNutritionField('fat', event.target.value)
                  }
                />
                <span>{t('common.gram')}</span>
              </span>
            </label>
          </div>
          {convertedPreview && (
            <div
              className="food-editor__converted-preview"
              aria-live="polite"
            >
              <span>{t('foodEditor.convertedPreviewLabel')}</span>
              <strong>
                {formatDecimal(convertedPreview.kcal)} {t('common.kcal')}
              </strong>
              <small>
                {t('common.carbs')} {formatDecimal(convertedPreview.carbsG)}
                {t('common.gram')} · {t('common.proteinShort')}{' '}
                {formatDecimal(convertedPreview.proteinG)}
                {t('common.gram')} · {t('common.fat')}{' '}
                {formatDecimal(convertedPreview.fatG)}
                {t('common.gram')}
              </small>
            </div>
          )}
          {errors.nutrition && (
            <p className="field-error">{errors.nutrition}</p>
          )}
        </div>

        <div
          className="form-section form-section--plain"
          role="group"
          aria-labelledby={servingsLabelId}
        >
          <div className="form-section__title-row">
            <span id={servingsLabelId} className="field-label">
              {t('foodEditor.servings')}
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setServings((current) => [
                  ...current,
                  { key: createId('serving-row'), label: '', grams: '' },
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
                    value={serving.grams}
                    placeholder={t('foodEditor.servingGramsPlaceholder')}
                    onChange={(event) =>
                      updateServing(serving.key, 'grams', event.target.value)
                    }
                    aria-label={t('foodEditor.servingGramsAria')}
                  />
                  <span className="serving-editor__unit">
                    {t('common.gram')}
                  </span>
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
        </div>

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
