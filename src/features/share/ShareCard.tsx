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
import {
  getEntryDisplayName,
  resolveLocalizedText,
} from '../../domain/localizedText';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { MACRO_COLORS } from '../../ui/MacroDonut';
import { MealIcon } from '../../ui/MealIcon';

interface ShareCardProps {
  summary: DaySummary;
  log: DailyLog;
  date: IsoDate;
}

function formatShareAmount(entry: FoodEntry, gramUnit: string): string {
  if (entry.enteredUnit === 'serving' && entry.servingLabel) {
    return `${formatDecimal(entry.enteredQuantity)} ${entry.servingLabel} · ${formatDecimal(
      entry.amountGrams,
    )}${gramUnit}`;
  }
  return `${formatDecimal(entry.amountGrams)}${gramUnit}`;
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
  const { t, locale } = useI18n();
  const { foods } = useApp();
  const meta = MEAL_META[mealType];
  const mealSummary = summary.byMeal[mealType];
  const gramUnit = t('common.gram');

  const getComponentList = (entry: FoodEntry): string | null => {
    const components =
      entry.batchComponents ??
      foods.find((food) => food.id === entry.foodId)?.batch
        ?.components;
    if (!components || components.length === 0) {
      return null;
    }
    return components
      .map((component) =>
        resolveLocalizedText(component.names, locale),
      )
      .join('、');
  };

  return (
    <section className="share-meal">
      <div className="share-meal__header">
        <div className="share-meal__name">
          <span className={`share-meal__icon share-meal__icon--${mealType}`}>
            <MealIcon mealType={mealType} size={15} />
          </span>
          <strong>{t(meta.labelKey)}</strong>
        </div>
        <div className="share-meal__kcal">
          <strong>{formatKcal(mealSummary.totals.kcal)}</strong>
          <span> {t('common.kcal')}</span>
        </div>
      </div>

      {entries.length > 0 ? (
        <>
          <div className="share-meal__macros">
            <span>
              {t('common.carbs')} {formatDecimal(mealSummary.totals.carbsG)}
              {gramUnit}
            </span>
            <span>
              {t('common.proteinShort')}{' '}
              {formatDecimal(mealSummary.totals.proteinG)}
              {gramUnit}
            </span>
            <span>
              {t('common.fat')} {formatDecimal(mealSummary.totals.fatG)}
              {gramUnit}
            </span>
          </div>
          <div className="share-meal__entries">
            {entries.map((entry) => {
              const componentList = getComponentList(entry);
              return (
              <div className="share-entry" key={entry.id}>
                <span className="share-entry__name">
                  {getEntryDisplayName(entry, locale)}
                  {componentList && (
                    <small className="share-entry__components">
                      （{componentList}）
                    </small>
                  )}
                </span>
                <span className="share-entry__amount">
                  {formatShareAmount(entry, gramUnit)}
                </span>
                <strong className="share-entry__kcal">
                  {formatKcal(getEntryNutrition(entry).kcal)}
                  <small> {t('common.kcal')}</small>
                </strong>
              </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="share-meal__empty">{t('share.emptyMeal')}</p>
      )}
    </section>
  );
}

export function ShareCard({ summary, log, date }: ShareCardProps) {
  const { t } = useI18n();
  const target = summary.target;
  const progress = target
    ? Math.min(100, Math.max(0, summary.calorieProgress))
    : 0;
  const remaining = summary.remainingKcal;
  const hasEntries = summary.entryCount > 0;
  const gramUnit = t('common.gram');

  const macroCards = [
    {
      key: 'carbs',
      label: t('common.carbs'),
      value: summary.totals.carbsG,
      target: target?.carbsG ?? 0,
      color: MACRO_COLORS.carbs,
    },
    {
      key: 'protein',
      label: t('common.protein'),
      value: summary.totals.proteinG,
      target: target?.proteinG ?? 0,
      color: MACRO_COLORS.protein,
    },
    {
      key: 'fat',
      label: t('common.fat'),
      value: summary.totals.fatG,
      target: target?.fatG ?? 0,
      color: MACRO_COLORS.fat,
    },
  ];

  return (
    <div className="share-card">
      <header className="share-card__header">
        <div>
          <span className="share-card__kicker">{t('share.kicker')}</span>
          <h1>
            {isToday(date)
              ? t('share.cardTitleToday')
              : t('share.cardTitleSelected')}
          </h1>
        </div>
        <span className="share-card__date">{formatLongDate(date)}</span>
      </header>

      <section className="share-hero">
        <div className="share-hero__top">
          <span>{t('share.consumed')}</span>
          {target && (
            <span>
              {t('share.recommended', {
                kcal: formatKcal(target.kcal),
              })}
            </span>
          )}
        </div>
        <div className="share-hero__number">
          <strong>{formatKcal(summary.totals.kcal)}</strong>
          <span>{t('common.kcal')}</span>
        </div>
        {target && (
          <>
            <div className="share-hero__progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="share-hero__bottom">
              <span>
                {remaining !== null && remaining < 0
                  ? t('share.over', {
                      kcal: formatKcal(Math.abs(remaining)),
                    })
                  : t('share.remaining', {
                      kcal: formatKcal(remaining ?? 0),
                    })}
              </span>
              <strong>{Math.round(summary.calorieProgress)}%</strong>
            </div>
          </>
        )}
      </section>

      <section className="share-macros" aria-label={t('share.macroAria')}>
        {macroCards.map((macro) => {
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
                <span>
                  {' '}
                  / {formatDecimal(macro.target)}
                  {gramUnit}
                </span>
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

      <section className="share-energy" aria-label={t('share.energyTitle')}>
        <div className="share-section-title">
          <h2>{t('share.energyTitle')}</h2>
          <span>{t('share.energyFormula')}</span>
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
            {t('share.energyCarbs', {
              percent: hasEntries
                ? Math.round(summary.macroEnergy.carbsPercent)
                : t('common.notAvailable'),
            })}
          </span>
          <span>
            {t('share.energyProtein', {
              percent: hasEntries
                ? Math.round(summary.macroEnergy.proteinPercent)
                : t('common.notAvailable'),
            })}
          </span>
          <span>
            {t('share.energyFat', {
              percent: hasEntries
                ? Math.round(summary.macroEnergy.fatPercent)
                : t('common.notAvailable'),
            })}
          </span>
        </div>
      </section>

      <section className="share-meals">
        <div className="share-section-title share-section-title--meals">
          <h2>{t('share.mealDetails')}</h2>
          <span>{t('share.recordsCount', { n: summary.entryCount })}</span>
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
