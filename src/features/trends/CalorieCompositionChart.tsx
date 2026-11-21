import {
  formatKcal,
} from '../../domain/formatters';
import { formatMonthDay, formatWeekday } from '../../domain/dates';
import { getMacroEnergy } from '../../domain/nutrition';
import type { TrendDayPoint, TrendRangeDays } from '../../domain/trends';
import { useI18n } from '../../i18n';

interface CalorieCompositionChartProps {
  points: TrendDayPoint[];
  rangeDays: TrendRangeDays;
}

const CHART_WIDTH = 360;
const CHART_HEIGHT = 220;
const PADDING = { top: 18, right: 8, bottom: 34, left: 34 };
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

interface ChartBar {
  x: number;
  width: number;
  totalKcal: number;
  targetKcal: number | null;
  isOverTarget: boolean;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
}

function createBars(
  points: TrendDayPoint[],
  rangeDays: TrendRangeDays,
): ChartBar[] {
  const slotWidth = PLOT_WIDTH / points.length;
  const barWidth = Math.min(rangeDays === 7 ? 28 : 14, slotWidth * 0.62);

  return points.map((point, index) => {
    const macro = getMacroEnergy(point.totals);
    const macroTotal = macro.totalKcal;
    const scale =
      macroTotal > 0 ? point.totals.kcal / macroTotal : 0;
    const center = PADDING.left + slotWidth * (index + 0.5);
    return {
      x: center - barWidth / 2,
      width: barWidth,
      totalKcal: point.totals.kcal,
      targetKcal: point.target?.kcal ?? null,
      isOverTarget:
        point.target !== null && point.totals.kcal > point.target.kcal,
      proteinKcal: macro.proteinKcal * scale,
      carbsKcal: macro.carbsKcal * scale,
      fatKcal: macro.fatKcal * scale,
    };
  });
}

function getAxisMax(points: TrendDayPoint[]): number {
  const values = points.flatMap((point) => {
    const result = [point.totals.kcal];
    if (point.target) {
      result.push(point.target.kcal);
    }
    return result;
  });
  const max = Math.max(1, ...values);
  return Math.ceil((max * 1.12) / 100) * 100;
}

function getGridValues(max: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
    Math.round(max * ratio),
  );
}

function getDateLabel(
  point: TrendDayPoint,
  index: number,
  rangeDays: TrendRangeDays,
  total: number,
): string | null {
  if (rangeDays === 7) {
    return formatWeekday(point.date);
  }
  if (index === 0 || index === total - 1 || index % 5 === 0) {
    return formatMonthDay(point.date);
  }
  return null;
}

export function CalorieCompositionChart({
  points,
  rangeDays,
}: CalorieCompositionChartProps) {
  const { t } = useI18n();
  const bars = createBars(points, rangeDays);
  const axisMax = getAxisMax(points);
  const gridValues = getGridValues(axisMax);

  const yFor = (value: number) =>
    PADDING.top + PLOT_HEIGHT - (value / axisMax) * PLOT_HEIGHT;

  const targetPolyline = points
    .map((point, index) => {
      if (!point.target) {
        return null;
      }
      const slotWidth = PLOT_WIDTH / points.length;
      const center = PADDING.left + slotWidth * (index + 0.5);
      return `${center},${yFor(point.target.kcal)}`;
    })
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    <div className="trend-chart">
      <div className="trend-chart__legend" aria-hidden="true">
        <span><i className="trend-chart__swatch trend-chart__swatch--carbs" />{t('common.carbs')}</span>
        <span><i className="trend-chart__swatch trend-chart__swatch--protein" />{t('common.protein')}</span>
        <span><i className="trend-chart__swatch trend-chart__swatch--fat" />{t('common.fat')}</span>
        <span><i className="trend-chart__swatch trend-chart__swatch--target" />{t('trends.target')}</span>
      </div>

      <svg
        className="trend-chart__svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={t('trends.chartAria')}
      >
        <title>{t('trends.chartAria')}</title>

        {gridValues.map((value) => (
          <g key={value}>
            <line
              className="trend-chart__grid-line"
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={yFor(value)}
              y2={yFor(value)}
            />
            <text
              className="trend-chart__axis-label"
              x={PADDING.left - 6}
              y={yFor(value) + 3}
              textAnchor="end"
            >
              {formatKcal(value)}
            </text>
          </g>
        ))}

        {bars.map((bar, index) => {
          const point = points[index];
          if (!point?.hasEntries) {
            return null;
          }

          const bottom = PADDING.top + PLOT_HEIGHT;
          const proteinHeight = (bar.proteinKcal / axisMax) * PLOT_HEIGHT;
          const carbsHeight = (bar.carbsKcal / axisMax) * PLOT_HEIGHT;
          const fatHeight = (bar.fatKcal / axisMax) * PLOT_HEIGHT;
          const carbsY = bottom - carbsHeight;
          const proteinY = carbsY - proteinHeight;
          const fatY = proteinY - fatHeight;

          return (
            <g
              key={point.date}
              className={`trend-chart__bar ${bar.isOverTarget ? 'is-over-target' : ''}`}
            >
              <rect
                className="trend-chart__segment trend-chart__segment--carbs"
                x={bar.x}
                y={carbsY}
                width={bar.width}
                height={carbsHeight}
              />
              <rect
                className="trend-chart__segment trend-chart__segment--protein"
                x={bar.x}
                y={proteinY}
                width={bar.width}
                height={proteinHeight}
              />
              <rect
                className="trend-chart__segment trend-chart__segment--fat"
                x={bar.x}
                y={fatY}
                width={bar.width}
                height={fatHeight}
              />
              {bar.isOverTarget && (
                <rect
                  className="trend-chart__over-outline"
                  x={bar.x - 1}
                  y={fatY - 1}
                  width={bar.width + 2}
                  height={bottom - fatY + 2}
                  rx={3}
                />
              )}
            </g>
          );
        })}

        {targetPolyline && (
          <polyline
            className="trend-chart__target-line"
            points={targetPolyline}
          />
        )}

        {points.map((point, index) => {
          const label = getDateLabel(
            point,
            index,
            rangeDays,
            points.length,
          );
          if (!label) {
            return null;
          }
          const slotWidth = PLOT_WIDTH / points.length;
          return (
            <text
              key={`label-${point.date}`}
              className={`trend-chart__date-label ${
                point.isToday ? 'is-today' : ''
              }`}
              x={PADDING.left + slotWidth * (index + 0.5)}
              y={CHART_HEIGHT - 12}
              textAnchor="middle"
            >
              {point.isToday ? t('trends.today') : label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
