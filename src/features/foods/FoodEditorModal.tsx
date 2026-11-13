import {
  useEffect,
  useMemo,
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
} from '../../domain/types';
import {
  FOOD_BASIS_LABELS,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  FOOD_SOURCE_LABELS,
} from '../../domain/constants';
import { createId } from '../../domain/id';
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
  grams: string;
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
    grams: String(serving.grams),
  }));
}

export function FoodEditorModal({
  open,
  food,
  onClose,
}: FoodEditorModalProps) {
  const { actions, isSaving } = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('protein');
  const [basis, setBasis] = useState<FoodBasis>('raw');
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

    setName(food?.name ?? '');
    setCategory(food?.category ?? 'protein');
    setBasis(food?.basis ?? 'raw');
    setKcal(food ? String(food.nutritionPer100g.kcal) : '');
    setProtein(food ? String(food.nutritionPer100g.proteinG) : '');
    setCarbs(food ? String(food.nutritionPer100g.carbsG) : '');
    setFat(food ? String(food.nutritionPer100g.fatG) : '');
    setServings(makeServingRows(food));
    setErrors({});
    setSubmitting(false);
    setConfirmDelete(false);
    setDeleting(false);
    setDeleteError(null);
  }, [open, food]);

  const title = food ? '编辑食物' : '添加自定义食物';
  const description = food
    ? `${FOOD_SOURCE_LABELS[food.source]}食物 · 修改不会影响已经记录的历史数据`
    : '营养数据按每 100g 填写，保存后可在记录食物时直接使用。';

  const sourceLabel = useMemo(
    () => (food ? FOOD_SOURCE_LABELS[food.source] : null),
    [food],
  );

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!name.trim()) {
      next.name = '请输入食物名称。';
    } else if (name.trim().length > 80) {
      next.name = '食物名称不能超过 80 个字符。';
    }

    const numericFields = [
      { label: '热量', value: kcal },
      { label: '蛋白质', value: protein },
      { label: '碳水', value: carbs },
      { label: '脂肪', value: fat },
    ];

    for (const field of numericFields) {
      const parsed = Number(field.value);
      if (
        field.value.trim() === '' ||
        !Number.isFinite(parsed) ||
        parsed < 0
      ) {
        next.nutrition = `${field.label}必须是非负数字。`;
        break;
      }
    }

    for (const serving of servings) {
      if (!serving.label.trim()) {
        next.servings = '每个常用份量都需要名称。';
        break;
      }
      const gramsValue = Number(serving.grams);
      if (
        serving.grams.trim() === '' ||
        !Number.isFinite(gramsValue) ||
        gramsValue <= 0
      ) {
        next.servings = '常用份量对应的克数必须大于 0。';
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

    const draft = {
      name: name.trim(),
      category,
      basis,
      nutritionPer100g: {
        kcal: Number(kcal),
        proteinG: Number(protein),
        carbsG: Number(carbs),
        fatG: Number(fat),
      },
      servings: servings.map((serving) => ({
        label: serving.label.trim(),
        grams: Number(serving.grams),
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
        form: error instanceof Error ? error.message : '保存失败，请重试。',
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
        error instanceof Error ? error.message : '删除失败，请重试。',
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
          <Button variant="ghost" onClick={handleClose} disabled={submitting || deleting}>
            取消
          </Button>
          <Button
            type="submit"
            form="food-editor-form"
            loading={submitting}
            disabled={deleting}
          >
            {food ? '保存修改' : '添加到食物库'}
          </Button>
        </>
      }
    >
      <form id="food-editor-form" className="food-editor" onSubmit={handleSubmit} noValidate>
        <div className="food-editor__top">
          <label className="field field--grow">
            <span className="field-label">食物名称</span>
            <input
              type="text"
              value={name}
              maxLength={80}
              placeholder="例如：自制鸡胸肉丸"
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              autoFocus
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>

          {sourceLabel && (
            <span className="source-badge">{sourceLabel}</span>
          )}
        </div>

        <fieldset className="form-section form-section--plain">
          <legend className="field-label">分类</legend>
          <div className="filter-chips">
            {FOOD_CATEGORIES.map((item) => (
              <button
                type="button"
                key={item}
                className={`filter-chip ${category === item ? 'is-active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {FOOD_CATEGORY_LABELS[item]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="form-section form-section--plain">
          <legend className="field-label">营养基准</legend>
          <div className="segmented segmented--wide" role="group" aria-label="营养基准">
            {BASIS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                className={`segmented__option ${basis === option ? 'is-active' : ''}`}
                aria-pressed={basis === option}
                onClick={() => setBasis(option)}
              >
                {FOOD_BASIS_LABELS[option]}
              </button>
            ))}
          </div>
          <p className="field-hint">
            第一版统一使用未烹饪基准：生重、干重或商品可食部。
          </p>
        </fieldset>

        <fieldset className="form-section form-section--plain">
          <legend className="field-label">每 100g 营养</legend>
          <div className="nutrition-input-grid">
            <label className="field">
              <span>热量</span>
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
                    setErrors((current) => ({ ...current, nutrition: undefined }));
                  }}
                />
                <span>kcal</span>
              </span>
            </label>
            <label className="field">
              <span>蛋白质</span>
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
                    setErrors((current) => ({ ...current, nutrition: undefined }));
                  }}
                />
                <span>g</span>
              </span>
            </label>
            <label className="field">
              <span>碳水</span>
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
                    setErrors((current) => ({ ...current, nutrition: undefined }));
                  }}
                />
                <span>g</span>
              </span>
            </label>
            <label className="field">
              <span>脂肪</span>
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
                    setErrors((current) => ({ ...current, nutrition: undefined }));
                  }}
                />
                <span>g</span>
              </span>
            </label>
          </div>
          {errors.nutrition && (
            <p className="field-error">{errors.nutrition}</p>
          )}
        </fieldset>

        <fieldset className="form-section form-section--plain">
          <div className="form-section__title-row">
            <legend className="field-label">常用份量（可选）</legend>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setServings((current) => [
                  ...current,
                  { key: createId('serving-row'), label: '', grams: '' },
                ]);
                setErrors((current) => ({ ...current, servings: undefined }));
              }}
            >
              <Plus size={15} aria-hidden="true" />
              添加份量
            </button>
          </div>
          <p className="field-hint">
            例如“个 · 50g”或“杯 · 250g”。记录时可以按份填写，也可以继续按克填写。
          </p>
          {servings.length > 0 && (
            <div className="serving-editor">
              {servings.map((serving) => (
                <div className="serving-editor__row" key={serving.key}>
                  <input
                    type="text"
                    value={serving.label}
                    placeholder="名称，如：个"
                    maxLength={24}
                    onChange={(event) =>
                      updateServing(serving.key, 'label', event.target.value)
                    }
                    aria-label="份量名称"
                  />
                  <span className="serving-editor__times">=</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={serving.grams}
                    placeholder="克数"
                    onChange={(event) =>
                      updateServing(serving.key, 'grams', event.target.value)
                    }
                    aria-label="每份克数"
                  />
                  <span className="serving-editor__unit">g</span>
                  <button
                    type="button"
                    className="icon-button icon-button--muted"
                    onClick={() =>
                      setServings((current) =>
                        current.filter((item) => item.key !== serving.key),
                      )
                    }
                    aria-label="删除这个份量"
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
                删除这个食物
              </button>
            ) : (
              <div className="delete-confirm">
                <p>
                  删除后它会从食物库消失，但已经记录的每日数据不会变化。确定吗？
                </p>
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
                    取消
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deleting}
                    onClick={() => void handleDelete()}
                  >
                    确认删除
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
