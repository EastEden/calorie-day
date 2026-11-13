import type { DaySummary, IsoDate } from '../../domain/types';
import { formatKcal } from '../../domain/formatters';
import { isToday } from '../../domain/dates';
import { useI18n } from '../../i18n';

interface CalorieHeroProps {
  summary: DaySummary;
  date: IsoDate;
}

export function CalorieHero({ summary, date }: CalorieHeroProps) {
  const { t } = useI18n();
  const target = summary.target;
  const remaining = summary.remainingKcal;
  const progress = target ? Math.round(summary.calorieProgress) : 0;
  const ringPercent = Math.min(100, Math.max(0, summary.calorieProgress));
  const ringColor = remaining !== null && remaining < 0 ? '#ffb39a' : '#f2b36b';
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  return (
    <section className="calorie-hero" aria-labelledby="calorie-hero-title">
      <div className="calorie-hero__glow" aria-hidden="true" />
      <div className="calorie-hero__content">
        <div className="calorie-hero__eyebrow" id="calorie-hero-title">
          {isToday(date) ? t('diary.intakeToday') : t('diary.intakeSelected')}
          <span className="calorie-hero__dot" aria-hidden="true" />
          {summary.entryCount > 0
            ? t('common.foodCount', { n: summary.entryCount })
            : t('diary.waitingFirst')}
        </div>

        <div className="calorie-hero__number">
          <strong>{formatKcal(summary.totals.kcal)}</strong>
          <span>{t('common.kcal')}</span>
        </div>

        <div className="calorie-hero__target">
          {target
            ? t('diary.target', { kcal: formatKcal(target.kcal) })
            : t('diary.targetMissing')}
        </div>

        {target && remaining !== null && (
          <div
            className={`calorie-hero__remaining ${
              remaining < 0 ? 'is-over' : ''
            }`}
          >
            {remaining >= 0
              ? t('diary.remaining', { kcal: formatKcal(remaining) })
              : t('diary.over', { kcal: formatKcal(Math.abs(remaining)) })}
          </div>
        )}
      </div>

      {target && (
        <div
          className="calorie-hero__ring"
          aria-label={t('diary.progressAria', { percent: progress })}
        >
          <svg viewBox="0 0 112 112" aria-hidden="true">
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="9"
            />
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${(ringPercent / 100) * circumference} ${circumference}`}
              transform="rotate(-90 56 56)"
            />
          </svg>
          <div className="calorie-hero__ring-label">
            <strong>{progress}%</strong>
            <span>{t('diary.goal')}</span>
          </div>
        </div>
      )}
    </section>
  );
}
