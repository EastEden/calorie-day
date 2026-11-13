import { APP_TABS, type AppTab } from '../app/navigation';

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottomnav" aria-label="移动端主导航">
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
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
