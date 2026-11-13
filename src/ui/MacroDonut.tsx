import type { MacroEnergyBreakdown } from '../domain/types';
import { useI18n } from '../i18n';

export const MACRO_COLORS = {
  protein: '#d97757',
  carbs: '#d9a03f',
  fat: '#5c88a8',
} as const;

interface MacroDonutProps {
  macroEnergy: MacroEnergyBreakdown;
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

export function MacroDonut({
  macroEnergy,
  size = 170,
  stroke = 17,
  centerLabel,
  centerValue,
  className = '',
}: MacroDonutProps) {
  const { t } = useI18n();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const hasData = macroEnergy.totalKcal > 0;

  let offset = 0;
  const segments = [
    {
      key: 'carbs',
      percent: macroEnergy.carbsPercent,
      color: MACRO_COLORS.carbs,
    },
    {
      key: 'protein',
      percent: macroEnergy.proteinPercent,
      color: MACRO_COLORS.protein,
    },
    {
      key: 'fat',
      percent: macroEnergy.fatPercent,
      color: MACRO_COLORS.fat,
    },
  ].map((segment) => {
    const dash = (segment.percent / 100) * circumference;
    const segmentOffset = (offset / 100) * circumference;
    offset += segment.percent;
    return { ...segment, dash, segmentOffset };
  });

  return (
    <div
      className={`macro-donut ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        hasData
          ? t('macro.donutAria', {
              carbs: Math.round(macroEnergy.carbsPercent),
              protein: Math.round(macroEnergy.proteinPercent),
              fat: Math.round(macroEnergy.fatPercent),
            })
          : t('macro.donutEmpty')
      }
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#ece7db"
          strokeWidth={stroke}
        />
        {hasData &&
          segments.map((segment) =>
            segment.dash > 0 ? (
              <circle
                key={segment.key}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
                strokeDashoffset={-segment.segmentOffset}
                transform={`rotate(-90 ${center} ${center})`}
              />
            ) : null,
          )}
      </svg>
      <div className="macro-donut__center">
        {centerValue && <strong>{centerValue}</strong>}
        <span>{centerLabel ?? t('macro.centerLabel')}</span>
      </div>
    </div>
  );
}
