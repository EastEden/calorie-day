import { Share2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { APP_TABS, type AppTab } from './navigation';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';

interface TopBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onShare: () => void;
  shareDisabled: boolean;
}

export function TopBar({
  activeTab,
  onTabChange,
  onShare,
  shareDisabled,
}: TopBarProps) {
  const { t } = useI18n();

  return (
    <header className="topbar">
      <div className="topbar__inner page-width">
        <button
          type="button"
          className="brand"
          onClick={() => onTabChange('diary')}
          aria-label={t('topbar.brandAria')}
        >
          <BrandMark size={38} />
          <span className="brand__text">
            <strong>{t('app.name')}</strong>
            <small>CALORIE DAY</small>
          </span>
        </button>

        <nav className="topnav" aria-label={t('nav.mainAria')}>
          {APP_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`topnav__item ${
                  activeTab === item.id ? 'is-active' : ''
                }`}
                onClick={() => onTabChange(item.id)}
                aria-current={activeTab === item.id ? 'page' : undefined}
              >
                <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>

        <Button
          variant="primary"
          size="sm"
          icon={<Share2 size={16} />}
          onClick={onShare}
          disabled={shareDisabled}
          title={
            shareDisabled
              ? t('topbar.shareDisabled')
              : t('topbar.shareHint')
          }
          className="topbar__share"
        >
          {t('topbar.share')}
        </Button>
      </div>
    </header>
  );
}
