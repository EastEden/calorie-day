import { ChevronRight, Plus } from 'lucide-react';
import type { FoodEntry, MealSummary, MealType } from '../../domain/types';
import { MEAL_META } from '../../domain/constants';
import {
  formatDecimal,
  formatEntryAmount,
  formatKcal,
} from '../../domain/formatters';
import { useI18n } from '../../i18n';
import { MealIcon } from '../../ui/MealIcon';

interface MealCardProps {
  mealType: MealType;
  entries: FoodEntry[];
  summary: MealSummary;
  disabled: boolean;
  onAdd: () => void;
  onEdit: (entry: FoodEntry) => void;
}

export function MealCard({
  mealType,
  entries,
  summary,
  disabled,
  onAdd,
  onEdit,
}: MealCardProps) {
  const { t } = useI18n();
  const meta = MEAL_META[mealType];
  const mealLabel = t(meta.labelKey);
  const hasEntries = entries.length > 0;

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
              aria-label={t('meals.editAria', { name: entry.foodName })}
            >
              <span className="entry-row__main">
                <span className="entry-row__name">{entry.foodName}</span>
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
