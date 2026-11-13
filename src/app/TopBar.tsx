import { Share2 } from 'lucide-react';
import { APP_TABS, type AppTab } from '../app/navigation';
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
  return (
    <header className="topbar">
      <div className="topbar__inner page-width">
        <button
          type="button"
          className="brand"
          onClick={() => onTabChange('diary')}
          aria-label="回到今日记录"
        >
          <BrandMark size={38} />
          <span className="brand__text">
            <strong>每日热量</strong>
            <small>CALORIE DAY</small>
          </span>
        </button>

        <nav className="topnav" aria-label="主导航">
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
                {item.label}
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
          title={shareDisabled ? '先记录至少一项食物' : '生成今日营养分享图'}
          className="topbar__share"
        >
          分享
        </Button>
      </div>
    </header>
  );
}
