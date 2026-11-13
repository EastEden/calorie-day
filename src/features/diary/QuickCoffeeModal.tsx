import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Coffee } from 'lucide-react';
import { formatDecimal, formatKcal } from '../../domain/formatters';
import { nowIsoTimestamp } from '../../domain/dates';
import { scaleNutrition } from '../../domain/nutrition';
import {
  EMPTY_QUICK_COFFEE_SELECTION,
  QUICK_COFFEE_ADDONS,
  QUICK_COFFEE_BASE_NUTRITION,
  buildQuickCoffee,
  type QuickCoffeeAddonKey,
  type QuickCoffeeSelection,
} from '../../domain/quickCoffee';
import type { Food } from '../../domain/types';
import type { TranslationKey } from '../../i18n';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

interface QuickCoffeeModalProps {
  open: boolean;
  onClose: () => void;
}

const ADDON_LABEL_KEYS: Record<QuickCoffeeAddonKey, TranslationKey> = {
  milk: 'quickCoffee.milk',
  sugar: 'quickCoffee.sugar',
  sweetener: 'quickCoffee.sweetener',
  cream: 'quickCoffee.cream',
};

export function QuickCoffeeModal({
  open,
  onClose,
}: QuickCoffeeModalProps) {
  const { t } = useI18n();
  const { actions, isSaving } = useApp();
  const [selection, setSelection] = useState<QuickCoffeeSelection>(
    EMPTY_QUICK_COFFEE_SELECTION,
  );
  const [submitting, setSubmitting] = useState(false);

  const mealLabel = t('meals.breakfast.label');
  const result = buildQuickCoffee(selection);
  const selectedAddons = QUICK_COFFEE_ADDONS.filter(
    (addon) => selection[addon.key],
  );
  const addonLabels = selectedAddons.map((addon) =>
    t(ADDON_LABEL_KEYS[addon.key]),
  );
  const displayName =
    addonLabels.length > 0
      ? t('quickCoffee.nameWithAddons', {
          addons: addonLabels.join(t('quickCoffee.separator')),
        })
      : t('quickCoffee.blackName');
  const isBusy = submitting || isSaving;

  useEffect(() => {
    if (open) {
      setSelection({ ...EMPTY_QUICK_COFFEE_SELECTION });
      setSubmitting(false);
    }
  }, [open]);

  const toggleAddon = (key: QuickCoffeeAddonKey) => {
    setSelection((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    const now = nowIsoTimestamp();
    const per100g = scaleNutrition(
      result.nutrition,
      100 / result.grams,
    );
    const food: Food = {
      id: 'quick-coffee',
      names: { 'zh-CN': displayName },
      category: 'other',
      basis: 'as_sold',
      nutritionPer100g: per100g,
      servings: [],
      source: 'custom',
      createdAt: now,
      updatedAt: now,
    };

    setSubmitting(true);
    try {
      const ok = await actions.addEntry('breakfast', food, {
        grams: result.grams,
        enteredQuantity: 1,
        enteredUnit: 'serving',
        servingLabel: t('quickCoffee.cup'),
        servingGrams: result.grams,
      });
      if (ok) {
        onClose();
      }
    } catch {
      // The app-level action surfaces storage errors as toasts.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      title={t('quickCoffee.title')}
      description={t('quickCoffee.description', { meal: mealLabel })}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isBusy}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="quick-coffee-form"
            loading={submitting}
            disabled={isSaving || submitting}
          >
            {t('quickCoffee.submit', { meal: mealLabel })}
          </Button>
        </>
      }
    >
      <form
        id="quick-coffee-form"
        className="quick-coffee"
        onSubmit={handleSubmit}
      >
        <div className="quick-coffee__base">
          <span className="quick-coffee__base-icon" aria-hidden="true">
            <Coffee size={19} />
          </span>
          <div>
            <strong>{t('quickCoffee.base')}</strong>
            <small>
              {t('quickCoffee.baseDetail', {
                kcal: formatKcal(QUICK_COFFEE_BASE_NUTRITION.kcal),
              })}
            </small>
          </div>
        </div>

        <div className="field">
          <span className="field-label">
            {t('quickCoffee.addons')}
          </span>
          <div className="quick-coffee__options">
            {QUICK_COFFEE_ADDONS.map((addon) => (
              <label
                className={`check-row quick-coffee__option ${
                  selection[addon.key] ? 'is-selected' : ''
                }`}
                key={addon.key}
              >
                <input
                  type="checkbox"
                  checked={selection[addon.key]}
                  onChange={() => toggleAddon(addon.key)}
                  disabled={isBusy}
                />
                <span>
                  <strong>{t(ADDON_LABEL_KEYS[addon.key])}</strong>
                  <small>
                    {t('quickCoffee.optionDetail', {
                      grams: formatDecimal(addon.grams),
                      kcal: formatKcal(addon.nutrition.kcal),
                    })}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <p className="field-hint">{t('quickCoffee.portionHint')}</p>
        </div>

        <div className="portion-preview">
          <div className="portion-preview__energy">
            <span>{t('quickCoffee.preview')}</span>
            <strong>{formatKcal(result.nutrition.kcal)}</strong>
            <small>
              {t('quickCoffee.previewDetail', {
                grams: formatDecimal(result.grams),
                carbs: formatDecimal(result.nutrition.carbsG),
                protein: formatDecimal(result.nutrition.proteinG),
                fat: formatDecimal(result.nutrition.fatG),
              })}
            </small>
          </div>
        </div>
      </form>
    </Modal>
  );
}
