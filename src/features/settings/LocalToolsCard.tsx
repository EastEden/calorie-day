import { useState } from 'react';
import {
  AlertTriangle,
  FlaskConical,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

export function LocalToolsCard() {
  const { t } = useI18n();
  const { actions, isSaving } = useApp();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setConfirmed(false);
    setError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    if (resetting) {
      return;
    }
    setOpen(false);
    setError(null);
  };

  const handleReset = async () => {
    if (!confirmed || resetting) {
      return;
    }

    setResetting(true);
    setError(null);

    const ok = await actions.resetAllData();
    if (!ok) {
      setError(t('localTools.failed'));
      setResetting(false);
    }
  };

  return (
    <>
      <section
        className="settings-card settings-card--local-tools"
        aria-labelledby="local-tools-title"
      >
        <header className="settings-card__header">
          <div>
            <p className="eyebrow">{t('localTools.eyebrow')}</p>
            <h2 id="local-tools-title">{t('localTools.title')}</h2>
            <p>{t('localTools.description')}</p>
          </div>
          <span className="storage-icon storage-icon--danger" aria-hidden="true">
            <FlaskConical size={22} />
          </span>
        </header>

        <div className="local-tools">
          <div className="local-tools__notice">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <strong>{t('localTools.warningTitle')}</strong>
              <p>{t('localTools.warning')}</p>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={16} />}
            onClick={openDialog}
            disabled={isSaving}
          >
            {t('localTools.reset')}
          </Button>
        </div>

        <p className="settings-card__note">{t('localTools.note')}</p>
      </section>

      <Modal
        open={open}
        onClose={closeDialog}
        size="sm"
        title={t('localTools.dialogTitle')}
        description={t('localTools.dialogDescription')}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={closeDialog}
              disabled={resetting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              loading={resetting}
              disabled={!confirmed}
              onClick={() => void handleReset()}
            >
              {t('localTools.confirm')}
            </Button>
          </>
        }
      >
        <div className="reset-dialog">
          <div className="reset-dialog__warning">
            <AlertTriangle size={20} aria-hidden="true" />
            <p>{t('localTools.dialogIntro')}</p>
          </div>
          <ul className="reset-dialog__list">
            <li>{t('localTools.itemProfile')}</li>
            <li>{t('localTools.itemLogs')}</li>
            <li>{t('localTools.itemFoods')}</li>
            <li>{t('localTools.itemDatabase')}</li>
          </ul>
          <p className="reset-dialog__hint">{t('localTools.tabsHint')}</p>

          <label className="check-row check-row--danger">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={resetting}
            />
            <span>
              <strong>{t('localTools.confirmTitle')}</strong>
              <small>{t('localTools.confirmHint')}</small>
            </span>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
