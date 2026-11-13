import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  Upload,
} from 'lucide-react';
import type { Food } from '../../domain/types';
import type { FoodImportPayload } from '../../domain/schemas';
import { parseFoodImportJson } from '../../domain/schemas';
import {
  buildFoodImportPlan,
  buildFoodImportTemplate,
  materializeImportedFoods,
  type FoodImportPlan,
} from './foodTransfer';
import {
  getFoodDisplayName,
  resolveLocalizedText,
} from '../../domain/localizedText';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../ui/ToastProvider';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { downloadTextFile } from '../../utils/download';

interface ImportFoodsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportFoodsModal({
  open,
  onClose,
}: ImportFoodsModalProps) {
  const { t, locale } = useI18n();
  const { foods, actions } = useApp();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [payload, setPayload] = useState<FoodImportPayload | null>(null);
  const [plan, setPlan] = useState<FoodImportPlan | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFileName('');
    setPayload(null);
    setPlan(null);
    setErrors([]);
    setOverwrite(false);
    setImporting(false);
    setImportError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [open]);

  const readFile = async (file: File) => {
    setImportError(null);
    setPayload(null);
    setPlan(null);
    setErrors([]);
    setFileName(file.name);

    if (file.size > 2 * 1024 * 1024) {
      setErrors([t('import.fileTooLarge')]);
      return;
    }

    let text = '';
    try {
      text = await file.text();
    } catch {
      setErrors([t('import.unreadable')]);
      return;
    }

    const parsed = parseFoodImportJson(text);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }

    const nextPlan = buildFoodImportPlan(foods, parsed.data, locale);
    setPayload(parsed.data);
    setPlan(nextPlan);
    if (nextPlan.conflicts.length === 0) {
      setOverwrite(false);
    }
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

  const downloadTemplate = () => {
    downloadTextFile(
      'calorie-foods-template.json',
      buildFoodImportTemplate(),
    );
    showToast(t('import.templateDownloaded'));
  };

  const handleImport = async () => {
    if (!plan || !payload) {
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const importedFoods: Food[] = materializeImportedFoods(plan, overwrite);
      if (importedFoods.length === 0) {
        setImportError(t('import.empty'));
        setImporting(false);
        return;
      }
      await actions.importFoods(importedFoods);
      showToast(t('import.imported', { n: importedFoods.length }));
      onClose();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : t('import.failed'),
      );
    } finally {
      setImporting(false);
    }
  };

  const addedCount = plan
    ? plan.newItems.length + (overwrite ? plan.conflicts.length : 0)
    : 0;
  const canImport =
    Boolean(plan) &&
    plan!.blockingErrors.length === 0 &&
    addedCount > 0 &&
    !importing;

  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={t('import.title')}
      description={t('import.description')}
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
            {plan
              ? overwrite && plan.conflicts.length > 0
                ? t('import.actionOverwrite', { n: addedCount })
                : t('import.actionCount', { n: addedCount })
              : t('import.action')}
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
            <strong>{fileName || t('import.chooseJson')}</strong>
            <small>{t('import.dropHint')}</small>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {t('import.chooseFile')}
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

        <div className="import-tools">
          <p>{t('import.templateHint')}</p>
          <button
            type="button"
            className="text-button"
            onClick={downloadTemplate}
          >
            <Download size={15} aria-hidden="true" />
            {t('import.templateDownload')}
          </button>
        </div>

        {errors.length > 0 && (
          <div className="import-errors" role="alert">
            <div className="import-errors__title">
              <AlertTriangle size={17} aria-hidden="true" />
              {t('import.invalidTitle')}
            </div>
            <ul>
              {errors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {errors.length > 8 && (
              <p>
                {t('import.moreIssues', { n: errors.length - 8 })}
              </p>
            )}
          </div>
        )}

        {plan && (
          <div className="import-preview">
            <div className="import-summary-grid">
              <div className="import-summary">
                <span>{t('import.fileFoods')}</span>
                <strong>{plan.total}</strong>
              </div>
              <div className="import-summary">
                <span>{t('import.newItems')}</span>
                <strong className="is-positive">{plan.newItems.length}</strong>
              </div>
              <div className="import-summary">
                <span>{t('import.conflicts')}</span>
                <strong className={plan.conflicts.length ? 'is-warning' : ''}>
                  {plan.conflicts.length}
                </strong>
              </div>
            </div>

            {plan.blockingErrors.length > 0 && (
              <div className="import-errors" role="alert">
                <div className="import-errors__title">
                  <AlertTriangle size={17} aria-hidden="true" />
                  {t('import.resolveTitle')}
                </div>
                <ul>
                  {plan.blockingErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.conflicts.length > 0 && (
              <>
                <div className="conflict-list">
                  <div className="conflict-list__heading">
                    <span>{t('import.conflictHeading')}</span>
                    <span>{t('import.matchMethod')}</span>
                  </div>
                  {plan.conflicts.slice(0, 6).map((conflict) => (
                    <div
                      className="conflict-list__row"
                      key={`${resolveLocalizedText(
                        conflict.incoming.names,
                        locale,
                      )}-${conflict.existing.id}`}
                    >
                      <span>
                        {resolveLocalizedText(
                          conflict.incoming.names,
                          locale,
                        )}
                      </span>
                      <small>
                        {conflict.matchedBy === 'id'
                          ? t('import.matchId')
                          : t('import.matchName')}{' '}
                        · {getFoodDisplayName(conflict.existing, locale)}
                      </small>
                    </div>
                  ))}
                  {plan.conflicts.length > 6 && (
                    <p className="conflict-list__more">
                      {t('import.moreConflicts', {
                        n: plan.conflicts.length - 6,
                      })}
                    </p>
                  )}
                </div>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(event) => setOverwrite(event.target.checked)}
                  />
                  <span>
                    <strong>{t('import.overwriteTitle')}</strong>
                    <small>{t('import.overwriteHint')}</small>
                  </span>
                </label>
              </>
            )}

            <div className="import-ok">
              <CheckCircle2 size={17} aria-hidden="true" />
              {t('import.ready')}
            </div>

            {importError && (
              <p className="form-error" role="alert">
                {importError}
              </p>
            )}
          </div>
        )}

        <p className="import-schema-note">{t('import.schemaNote')}</p>
      </div>
    </Modal>
  );
}
