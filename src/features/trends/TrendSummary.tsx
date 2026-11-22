import { formatKcal } from '../../domain/formatters';
import type { TrendData } from '../../domain/trends';
import { useI18n } from '../../i18n';

interface TrendSummaryProps {
  data: TrendData;
}

export function TrendSummary({ data }: TrendSummaryProps) {
  const { t } = useI18n();

  return (
    <section
      className="trend-summary"
      aria-label={t('trends.title')}
    >
      <div className="trend-summary__card">
        <span>{t('trends.averageIntake')}</span>
        <strong>
          {data.averageIntake
            ? `${formatKcal(data.averageIntake.kcal)} ${t('common.kcal')}`
            : t('trends.noAverage')}
        </strong>
        <small>{t('trends.averageHint')}</small>
      </div>
      <div className="trend-summary__card">
        <span>{t('trends.loggedDays')}</span>
        <strong>
          {data.loggedDays} / {data.totalDays}
        </strong>
        <small>{t('trends.rangeDays', { n: data.rangeDays })}</small>
      </div>
      <div className="trend-summary__card">
        <span>{t('trends.withinTarget')}</span>
        <strong>
          {data.completedLoggedDays === 0 ||
          data.averageTargetKcal === null
            ? t('trends.noAverage')
            : `${data.withinTargetDays} / ${data.completedLoggedDays}`}
        </strong>
        <small>{t('trends.withinTargetHint')}</small>
      </div>
    </section>
  );
}
