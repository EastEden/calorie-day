import { useState } from 'react';
import {
  Archive,
  Download,
  Upload,
} from 'lucide-react';
import {
  BACKUP_RANGE_PRESETS,
  getBackupDateRange,
  type BackupExportPreset,
} from '../../domain/backup';
import {
  addDays,
  getTodayIso,
  isValidIsoDate,
} from '../../domain/dates';
import type { TranslationKey } from '../../i18n';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../ui/ToastProvider';
import { Button } from '../../ui/Button';
import { downloadTextFile } from '../../utils/download';
import { BackupImportModal } from '../backup/BackupImportModal';

const RANGE_LABEL_KEYS: Record<BackupExportPreset, TranslationKey> = {
  '7d': 'backup.range7',
  '30d': 'backup.range30',
  '90d': 'backup.range90',
  all: 'backup.rangeAll',
  custom: 'backup.rangeCustom',
};

export function BackupCard() {
  const { t } = useI18n();
  const { actions, isSaving } = useApp();
  const { showToast } = useToast();
  const today = getTodayIso();
  const [preset, setPreset] = useState<BackupExportPreset>('7d');
  const [customFrom, setCustomFrom] = useState(addDays(today, -6));
  const [customTo, setCustomTo] = useState(today);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = getBackupDateRange(
    preset,
    customFrom,
    customTo,
    today,
  );
  const busy = exporting || isSaving;

  const handleExport = async () => {
    setError(null);

    if (preset === 'custom') {
      if (
        !isValidIsoDate(customFrom) ||
        !isValidIsoDate(customTo) ||
        customFrom > customTo ||
        customTo > today
      ) {
        setError(t('backup.invalidRange'));
        return;
      }
    }

    setExporting(true);
    try {
      const payload = await actions.createBackup(range.from, range.to);
      const suffix =
        payload.logsFrom && payload.logsTo
          ? `${payload.logsFrom}_${payload.logsTo}`
          : 'all';
      downloadTextFile(
        `calorie-day-backup-${suffix}.json`,
        JSON.stringify(payload, null, 2),
      );
      showToast(
        t('toast.backupExported', {
          foods: payload.foods.length,
          logs: payload.logs.length,
        }),
      );
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : t('backup.exportFailed'),
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <section
        className="settings-card settings-card--backup"
        aria-labelledby="backup-title"
      >
        <header className="settings-card__header">
          <div>
            <p className="eyebrow">{t('backup.eyebrow')}</p>
            <h2 id="backup-title">{t('backup.title')}</h2>
            <p>{t('backup.description')}</p>
          </div>
          <span className="storage-icon" aria-hidden="true">
            <Archive size={21} />
          </span>
        </header>

        <div className="backup-export">
          <div className="field">
            <span className="field-label">{t('backup.range')}</span>
            <div
              className="filter-chips"
              role="group"
              aria-label={t('backup.rangeAria')}
            >
              {BACKUP_RANGE_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`filter-chip ${
                    preset === value ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setPreset(value);
                    setError(null);
                  }}
                  disabled={busy}
                >
                  {t(RANGE_LABEL_KEYS[value])}
                </button>
              ))}
            </div>
            <p className="field-hint">{t('backup.rangeHint')}</p>
          </div>

          {preset === 'custom' && (
            <div className="backup-date-range">
              <label className="field">
                <span className="field-label">{t('backup.from')}</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || today}
                  onChange={(event) => {
                    setCustomFrom(event.target.value);
                    setError(null);
                  }}
                  disabled={busy}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('backup.to')}</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={today}
                  onChange={(event) => {
                    setCustomTo(event.target.value);
                    setError(null);
                  }}
                  disabled={busy}
                />
              </label>
            </div>
          )}

          <div className="backup-export__actions">
            <Button
              icon={<Download size={16} />}
              loading={exporting}
              disabled={busy}
              onClick={() => void handleExport()}
            >
              {exporting ? t('backup.exporting') : t('backup.export')}
            </Button>
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="backup-import">
          <div>
            <strong>{t('backup.importTitle')}</strong>
            <p>{t('backup.importDescription')}</p>
          </div>
          <Button
            variant="secondary"
            icon={<Upload size={16} />}
            onClick={() => setImportOpen(true)}
            disabled={busy}
          >
            {t('backup.importButton')}
          </Button>
        </div>

        <p className="settings-card__note">{t('backup.importNote')}</p>
      </section>

      <BackupImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </>
  );
}
