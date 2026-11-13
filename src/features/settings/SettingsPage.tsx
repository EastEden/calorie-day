import { Info } from 'lucide-react';
import {
  DATA_REFERENCE_NOTE,
  NUTRITION_REFERENCE_NOTE,
} from '../../domain/constants';
import { useApp } from '../../state/AppContext';
import { ProfileForm } from './ProfileForm';
import { StorageCard } from './StorageCard';
import { TargetCard } from './TargetCard';

export function SettingsPage() {
  const { foods, targetSettings } = useApp();

  return (
    <div className="settings-page page-width">
      <header className="page-header">
        <div>
          <p className="eyebrow">让目标更像你</p>
          <h1>设置</h1>
          <p>
            调整身体资料与推荐目标。所有计算都是估算值，你可以随时手动覆盖。
          </p>
        </div>
        <span className="page-header__badge">
          {targetSettings.mode === 'manual' ? '手动目标' : '自动推荐'}
        </span>
      </header>

      <div className="settings-grid">
        <ProfileForm />
        <TargetCard />
        <div className="settings-grid__full">
          <StorageCard />
        </div>

        <section className="settings-card settings-card--info">
          <header className="settings-card__header">
            <div>
              <p className="eyebrow">信息</p>
              <h2>计算说明</h2>
            </div>
            <span className="storage-icon" aria-hidden="true">
              <Info size={21} />
            </span>
          </header>
          <div className="info-rows">
            <div>
              <span>热量推荐</span>
              <p>{NUTRITION_REFERENCE_NOTE}</p>
            </div>
            <div>
              <span>食物营养</span>
              <p>{DATA_REFERENCE_NOTE}</p>
            </div>
            <div>
              <span>当前食物库</span>
              <p>{foods.length} 项食物，按每 100g 保存营养参考值。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
