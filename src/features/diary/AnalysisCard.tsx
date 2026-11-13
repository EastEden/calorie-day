import { Share2 } from 'lucide-react';
import type { DaySummary } from '../../domain/types';
import { formatDecimal, formatKcal, formatPercent } from '../../domain/formatters';
import { MACRO_COLORS, MacroDonut } from '../../ui/MacroDonut';

interface AnalysisCardProps {
  summary: DaySummary;
  onShare: () => void;
  shareDisabled: boolean;
}

export function AnalysisCard({
  summary,
  onShare,
  shareDisabled,
}: AnalysisCardProps) {
  const macro = summary.macroEnergy;
  const hasEntries = summary.entryCount > 0;

  const legend = [
    {
      label: '碳水',
      grams: summary.totals.carbsG,
      percent: macro.carbsPercent,
      color: MACRO_COLORS.carbs,
    },
    {
      label: '蛋白质',
      grams: summary.totals.proteinG,
      percent: macro.proteinPercent,
      color: MACRO_COLORS.protein,
    },
    {
      label: '脂肪',
      grams: summary.totals.fatG,
      percent: macro.fatPercent,
      color: MACRO_COLORS.fat,
    },
  ];

  return (
    <section className="analysis-card" aria-labelledby="analysis-title">
      <div className="analysis-card__header">
        <div>
          <p className="eyebrow">今日结构</p>
          <h2 id="analysis-title">营养分布</h2>
        </div>
        <span className="analysis-card__formula">4 / 4 / 9</span>
      </div>

      <div className="analysis-card__body">
        <MacroDonut
          macroEnergy={macro}
          size={154}
          stroke={15}
          centerValue={hasEntries ? formatKcal(summary.totals.kcal) : '—'}
          centerLabel="kcal"
        />

        <div className="analysis-legend">
          {legend.map((item) => (
            <div className="analysis-legend__row" key={item.label}>
              <span
                className="analysis-legend__dot"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="analysis-legend__name">{item.label}</span>
              <span className="analysis-legend__grams">
                {formatDecimal(item.grams)}g
              </span>
              <strong className="analysis-legend__percent">
                {hasEntries ? formatPercent(item.percent) : '—'}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="analysis-card__footer">
        <p>按蛋白质 4、碳水 4、脂肪 9 kcal/g 计算供能占比。</p>
        <button
          type="button"
          className="text-button text-button--with-icon"
          onClick={onShare}
          disabled={shareDisabled}
        >
          <Share2 size={15} aria-hidden="true" />
          分享今日营养
        </button>
      </div>
    </section>
  );
}
