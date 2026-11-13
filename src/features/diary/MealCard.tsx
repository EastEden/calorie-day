import { ChevronRight, Plus } from 'lucide-react';
import type { FoodEntry, MealSummary, MealType } from '../../domain/types';
import { MEAL_META } from '../../domain/constants';
import {
  formatDecimal,
  formatEntryAmount,
  formatKcal,
} from '../../domain/formatters';
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
  const meta = MEAL_META[mealType];
  const hasEntries = entries.length > 0;

  return (
    <article className={`meal-card meal-card--${mealType}`}>
      <header className="meal-card__header">
        <div className="meal-card__icon" aria-hidden="true">
          <MealIcon mealType={mealType} />
        </div>

        <div className="meal-card__title">
          <h3>{meta.label}</h3>
          <p>{meta.subtitle}</p>
        </div>

        <div className="meal-card__kcal">
          <strong>{formatKcal(summary.totals.kcal)}</strong>
          <span>kcal</span>
        </div>

        <button
          type="button"
          className="meal-card__add"
          onClick={onAdd}
          disabled={disabled}
          aria-label={`添加${meta.label}`}
        >
          <Plus size={15} aria-hidden="true" />
          添加
        </button>
      </header>

      {hasEntries && (
        <div className="meal-card__macros" aria-label={`${meta.label}营养小计`}>
          <span>碳水 {formatDecimal(summary.totals.carbsG)}g</span>
          <span>蛋白 {formatDecimal(summary.totals.proteinG)}g</span>
          <span>脂肪 {formatDecimal(summary.totals.fatG)}g</span>
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
              aria-label={`编辑 ${entry.foodName}`}
            >
              <span className="entry-row__main">
                <span className="entry-row__name">{entry.foodName}</span>
                <span className="entry-row__amount">
                  {formatEntryAmount(entry)}
                </span>
              </span>
              <span className="entry-row__energy">
                {formatKcal((entry.nutritionPer100gSnapshot.kcal * entry.amountGrams) / 100)}
                <small>kcal</small>
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
              <strong>{meta.emptyHint}</strong>
              <small>点击添加第一项食物</small>
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
