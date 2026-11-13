import { useState } from 'react';
import {
  AlertTriangle,
  FlaskConical,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

export function LocalToolsCard() {
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
      setError('重置失败，请重试。');
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
            <p className="eyebrow">仅本地 / 测试环境</p>
            <h2 id="local-tools-title">本地测试工具</h2>
            <p>
              这个卡片只在开发环境或 localhost 中出现，生产域名默认不会显示。
              用于快速清空并重新测试首次使用流程。
            </p>
          </div>
          <span className="storage-icon storage-icon--danger" aria-hidden="true">
            <FlaskConical size={22} />
          </span>
        </header>

        <div className="local-tools">
          <div className="local-tools__notice">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <strong>全局重置会删除当前浏览器里的全部应用数据</strong>
              <p>
                包括个人资料、推荐目标、所有日期的饮食记录和食物库。
                操作完成后会重新加载并回到首次设置页面。
              </p>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={16} />}
            onClick={openDialog}
            disabled={isSaving}
          >
            重置全部本地数据
          </Button>
        </div>

        <p className="settings-card__note">
          仅删除本应用的 IndexedDB 数据库，不影响同一浏览器中的其他网站。
          操作不可撤销，建议先确认没有其他标签页正在使用本应用。
        </p>
      </section>

      <Modal
        open={open}
        onClose={closeDialog}
        size="sm"
        title="重置全部本地数据？"
        description="这是一个仅用于本地测试的不可撤销操作。"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={closeDialog}
              disabled={resetting}
            >
              取消
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              loading={resetting}
              disabled={!confirmed}
              onClick={() => void handleReset()}
            >
              确认重置
            </Button>
          </>
        }
      >
        <div className="reset-dialog">
          <div className="reset-dialog__warning">
            <AlertTriangle size={20} aria-hidden="true" />
            <p>
              重置后，本应用会删除以下数据，并重新载入首次设置：
            </p>
          </div>
          <ul className="reset-dialog__list">
            <li>个人资料与推荐目标</li>
            <li>所有日期的早餐、午餐、晚餐、加餐记录</li>
            <li>食物库、自定义食物和 JSON 导入的食物</li>
            <li>本应用的 IndexedDB 数据库及其索引</li>
          </ul>
          <p className="reset-dialog__hint">
            如果其他「每日热量」标签页仍然打开，删除可能被阻止。
            请先关闭其他标签页，再执行重置。
          </p>

          <label className="check-row check-row--danger">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={resetting}
            />
            <span>
              <strong>我明白此操作不可撤销</strong>
              <small>重置会清空本应用的全部本地记录。</small>
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
