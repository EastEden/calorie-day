import type { CSSProperties } from 'react';
import { Drumstick, Droplet, Wheat } from 'lucide-react';
import type { DaySummary } from '../../domain/types';
import { formatDecimal, formatPercent } from '../../domain/formatters';
import { useI18n } from '../../i18n';
import { MACRO_COLORS } from '../../ui/MacroDonut';
import { ProgressBar } from '../../ui/ProgressBar';

interface MacroOverviewProps {
  summary: DaySummary;
}

export function MacroOverview({ summary }: MacroOverviewProps) {
  const { t } = useI18n();
  const target = summary.target;
  const macros = [
    {
      key: 'carbs',
      labelKey: 'common.carbohydrates' as const,
      shortLabelKey: 'common.carbs' as const,
      value: summary.totals.carbsG,
      target: target?.carbsG ?? null,
      color: MACRO_COLORS.carbs,
      icon: Wheat,
    },
    {
      key: 'protein',
      labelKey: 'common.protein' as const,
      shortLabelKey: 'common.proteinShort' as const,
      value: summary.totals.proteinG,
      target: target?.proteinG ?? null,
      color: MACRO_COLORS.protein,
      icon: Drumstick,
    },
    {
      key: 'fat',
      labelKey: 'common.fat' as const,
      shortLabelKey: 'common.fat' as const,
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
          <p className="eyebrow">{t('macro.daily')}</p>
          <h2 id="macro-title">{t('macro.title')}</h2>
        </div>
        <span className="section-heading__hint">{t('macro.targetLegend')}</span>
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
                <span className="macro-card__label">
                  {t(macro.shortLabelKey)}
                </span>
                <span className="macro-card__percent">
                  {macro.target ? formatPercent(percent) : t('common.notAvailable')}
                </span>
              </div>
              <div className="macro-card__value">
                <strong>{formatDecimal(macro.value)}</strong>
                <span>
                  {macro.target
                    ? ` / ${formatDecimal(macro.target)} ${t('common.gram')}`
                    : ` ${t('common.gram')}`}
                </span>
              </div>
              <ProgressBar
                value={macro.value}
                target={macro.target ?? 0}
                color={macro.color}
                ariaLabel={t('macro.progressAria', {
                  label: t(macro.labelKey),
                })}
                className="macro-card__progress"
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
