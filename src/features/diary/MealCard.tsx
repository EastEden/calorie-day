import {
  ChevronRight,
  Coffee,
  Droplet,
  Plus,
} from 'lucide-react';
import type { FoodEntry, MealSummary, MealType } from '../../domain/types';
import { MEAL_META } from '../../domain/constants';
import {
  formatDecimal,
  formatEntryAmount,
  formatKcal,
} from '../../domain/formatters';
import { getEntryDisplayName } from '../../domain/localizedText';
import { useI18n } from '../../i18n';
import { MealIcon } from '../../ui/MealIcon';

interface MealCardProps {
  mealType: MealType;
  entries: FoodEntry[];
  summary: MealSummary;
  disabled: boolean;
  onAdd: () => void;
  onQuickAction: (action: 'coffee' | 'oil') => void;
  onEdit: (entry: FoodEntry) => void;
}

export function MealCard({
  mealType,
  entries,
  summary,
  disabled,
  onAdd,
  onQuickAction,
  onEdit,
}: MealCardProps) {
  const { t, locale } = useI18n();
  const meta = MEAL_META[mealType];
  const mealLabel = t(meta.labelKey);
  const hasEntries = entries.length > 0;
  const quickAction =
    mealType === 'breakfast'
      ? 'coffee'
      : mealType === 'snack'
        ? null
        : 'oil';
  const quickTitle =
    quickAction === 'coffee'
      ? t('quickCoffee.button')
      : t('quickOil.button');
  const quickAria =
    quickAction === 'coffee'
      ? t('quickCoffee.aria', { meal: mealLabel })
      : t('quickOil.aria', { meal: mealLabel });
  const quickShort =
    quickAction === 'coffee'
      ? t('quickCoffee.short')
      : t('quickOil.short');

  return (
    <article className={`meal-card meal-card--${mealType}`}>
      <header className="meal-card__header">
        <div className="meal-card__icon" aria-hidden="true">
          <MealIcon mealType={mealType} />
        </div>

        <div className="meal-card__title">
          <h3>{mealLabel}</h3>
          <p>{t(meta.subtitleKey)}</p>
        </div>

        <div className="meal-card__kcal">
          <strong>{formatKcal(summary.totals.kcal)}</strong>
          <span>{t('common.kcal')}</span>
        </div>

        <div className="meal-card__actions">
          {quickAction && (
            <button
              type="button"
              className={`meal-card__quick meal-card__quick--${quickAction}`}
              onClick={() => onQuickAction(quickAction)}
              disabled={disabled}
              aria-label={quickAria}
              title={quickTitle}
            >
              {quickAction === 'coffee' ? (
                <Coffee size={14} aria-hidden="true" />
              ) : (
                <Droplet size={14} aria-hidden="true" />
              )}
              <span>{quickShort}</span>
            </button>
          )}
          <button
            type="button"
            className="meal-card__add"
            onClick={onAdd}
            disabled={disabled}
            aria-label={t('meals.addAria', { meal: mealLabel })}
          >
            <Plus size={15} aria-hidden="true" />
            {t('common.add')}
          </button>
        </div>
      </header>

      {hasEntries && (
        <div
          className="meal-card__macros"
          aria-label={t('meals.subtotalAria', { meal: mealLabel })}
        >
          <span>
            {t('common.carbs')} {formatDecimal(summary.totals.carbsG)}
            {t('common.gram')}
          </span>
          <span>
            {t('common.proteinShort')}{' '}
            {formatDecimal(summary.totals.proteinG)}
            {t('common.gram')}
          </span>
          <span>
            {t('common.fat')} {formatDecimal(summary.totals.fatG)}
            {t('common.gram')}
          </span>
        </div>
      )}

      <div className="meal-card__entries">
        {hasEntries ? (
          entries.map((entry) => (
            <button
              type="button"
              className="entry-row"
              key={entry.id}
              onClick={() => onEdit(entry)}
              disabled={disabled}
              aria-label={t('meals.editAria', {
                name: getEntryDisplayName(entry, locale),
              })}
            >
              <span className="entry-row__main">
                <span className="entry-row__name">
                  {getEntryDisplayName(entry, locale)}
                </span>
                <span className="entry-row__amount">
                  {formatEntryAmount(entry)}
                </span>
              </span>
              <span className="entry-row__energy">
                {formatKcal(
                  (entry.nutritionPer100gSnapshot.kcal * entry.amountGrams) /
                    100,
                )}
                <small>{t('common.kcal')}</small>
              </span>
              <ChevronRight
                size={16}
                className="entry-row__chevron"
                aria-hidden="true"
              />
            </button>
          ))
        ) : (
          <button
            type="button"
            className="meal-empty"
            onClick={onAdd}
            disabled={disabled}
          >
            <span className="meal-empty__icon">
              <Plus size={17} aria-hidden="true" />
            </span>
            <span>
              <strong>{t(meta.emptyHintKey)}</strong>
              <small>{t('meals.emptyHint')}</small>
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
