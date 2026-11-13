import type { CSSProperties } from 'react';
import { Drumstick, Droplet, Wheat } from 'lucide-react';
import type { DaySummary } from '../../domain/types';
import { formatDecimal, formatPercent } from '../../domain/formatters';
import { MACRO_COLORS } from '../../ui/MacroDonut';
import { ProgressBar } from '../../ui/ProgressBar';

interface MacroOverviewProps {
  summary: DaySummary;
}

export function MacroOverview({ summary }: MacroOverviewProps) {
  const target = summary.target;
  const macros = [
    {
      key: 'carbs',
      label: '碳水化合物',
      shortLabel: '碳水',
      value: summary.totals.carbsG,
      target: target?.carbsG ?? null,
      color: MACRO_COLORS.carbs,
      icon: Wheat,
    },
    {
      key: 'protein',
      label: '蛋白质',
      shortLabel: '蛋白',
      value: summary.totals.proteinG,
      target: target?.proteinG ?? null,
      color: MACRO_COLORS.protein,
      icon: Drumstick,
    },
    {
      key: 'fat',
      label: '脂肪',
      shortLabel: '脂肪',
      value: summary.totals.fatG,
      target: target?.fatG ?? null,
      color: MACRO_COLORS.fat,
      icon: Droplet,
    },
  ];

  return (
    <section className="macro-overview" aria-labelledby="macro-title">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">每日营养</p>
          <h2 id="macro-title">三大营养素</h2>
        </div>
        <span className="section-heading__hint">摄入 / 推荐</span>
      </div>

      <div className="macro-grid">
        {macros.map((macro) => {
          const Icon = macro.icon;
          const percent =
            macro.target && macro.target > 0
              ? (macro.value / macro.target) * 100
              : 0;
          const style = {
            '--macro-color': macro.color,
          } as CSSProperties;

          return (
            <article className="macro-card" key={macro.key} style={style}>
              <div className="macro-card__top">
                <span className="macro-card__icon" aria-hidden="true">
                  <Icon size={17} strokeWidth={1.9} />
                </span>
                <span className="macro-card__label">{macro.shortLabel}</span>
                <span className="macro-card__percent">
                  {macro.target ? formatPercent(percent) : '—'}
                </span>
              </div>
              <div className="macro-card__value">
                <strong>{formatDecimal(macro.value)}</strong>
                <span>
                  {macro.target
                    ? ` / ${formatDecimal(macro.target)} g`
                    : ' g'}
                </span>
              </div>
              <ProgressBar
                value={macro.value}
                target={macro.target ?? 0}
                color={macro.color}
                ariaLabel={`${macro.label}进度`}
                className="macro-card__progress"
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
