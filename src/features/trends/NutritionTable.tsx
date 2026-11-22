import { formatDecimal, formatKcal } from '../../domain/formatters';
import { formatMonthDay, formatWeekday } from '../../domain/dates';
import type { TrendDayPoint } from '../../domain/trends';
import { useI18n } from '../../i18n';

interface NutritionTableProps {
  points: TrendDayPoint[];
}

const EMPTY = '—';

export function NutritionTable({ points }: NutritionTableProps) {
  const { t } = useI18n();

  return (
    <div className="trend-table-wrap">
      <table className="trend-table" aria-label={t('trends.tableAria')}>
        <caption className="trend-table__caption">
          {t('trends.tableTitle')}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t('trends.colDate')}</th>
            <th scope="col">{t('trends.colCalories')}</th>
            <th scope="col">{t('trends.colCarbs')}</th>
            <th scope="col">{t('trends.colProtein')}</th>
            <th scope="col">{t('trends.colFat')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => {
            const hasData = point.hasEntries;
            const overTarget =
              point.target !== null &&
              point.totals.kcal > point.target.kcal;
            return (
              <tr
                key={point.date}
                className={point.isToday ? 'is-today' : undefined}
              >
                <th scope="row">
                  <span className="trend-table__date">
                    {formatMonthDay(point.date)}
                  </span>
                  <small>
                    {formatWeekday(point.date)}
                    {point.isToday && (
                      <em>{t('trends.today')}</em>
                    )}
                  </small>
                </th>
                <td>
                  {hasData ? (
                    <span className="trend-table__calories">
                      <strong>{formatKcal(point.totals.kcal)}</strong>
                      {point.target && (
                        <small>
                          / {formatKcal(point.target.kcal)}
                        </small>
                      )}
                      {overTarget && (
                        <em className="trend-table__status">
                          {t('trends.overTarget')}
                        </em>
                      )}
                    </span>
                  ) : (
                    EMPTY
                  )}
                </td>
                <td>{hasData ? `${formatDecimal(point.totals.carbsG)}g` : EMPTY}</td>
                <td>{hasData ? `${formatDecimal(point.totals.proteinG)}g` : EMPTY}</td>
                <td>{hasData ? `${formatDecimal(point.totals.fatG)}g` : EMPTY}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
