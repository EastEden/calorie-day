import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  addDays,
  formatSavedAt,
  formatShortDate,
  formatWeekday,
  getTodayIso,
  isToday,
} from '../../domain/dates';
import { useApp } from '../../state/AppContext';

export function DayToolbar() {
  const {
    selectedDate,
    isSaving,
    lastSavedAt,
    isLogLoading,
    actions,
  } = useApp();
  const today = getTodayIso();
  const onToday = isToday(selectedDate, today);
  const isAtLatest = selectedDate >= today;
  const navigationDisabled = isSaving || isLogLoading;

  return (
    <div className="day-toolbar">
      <div className="day-toolbar__nav">
        <button
          type="button"
          className="icon-button day-toolbar__arrow"
          onClick={() => actions.selectDate(addDays(selectedDate, -1))}
          disabled={navigationDisabled}
          aria-label="前一天"
        >
          <ChevronLeft size={20} />
        </button>

        <label className="date-picker">
          <span className="date-picker__icon">
            <CalendarDays size={18} aria-hidden="true" />
          </span>
          <span className="date-picker__text">
            <strong>{onToday ? '今天' : formatShortDate(selectedDate)}</strong>
            <small>
              {onToday
                ? formatShortDate(selectedDate)
                : formatWeekday(selectedDate)}
            </small>
          </span>
          <input
            className="date-picker__input"
            type="date"
            value={selectedDate}
            max={today}
            disabled={navigationDisabled}
            onChange={(event) => {
              if (event.target.value) {
                actions.selectDate(event.target.value);
              }
            }}
            aria-label="选择要查看的日期"
          />
        </label>

        <button
          type="button"
          className="icon-button day-toolbar__arrow"
          onClick={() => actions.selectDate(addDays(selectedDate, 1))}
          disabled={navigationDisabled || isAtLatest}
          aria-label="后一天"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="day-toolbar__meta">
        {!onToday && (
          <button
            type="button"
            className="text-button"
            onClick={() => actions.selectDate(today)}
            disabled={navigationDisabled}
          >
            回到今天
          </button>
        )}
        <span className="save-state" aria-live="polite">
          {isSaving
            ? '保存中…'
            : lastSavedAt
              ? `已保存 · ${formatSavedAt(new Date(lastSavedAt).toISOString())}`
              : '本地自动保存'}
        </span>
      </div>
    </div>
  );
}
