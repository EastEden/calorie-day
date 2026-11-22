import { formatDecimal, formatKcal } from '../../domain/formatters';
import { formatShortDate } from '../../domain/dates';
import type { TrendDayPoint } from '../../domain/trends';
import { useI18n } from '../../i18n';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

interface TrendDayDialogProps {
  point: TrendDayPoint | null;
  onClose: () => void;
}

export function TrendDayDialog({ point, onClose }: TrendDayDialogProps) {
  const { t } = useI18n();

  const macroRows = point
    ? [
        {
          key: 'carbs',
          label: t('common.carbs'),
          value: point.totals.carbsG,
          target: point.target?.carbsG,
        },
        {
          key: 'protein',
          label: t('common.protein'),
          value: point.totals.proteinG,
          target: point.target?.proteinG,
        },
        {
          key: 'fat',
          label: t('common.fat'),
          value: point.totals.fatG,
          target: point.target?.fatG,
        },
      ]
    : [];

  return (
    <Modal
      open={point !== null}
      onClose={onClose}
      size="sm"
      title={point ? formatShortDate(point.date) : ''}
      description={point ? t('trends.dialogDescription') : undefined}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {point && (
        <div className="trend-day-dialog">
          <div className="trend-day-dialog__total">
            <span>{t('trends.dialogCalories')}</span>
            <strong>
              {formatKcal(point.totals.kcal)}
              {point.target && (
                <small>
                  {' '}
                  / {formatKcal(point.target.kcal)} {t('common.kcal')}
                </small>
              )}
            </strong>
            <small>
              {t('trends.dialogEntries', { n: point.entryCount })}
            </small>
          </div>

          <div className="trend-day-dialog__macros">
            {macroRows.map((row) => (
              <div
                className="trend-day-dialog__macro"
                key={row.key}
              >
                <span
                  className={`trend-day-dialog__dot trend-day-dialog__dot--${row.key}`}
                  aria-hidden="true"
                />
                <span>{row.label}</span>
                <strong>{formatDecimal(row.value)}g</strong>
                {row.target !== undefined && (
                  <small>/ {formatDecimal(row.target)}g</small>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
