import { Share2 } from 'lucide-react';
import type { DaySummary } from '../../domain/types';
import {
  formatDecimal,
  formatKcal,
  formatPercent,
} from '../../domain/formatters';
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();
  const macro = summary.macroEnergy;
  const hasEntries = summary.entryCount > 0;

  const legend = [
    {
      labelKey: 'common.carbs' as const,
      grams: summary.totals.carbsG,
      percent: macro.carbsPercent,
      color: MACRO_COLORS.carbs,
    },
    {
      labelKey: 'common.protein' as const,
      grams: summary.totals.proteinG,
      percent: macro.proteinPercent,
      color: MACRO_COLORS.protein,
    },
    {
      labelKey: 'common.fat' as const,
      grams: summary.totals.fatG,
      percent: macro.fatPercent,
      color: MACRO_COLORS.fat,
    },
  ];

  return (
    <section className="analysis-card" aria-labelledby="analysis-title">
      <div className="analysis-card__header">
        <div>
          <p className="eyebrow">{t('diary.analysisEyebrow')}</p>
          <h2 id="analysis-title">{t('diary.analysisTitle')}</h2>
        </div>
        <span className="analysis-card__formula">
          {t('diary.analysisFormula')}
        </span>
      </div>

      <div className="analysis-card__body">
        <MacroDonut
          macroEnergy={macro}
          size={154}
          stroke={15}
          centerValue={
            hasEntries
              ? formatKcal(summary.totals.kcal)
              : t('common.notAvailable')
          }
          centerLabel={t('common.kcal')}
        />

        <div className="analysis-legend">
          {legend.map((item) => (
            <div className="analysis-legend__row" key={item.labelKey}>
              <span
                className="analysis-legend__dot"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="analysis-legend__name">
                {t(item.labelKey)}
              </span>
              <span className="analysis-legend__grams">
                {formatDecimal(item.grams)}
                {t('common.gram')}
              </span>
              <strong className="analysis-legend__percent">
                {hasEntries
                  ? formatPercent(item.percent)
                  : t('common.notAvailable')}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="analysis-card__footer">
        <p>{t('diary.analysisNote')}</p>
        <button
          type="button"
          className="text-button text-button--with-icon"
          onClick={onShare}
          disabled={shareDisabled}
        >
          <Share2 size={15} aria-hidden="true" />
          {t('diary.shareCta')}
        </button>
      </div>
    </section>
  );
}
