import {
  Database,
  HardDrive,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatBytes } from '../../data/storageInfo';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';

export function StorageCard() {
  const { t } = useI18n();
  const { storageInfo, actions, foods } = useApp();
  const quotaLabel =
    storageInfo.usageBytes !== null
      ? `${formatBytes(storageInfo.usageBytes)}${
          storageInfo.quotaBytes !== null
            ? ` / ${formatBytes(storageInfo.quotaBytes)}`
            : ''
        }`
      : t('storage.unsupported');

  return (
    <section className="settings-card settings-card--storage" aria-labelledby="storage-title">
      <header className="settings-card__header">
        <div>
          <p className="eyebrow">{t('storage.eyebrow')}</p>
          <h2 id="storage-title">{t('storage.title')}</h2>
          <p>{t('storage.description')}</p>
        </div>
        <span className="storage-icon" aria-hidden="true">
          <Database size={22} />
        </span>
      </header>

      <div className="storage-statuses">
        <div className="storage-status">
          <span className="storage-status__icon">
            <HardDrive size={17} aria-hidden="true" />
          </span>
          <div>
            <span>{t('storage.location')}</span>
            <strong>{t('storage.locationValue')}</strong>
          </div>
        </div>

        <div className="storage-status">
          <span className="storage-status__icon">
            {storageInfo.persisted ? (
              <ShieldCheck size={17} aria-hidden="true" />
            ) : (
              <ShieldAlert size={17} aria-hidden="true" />
            )}
          </span>
          <div>
            <span>{t('storage.persistent')}</span>
            <strong>
              {storageInfo.persisted
                ? t('storage.persistentOn')
                : t('storage.persistentOff')}
            </strong>
          </div>
        </div>

        <div className="storage-status">
          <span className="storage-status__icon">
            <LockKeyhole size={17} aria-hidden="true" />
          </span>
          <div>
            <span>{t('storage.usage')}</span>
            <strong>{quotaLabel}</strong>
          </div>
        </div>
      </div>

      <div className="storage-actions">
        <p>
          {t('storage.loaded', { n: foods.length })}
          {t('storage.localOnly')}
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={15} />}
          onClick={() => void actions.requestPersistence()}
          disabled={!storageInfo.supported}
        >
          {t('storage.request')}
        </Button>
      </div>

      <p className="settings-card__note">{t('storage.note')}</p>
    </section>
  );
}
