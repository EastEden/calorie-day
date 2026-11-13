import type { DaySummary, IsoDate } from '../../domain/types';
import { formatKcal } from '../../domain/formatters';
import { isToday } from '../../domain/dates';

interface CalorieHeroProps {
  summary: DaySummary;
  date: IsoDate;
}

export function CalorieHero({ summary, date }: CalorieHeroProps) {
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
          {isToday(date) ? '今日已摄入' : '当日已摄入'}
          <span className="calorie-hero__dot" aria-hidden="true" />
          {summary.entryCount > 0 ? `${summary.entryCount} 项食物` : '等待第一笔记录'}
        </div>

        <div className="calorie-hero__number">
          <strong>{formatKcal(summary.totals.kcal)}</strong>
          <span>kcal</span>
        </div>

        <div className="calorie-hero__target">
          {target
            ? `推荐目标 ${formatKcal(target.kcal)} kcal`
            : '完善个人资料后生成推荐目标'}
        </div>

        {target && remaining !== null && (
          <div
            className={`calorie-hero__remaining ${
              remaining < 0 ? 'is-over' : ''
            }`}
          >
            {remaining >= 0
              ? `还可摄入 ${formatKcal(remaining)} kcal`
              : `已超出 ${formatKcal(Math.abs(remaining))} kcal`}
          </div>
        )}
      </div>

      {target && (
        <div className="calorie-hero__ring" aria-label={`目标完成 ${progress}%`}>
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
            <span>目标</span>
          </div>
        </div>
      )}
    </section>
  );
}
