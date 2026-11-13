import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useI18n } from './i18n';
import { useApp } from './state/AppContext';
import { BrandMark } from './ui/BrandMark';
import { Button } from './ui/Button';
import { TopBar } from './app/TopBar';
import { BottomNav } from './app/BottomNav';
import type { AppTab } from './app/navigation';
import { DiaryPage } from './features/diary/DiaryPage';
import { FoodsPage } from './features/foods/FoodsPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ShareModal } from './features/share/ShareModal';

function AppLoadingScreen() {
  const { t } = useI18n();

  return (
    <div className="app-status-screen">
      <div className="app-status-screen__mark">
        <BrandMark size={54} />
      </div>
      <h1>{t('app.name')}</h1>
      <p>{t('app.loadingText')}</p>
      <Loader2 className="app-status-screen__spinner" size={20} aria-hidden="true" />
    </div>
  );
}

function AppFatalScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="app-status-screen app-status-screen--error">
      <span className="app-status-screen__error-icon">
        <AlertTriangle size={26} aria-hidden="true" />
      </span>
      <h1>{t('app.fatalTitle')}</h1>
      <p>{message}</p>
      <p className="app-status-screen__hint">{t('app.fatalHint')}</p>
      <Button icon={<RefreshCw size={16} />} onClick={onRetry}>
        {t('app.reload')}
      </Button>
    </div>
  );
}

export default function App() {
  const {
    status,
    initializationError,
    profile,
    summary,
    isLogLoading,
    logError,
    actions,
  } = useApp();
  const { t } = useI18n();
  const [tab, setTab] = useState<AppTab>('diary');
  const [shareOpen, setShareOpen] = useState(false);
  const hadProfile = useRef(Boolean(profile));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  useEffect(() => {
    const hasProfile = Boolean(profile);
    if (!hadProfile.current && hasProfile) {
      window.scrollTo(0, 0);
    }
    hadProfile.current = hasProfile;
  }, [profile]);

  if (status === 'loading') {
    return <AppLoadingScreen />;
  }

  if (status === 'fatal') {
    return (
      <AppFatalScreen
        message={initializationError ?? t('app.fatalFallback')}
        onRetry={actions.retryInitialization}
      />
    );
  }

  if (!profile) {
    return <OnboardingPage />;
  }

  const canShare =
    !isLogLoading &&
    !logError &&
    summary.entryCount > 0 &&
    summary.target !== null;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('app.skipToMain')}
      </a>

      <TopBar
        activeTab={tab}
        onTabChange={setTab}
        onShare={() => setShareOpen(true)}
        shareDisabled={!canShare}
      />

      <main id="main-content" className="app-main">
        <div key={tab} className="page-transition">
          {tab === 'diary' && (
            <DiaryPage onShare={() => setShareOpen(true)} />
          )}
          {tab === 'foods' && <FoodsPage />}
          {tab === 'settings' && <SettingsPage />}
        </div>
      </main>

      <BottomNav activeTab={tab} onTabChange={setTab} />

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
