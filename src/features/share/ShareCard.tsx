import type {
  DailyLog,
  DaySummary,
  FoodEntry,
  IsoDate,
  MealType,
} from '../../domain/types';
import { MEAL_META, MEAL_TYPES } from '../../domain/constants';
import {
  formatDecimal,
  formatKcal,
} from '../../domain/formatters';
import { formatLongDate, isToday } from '../../domain/dates';
import { getEntryNutrition } from '../../domain/nutrition';
import { MACRO_COLORS } from '../../ui/MacroDonut';
import { MealIcon } from '../../ui/MealIcon';

interface ShareCardProps {
  summary: DaySummary;
  log: DailyLog;
  date: IsoDate;
}

function formatShareAmount(entry: FoodEntry): string {
  if (entry.enteredUnit === 'serving' && entry.servingLabel) {
    return `${formatDecimal(entry.enteredQuantity)} ${entry.servingLabel} · ${formatDecimal(
      entry.amountGrams,
    )}g`;
  }
  return `${formatDecimal(entry.amountGrams)}g`;
}

function ShareMeal({
  mealType,
  summary,
  entries,
}: {
  mealType: MealType;
  summary: DaySummary;
  entries: FoodEntry[];
}) {
  const meta = MEAL_META[mealType];
  const mealSummary = summary.byMeal[mealType];

  return (
    <section className="share-meal">
      <div className="share-meal__header">
        <div className="share-meal__name">
          <span className={`share-meal__icon share-meal__icon--${mealType}`}>
            <MealIcon mealType={mealType} size={15} />
          </span>
          <strong>{meta.label}</strong>
        </div>
        <div className="share-meal__kcal">
          <strong>{formatKcal(mealSummary.totals.kcal)}</strong>
          <span> kcal</span>
        </div>
      </div>

      {entries.length > 0 ? (
        <>
          <div className="share-meal__macros">
            <span>碳水 {formatDecimal(mealSummary.totals.carbsG)}g</span>
            <span>蛋白 {formatDecimal(mealSummary.totals.proteinG)}g</span>
            <span>脂肪 {formatDecimal(mealSummary.totals.fatG)}g</span>
          </div>
          <div className="share-meal__entries">
            {entries.map((entry) => (
              <div className="share-entry" key={entry.id}>
                <span className="share-entry__name">{entry.foodName}</span>
                <span className="share-entry__amount">
                  {formatShareAmount(entry)}
                </span>
                <strong className="share-entry__kcal">
                  {formatKcal(getEntryNutrition(entry).kcal)}
                  <small> kcal</small>
                </strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="share-meal__empty">这一餐还没有记录</p>
      )}
    </section>
  );
}

export function ShareCard({ summary, log, date }: ShareCardProps) {
  const target = summary.target;
  const progress = target
    ? Math.min(100, Math.max(0, summary.calorieProgress))
    : 0;
  const remaining = summary.remainingKcal;
  const hasEntries = summary.entryCount > 0;

  return (
    <div className="share-card">
      <header className="share-card__header">
        <div>
          <span className="share-card__kicker">DAILY NUTRITION</span>
          <h1>{isToday(date) ? '今日营养' : '当日营养'}</h1>
        </div>
        <span className="share-card__date">{formatLongDate(date)}</span>
      </header>

      <section className="share-hero">
        <div className="share-hero__top">
          <span>已摄入</span>
          {target && <span>推荐 {formatKcal(target.kcal)} kcal</span>}
        </div>
        <div className="share-hero__number">
          <strong>{formatKcal(summary.totals.kcal)}</strong>
          <span>kcal</span>
        </div>
        {target && (
          <>
            <div className="share-hero__progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="share-hero__bottom">
              <span>
                {remaining !== null && remaining < 0
                  ? `已超出 ${formatKcal(Math.abs(remaining))} kcal`
                  : `还可摄入 ${formatKcal(remaining ?? 0)} kcal`}
              </span>
              <strong>{Math.round(summary.calorieProgress)}%</strong>
            </div>
          </>
        )}
      </section>

      <section className="share-macros" aria-label="三大营养素">
        {[
          {
            key: 'carbs',
            label: '碳水',
            value: summary.totals.carbsG,
            target: target?.carbsG ?? 0,
            color: MACRO_COLORS.carbs,
          },
          {
            key: 'protein',
            label: '蛋白质',
            value: summary.totals.proteinG,
            target: target?.proteinG ?? 0,
            color: MACRO_COLORS.protein,
          },
          {
            key: 'fat',
            label: '脂肪',
            value: summary.totals.fatG,
            target: target?.fatG ?? 0,
            color: MACRO_COLORS.fat,
          },
        ].map((macro) => {
          const percent =
            macro.target > 0
              ? Math.min(100, (macro.value / macro.target) * 100)
              : 0;
          return (
            <div className="share-macro" key={macro.key}>
              <div className="share-macro__label">
                <span
                  className="share-macro__dot"
                  style={{ backgroundColor: macro.color }}
                />
                {macro.label}
              </div>
              <div className="share-macro__value">
                <strong>{formatDecimal(macro.value)}</strong>
                <span> / {formatDecimal(macro.target)}g</span>
              </div>
              <div className="share-macro__track">
                <span
                  style={{
                    width: `${percent}%`,
                    backgroundColor: macro.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </section>

      <section className="share-energy" aria-label="宏量供能占比">
        <div className="share-section-title">
          <h2>宏量供能</h2>
          <span>4 / 4 / 9</span>
        </div>
        <div className="share-energy__bar">
          <span
            style={{
              width: `${summary.macroEnergy.carbsPercent}%`,
              backgroundColor: MACRO_COLORS.carbs,
            }}
          />
          <span
            style={{
              width: `${summary.macroEnergy.proteinPercent}%`,
              backgroundColor: MACRO_COLORS.protein,
            }}
          />
          <span
            style={{
              width: `${summary.macroEnergy.fatPercent}%`,
              backgroundColor: MACRO_COLORS.fat,
            }}
          />
        </div>
        <div className="share-energy__labels">
          <span>
            碳水 {hasEntries ? `${Math.round(summary.macroEnergy.carbsPercent)}%` : '—'}
          </span>
          <span>
            蛋白 {hasEntries ? `${Math.round(summary.macroEnergy.proteinPercent)}%` : '—'}
          </span>
          <span>
            脂肪 {hasEntries ? `${Math.round(summary.macroEnergy.fatPercent)}%` : '—'}
          </span>
        </div>
      </section>

      <section className="share-meals">
        <div className="share-section-title share-section-title--meals">
          <h2>餐食明细</h2>
          <span>{summary.entryCount} 项记录</span>
        </div>

        {MEAL_TYPES.map((mealType) => (
          <ShareMeal
            key={mealType}
            mealType={mealType}
            summary={summary}
            entries={log.meals[mealType]}
          />
        ))}
      </section>
    </div>
  );
}
