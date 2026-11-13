import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Upload,
} from 'lucide-react';
import {
  MAX_BACKUP_FILE_BYTES,
  parseBackupJson,
} from '../../domain/backup';
import { formatShortDate } from '../../domain/dates';
import type { BackupPayload } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../ui/ToastProvider';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

interface BackupImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function BackupImportModal({
  open,
  onClose,
}: BackupImportModalProps) {
  const { t } = useI18n();
  const { actions } = useApp();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFileName('');
    setPayload(null);
    setErrors([]);
    setImporting(false);
    setImportError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [open]);

  const readFile = async (file: File) => {
    setImportError(null);
    setPayload(null);
    setErrors([]);
    setFileName(file.name);

    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setErrors([t('backup.fileTooLarge')]);
      return;
    }

    let text = '';
    try {
      text = await file.text();
    } catch {
      setErrors([t('backup.unreadable')]);
      return;
    }

    const parsed = parseBackupJson(text);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }

    setPayload(parsed.data);
  };

  const handleFileInput = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      void readFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFileInput(event.dataTransfer.files);
  };

  const handleImport = async () => {
    if (!payload) {
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const result = await actions.importBackup(payload);
      showToast(
        t('toast.backupImported', {
          foods: result.foodsAdded,
          logs: result.logsAdded,
        }),
      );
      if (result.foodsSkipped > 0 || result.logsSkipped > 0) {
        showToast(
          t('toast.backupSkipped', {
            foods: result.foodsSkipped,
            logs: result.logsSkipped,
          }),
          'info',
        );
      }
      onClose();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : t('backup.importFailed'),
      );
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  const logDates = payload?.logs.map((log) => log.date).sort() ?? [];
  const rangeFrom = payload?.logsFrom ?? logDates[0] ?? null;
  const rangeTo =
    payload?.logsTo ?? logDates[logDates.length - 1] ?? null;
  const canImport =
    Boolean(payload) && errors.length === 0 && !importing;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={t('backup.modalTitle')}
      description={t('backup.modalDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={importing}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void handleImport()}
            loading={importing}
            disabled={!canImport}
          >
            {importing ? t('backup.importing') : t('backup.importAction')}
          </Button>
        </>
      }
    >
      <div className="import-modal">
        <div
          className={`drop-zone ${fileName ? 'has-file' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="drop-zone__icon">
            {fileName ? <FileJson size={24} /> : <Upload size={24} />}
          </span>
          <div>
            <strong>{fileName || t('backup.chooseFile')}</strong>
            <small>{t('backup.dropHint')}</small>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {t('backup.importButton')}
          </Button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              handleFileInput(event.target.files);
              event.target.value = '';
            }}
          />
        </div>

        {errors.length > 0 && (
          <div className="import-errors" role="alert">
            <div className="import-errors__title">
              <AlertTriangle size={17} aria-hidden="true" />
              {t('backup.invalidTitle')}
            </div>
            <ul>
              {errors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {errors.length > 8 && (
              <p>{t('backup.moreIssues', { n: errors.length - 8 })}</p>
            )}
          </div>
        )}

        {payload && (
          <div className="import-preview">
            <div className="import-summary-grid">
              <div className="import-summary">
                <span>{t('backup.foods')}</span>
                <strong>{payload.foods.length}</strong>
              </div>
              <div className="import-summary">
                <span>{t('backup.logs')}</span>
                <strong>{payload.logs.length}</strong>
              </div>
              <div className="import-summary">
                <span>{t('backup.profile')}</span>
                <strong
                  className={
                    payload.profile ? 'is-positive' : 'is-warning'
                  }
                >
                  {payload.profile
                    ? t('backup.profileIncluded')
                    : t('backup.profileNotIncluded')}
                </strong>
              </div>
            </div>

            <p className="backup-range-text">
              {rangeFrom && rangeTo
                ? t('backup.rangeValue', {
                    from: formatShortDate(rangeFrom),
                    to: formatShortDate(rangeTo),
                  })
                : t('backup.noLogs')}
            </p>

            <div className="import-ok">
              <CheckCircle2 size={17} aria-hidden="true" />
              {t('backup.ready')}
            </div>

            <p className="field-hint">{t('backup.mergeNotice')}</p>

            {importError && (
              <p className="form-error" role="alert">
                {importError}
              </p>
            )}
          </div>
        )}

        <p className="import-schema-note">{t('backup.schemaNote')}</p>
      </div>
    </Modal>
  );
}
