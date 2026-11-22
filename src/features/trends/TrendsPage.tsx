import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import {
  addDays,
  formatShortDate,
  getTodayIso,
} from '../../domain/dates';
import {
  buildTrendData,
  type TrendData,
  type TrendDayPoint,
  type TrendRangeDays,
} from '../../domain/trends';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { CalorieCompositionChart } from './CalorieCompositionChart';
import { NutritionTable } from './NutritionTable';
import { TrendDayDialog } from './TrendDayDialog';
import { TrendSummary } from './TrendSummary';

function TrendsSkeleton() {
  return (
    <div className="trends-skeleton" aria-hidden="true">
      <div className="trends-skeleton__summary">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
      <div className="skeleton trends-skeleton__chart" />
      <div className="skeleton trends-skeleton__table" />
    </div>
  );
}

export function TrendsPage() {
  const { t } = useI18n();
  const { actions, targets } = useApp();
  const { loadTrendLogs } = actions;
  const [rangeDays, setRangeDays] = useState<TrendRangeDays>(7);
  const [data, setData] = useState<TrendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<TrendDayPoint | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = getTodayIso();
      const from = addDays(today, -(rangeDays - 1));
      setIsLoading(true);
      setLoadError(null);

      try {
        const logs = await loadTrendLogs(from, today);
        if (cancelled) {
          return;
        }
        setData(
          buildTrendData({
            logs,
            rangeDays,
            from,
            to: today,
            today,
            fallbackTarget: targets,
          }),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        setData(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : t('trends.loadErrorTitle'),
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadTrendLogs, rangeDays, reloadToken, t, targets]);

  const rangeLabel =
    data !== null
      ? `${formatShortDate(data.from)} - ${formatShortDate(data.to)}`
      : '';

  return (
    <div
      className="trends-page page-width"
      aria-busy={isLoading}
    >
      <header className="page-header trends-page__header">
        <div>
          <p className="eyebrow">{t('trends.eyebrow')}</p>
          <h1>{t('trends.title')}</h1>
          <p>{t('trends.description')}</p>
        </div>
        <div className="trends-page__range">
          <div
            className="segmented"
            role="group"
            aria-label={t('trends.rangeAria')}
          >
            {([7, 30] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`segmented__option ${
                  rangeDays === value ? 'is-active' : ''
                }`}
                aria-pressed={rangeDays === value}
                onClick={() => {
                  setSelectedPoint(null);
                  setRangeDays(value);
                }}
              >
                {value === 7 ? t('trends.range7') : t('trends.range30')}
              </button>
            ))}
          </div>
          {rangeLabel && (
            <small className="trends-page__date-range">{rangeLabel}</small>
          )}
        </div>
      </header>

      {data === null && isLoading && <TrendsSkeleton />}

      {!isLoading && loadError && (
        <section className="inline-error" role="alert">
          <div className="inline-error__icon">
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <div>
            <h2>{t('trends.loadErrorTitle')}</h2>
            <p>{loadError}</p>
            <p className="inline-error__hint">{t('trends.loadErrorHint')}</p>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={() => setReloadToken((value) => value + 1)}
            >
              {t('trends.retry')}
            </Button>
          </div>
        </section>
      )}

      {data && !loadError && (
        <>
          <TrendSummary data={data} />

          {data.loggedDays === 0 ? (
            <section className="empty-panel trends-empty" role="status">
              <div className="empty-panel__icon">
                <BarChart3 size={22} aria-hidden="true" />
              </div>
              <h2>{t('trends.emptyTitle')}</h2>
              <p>{t('trends.emptyBody')}</p>
            </section>
          ) : (
            <>
              <section className="trend-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{t('trends.eyebrow')}</p>
                    <h2>{t('trends.chartTitle')}</h2>
                  </div>
                </div>
                <p className="trend-card__hint">{t('trends.chartHint')}</p>
                <CalorieCompositionChart
                  points={data.points}
                  rangeDays={data.rangeDays}
                  onSelectDay={
                    data.rangeDays === 7
                      ? (point) => setSelectedPoint(point)
                      : undefined
                  }
                />
                {data.rangeDays === 7 && (
                  <p className="trend-chart__click-hint">
                    {t('trends.chartClickHint')}
                  </p>
                )}
              </section>

              <section className="trend-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{t('trends.eyebrow')}</p>
                    <h2>{t('trends.tableTitle')}</h2>
                  </div>
                </div>
                <p className="trend-card__hint">{t('trends.tableHint')}</p>
                <NutritionTable points={data.points} />
              </section>
            </>
          )}
        </>
      )}

      <TrendDayDialog
        point={selectedPoint}
        onClose={() => setSelectedPoint(null)}
      />
    </div>
  );
}
