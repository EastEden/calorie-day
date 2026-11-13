import {
  Database,
  HardDrive,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatBytes } from '../../data/storageInfo';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';

export function StorageCard() {
  const { storageInfo, actions, foods } = useApp();
  const quotaLabel =
    storageInfo.usageBytes !== null
      ? `${formatBytes(storageInfo.usageBytes)}${
          storageInfo.quotaBytes !== null
            ? ` / ${formatBytes(storageInfo.quotaBytes)}`
            : ''
        }`
      : '暂不可用';

  return (
    <section className="settings-card settings-card--storage" aria-labelledby="storage-title">
      <header className="settings-card__header">
        <div>
          <p className="eyebrow">自动保存</p>
          <h2 id="storage-title">本地数据</h2>
          <p>
            每日记录和食物库通过 IndexedDB 保存在当前浏览器中。
            每次添加、修改或删除都会在界面确认前完成写入。
          </p>
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
            <span>存储位置</span>
            <strong>此设备的浏览器 · IndexedDB</strong>
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
            <span>持久存储</span>
            <strong>
              {storageInfo.persisted
                ? '已启用，降低被系统回收的概率'
                : '尚未启用'}
            </strong>
          </div>
        </div>

        <div className="storage-status">
          <span className="storage-status__icon">
            <LockKeyhole size={17} aria-hidden="true" />
          </span>
          <div>
            <span>当前占用</span>
            <strong>{quotaLabel}</strong>
          </div>
        </div>
      </div>

      <div className="storage-actions">
        <p>
          已加载 {foods.length} 项食物。数据只属于当前浏览器和当前网址，
          清理站点数据、换浏览器或换设备后不会自动出现。
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={15} />}
          onClick={() => void actions.requestPersistence()}
          disabled={!storageInfo.supported}
        >
          申请持久存储
        </Button>
      </div>

      <p className="settings-card__note">
        同一浏览器、同一网址下，刷新页面、关闭标签页或重启浏览器后，
        记录会自动从本地数据库恢复。清理浏览器站点数据会删除这些记录。
      </p>
    </section>
  );
}
