import { Info } from 'lucide-react';
import { isLocalTestToolsEnabled } from '../../app/environment';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { BackupCard } from './BackupCard';
import { LocalToolsCard } from './LocalToolsCard';
import { ProfileForm } from './ProfileForm';
import { StorageCard } from './StorageCard';
import { TargetCard } from './TargetCard';

export function SettingsPage() {
  const { t } = useI18n();
  const { foods, targetSettings } = useApp();
  const showLocalTools = isLocalTestToolsEnabled();

  return (
    <div className="settings-page page-width">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t('settings.eyebrow')}</p>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.description')}</p>
        </div>
        <span className="page-header__badge">
          {targetSettings.mode === 'manual'
            ? t('target.mode.manual')
            : t('target.mode.auto')}
        </span>
      </header>

      <div className="settings-grid">
        <ProfileForm />
        <TargetCard />
        <div className="settings-grid__full">
          <StorageCard />
        </div>

        <div className="settings-grid__full">
          <BackupCard />
        </div>

        {showLocalTools && (
          <div className="settings-grid__full">
            <LocalToolsCard />
          </div>
        )}

        <section className="settings-card settings-card--info">
          <header className="settings-card__header">
            <div>
              <p className="eyebrow">{t('settings.info.eyebrow')}</p>
              <h2>{t('settings.info.title')}</h2>
            </div>
            <span className="storage-icon" aria-hidden="true">
              <Info size={21} />
            </span>
          </header>
          <div className="info-rows">
            <div>
              <span>{t('settings.info.calories')}</span>
              <p>{t('notes.nutritionReference')}</p>
            </div>
            <div>
              <span>{t('settings.info.food')}</span>
              <p>{t('notes.dataReference')}</p>
            </div>
            <div>
              <span>{t('settings.info.library')}</span>
              <p>{t('settings.info.libraryCount', { n: foods.length })}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
