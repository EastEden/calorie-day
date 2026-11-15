import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import {
  MEAL_IMPORT_AI_PROMPT,
  parseMealImportJson,
  type MealImportPayload,
} from '../../domain/mealImport';
import { formatKcal } from '../../domain/formatters';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/ToastProvider';

interface MealImportModalProps {
  open: boolean;
  onClose: () => void;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function MealImportModal({
  open,
  onClose,
}: MealImportModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { actions, isSaving } = useApp();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<MealImportPayload | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setText('');
    setParsed(null);
    setErrors([]);
    setCopied(false);
    setSubmitting(false);
  }, [open]);

  const summary = useMemo(() => {
    if (!parsed) {
      return null;
    }
    let entries = 0;
    let kcal = 0;
    for (const day of parsed.days) {
      for (const mealEntries of Object.values(day.meals)) {
        for (const entry of mealEntries) {
          entries += 1;
          kcal += entry.nutrition.kcal;
        }
      }
    }
    return { days: parsed.days.length, entries, kcal };
  }, [parsed]);

  const isBusy = submitting || isSaving;

  const handleCopy = async () => {
    try {
      await copyText(MEAL_IMPORT_AI_PROMPT);
      setCopied(true);
      showToast(t('mealImport.copied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t('mealImport.copyFailed'), 'error');
    }
  };

  const handleValidate = () => {
    const result = parseMealImportJson(text);

    if (!result.success) {
      setParsed(null);
      setErrors(result.errors);
      return;
    }

    setParsed(result.data);
    setErrors([]);
  };

  const handleImport = async () => {
    if (!parsed || isBusy) {
      return;
    }

    setSubmitting(true);
    try {
      await actions.importMealLogs(parsed);
      onClose();
    } catch {
      // The app-level action already surfaces the error as a toast.
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={t('mealImport.title')}
      description={t('mealImport.description')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isBusy}>
            {t('common.cancel')}
          </Button>
          {parsed ? (
            <Button
              onClick={() => void handleImport()}
              loading={submitting}
              disabled={isSaving}
            >
              {t('mealImport.confirm')}
            </Button>
          ) : (
            <Button
              onClick={handleValidate}
              disabled={isBusy || text.trim().length === 0}
            >
              {t('mealImport.validate')}
            </Button>
          )}
        </>
      }
    >
      <div className="meal-import">
        <section className="meal-import__prompt">
          <div className="meal-import__prompt-header">
            <h3>{t('mealImport.promptTitle')}</h3>
            <Button
              variant="ghost"
              size="sm"
              icon={
                copied ? (
                  <Check size={15} />
                ) : (
                  <ClipboardCopy size={15} />
                )
              }
              onClick={() => void handleCopy()}
            >
              {copied
                ? t('mealImport.copied')
                : t('mealImport.copyPrompt')}
            </Button>
          </div>
          <pre className="meal-import__prompt-text">
            {MEAL_IMPORT_AI_PROMPT}
          </pre>
        </section>

        <section className="meal-import__input">
          <span className="field-label">
            {t('mealImport.pasteTitle')}
          </span>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setParsed(null);
              setErrors([]);
            }}
            placeholder={t('mealImport.pastePlaceholder')}
            rows={10}
            spellCheck={false}
            disabled={isBusy}
          />
        </section>

        {errors.length > 0 && (
          <div className="form-error" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}

        {parsed && summary && (
          <div className="meal-import__preview">
            <strong>{t('mealImport.previewTitle')}</strong>
            <span>{t('mealImport.summaryDays', { n: summary.days })}</span>
            <span>
              {t('mealImport.summaryEntries', {
                n: summary.entries,
              })}
            </span>
            <span>
              {t('mealImport.summaryKcal', {
                kcal: formatKcal(summary.kcal),
              })}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
