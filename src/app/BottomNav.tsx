import { useI18n } from '../i18n';
import { APP_TABS, type AppTab } from './navigation';

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useI18n();

  return (
    <nav className="bottomnav" aria-label={t('nav.mobileAria')}>
      {APP_TABS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`bottomnav__item ${
              activeTab === item.id ? 'is-active' : ''
            }`}
            onClick={() => onTabChange(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <span className="bottomnav__icon">
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span>{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
