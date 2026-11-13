import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  Upload,
} from 'lucide-react';
import type { Food } from '../../domain/types';
import type { FoodImportPayload } from '../../domain/schemas';
import { parseFoodImportJson } from '../../domain/schemas';
import {
  buildFoodImportPlan,
  buildFoodImportTemplate,
  materializeImportedFoods,
  type FoodImportPlan,
} from './foodTransfer';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../ui/ToastProvider';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { downloadTextFile } from '../../utils/download';

interface ImportFoodsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportFoodsModal({
  open,
  onClose,
}: ImportFoodsModalProps) {
  const { foods, actions } = useApp();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [payload, setPayload] = useState<FoodImportPayload | null>(null);
  const [plan, setPlan] = useState<FoodImportPlan | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFileName('');
    setPayload(null);
    setPlan(null);
    setErrors([]);
    setOverwrite(false);
    setImporting(false);
    setImportError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [open]);

  const readFile = async (file: File) => {
    setImportError(null);
    setPayload(null);
    setPlan(null);
    setErrors([]);
    setFileName(file.name);

    if (file.size > 2 * 1024 * 1024) {
      setErrors(['文件超过 2MB。请确认导入的是食物库 JSON，而不是完整备份。']);
      return;
    }

    let text = '';
    try {
      text = await file.text();
    } catch {
      setErrors(['无法读取这个文件，请重新选择。']);
      return;
    }

    const parsed = parseFoodImportJson(text);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }

    const nextPlan = buildFoodImportPlan(foods, parsed.data);
    setPayload(parsed.data);
    setPlan(nextPlan);
    if (nextPlan.conflicts.length === 0) {
      setOverwrite(false);
    }
  };

  const handleFileInput = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      void readFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFileInput(event.dataTransfer.files);
  };

  const downloadTemplate = () => {
    downloadTextFile(
      'calorie-foods-template.json',
      buildFoodImportTemplate(),
    );
    showToast('示例模板已下载。');
  };

  const handleImport = async () => {
    if (!plan || !payload) {
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const importedFoods: Food[] = materializeImportedFoods(plan, overwrite);
      if (importedFoods.length === 0) {
        setImportError('没有需要导入的新食物。');
        setImporting(false);
        return;
      }
      await actions.importFoods(importedFoods);
      showToast(`已导入 ${importedFoods.length} 项食物。`);
      onClose();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : '导入失败，请重试。',
      );
    } finally {
      setImporting(false);
    }
  };

  const addedCount = plan
    ? plan.newItems.length + (overwrite ? plan.conflicts.length : 0)
    : 0;
  const canImport =
    Boolean(plan) &&
    plan!.blockingErrors.length === 0 &&
    addedCount > 0 &&
    !importing;

  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title="导入食物库"
      description="导入只新增或更新食物，不会删除当前食物库。支持随时随地再次导入。"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={importing}>
            取消
          </Button>
          <Button
            onClick={() => void handleImport()}
            loading={importing}
            disabled={!canImport}
          >
            {plan
              ? overwrite && plan.conflicts.length > 0
                ? `导入 / 覆盖 ${addedCount} 项`
                : `导入 ${addedCount} 项`
              : '导入'}
          </Button>
        </>
      }
    >
      <div className="import-modal">
        <div
          className={`drop-zone ${fileName ? 'has-file' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="drop-zone__icon">
            {fileName ? <FileJson size={24} /> : <Upload size={24} />}
          </span>
          <div>
            <strong>{fileName || '选择 JSON 文件'}</strong>
            <small>点击选择，或将文件拖到这里</small>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            选择文件
          </Button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              handleFileInput(event.target.files);
              event.target.value = '';
            }}
          />
        </div>

        <div className="import-tools">
          <p>
            需要格式参考？下载一份示例模板，再用任意编辑器填写。
          </p>
          <button
            type="button"
            className="text-button"
            onClick={downloadTemplate}
          >
            <Download size={15} aria-hidden="true" />
            下载 JSON 模板
          </button>
        </div>

        {errors.length > 0 && (
          <div className="import-errors" role="alert">
            <div className="import-errors__title">
              <AlertTriangle size={17} aria-hidden="true" />
              文件无法导入
            </div>
            <ul>
              {errors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {errors.length > 8 && (
              <p>另外还有 {errors.length - 8} 个问题未显示。</p>
            )}
          </div>
        )}

        {plan && (
          <div className="import-preview">
            <div className="import-summary-grid">
              <div className="import-summary">
                <span>文件中的食物</span>
                <strong>{plan.total}</strong>
              </div>
              <div className="import-summary">
                <span>新增</span>
                <strong className="is-positive">{plan.newItems.length}</strong>
              </div>
              <div className="import-summary">
                <span>冲突</span>
                <strong className={plan.conflicts.length ? 'is-warning' : ''}>
                  {plan.conflicts.length}
                </strong>
              </div>
            </div>

            {plan.blockingErrors.length > 0 && (
              <div className="import-errors" role="alert">
                <div className="import-errors__title">
                  <AlertTriangle size={17} aria-hidden="true" />
                  需要先处理冲突
                </div>
                <ul>
                  {plan.blockingErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.conflicts.length > 0 && (
              <>
                <div className="conflict-list">
                  <div className="conflict-list__heading">
                    <span>与现有食物冲突</span>
                    <span>匹配方式</span>
                  </div>
                  {plan.conflicts.slice(0, 6).map((conflict) => (
                    <div
                      className="conflict-list__row"
                      key={`${conflict.incoming.name}-${conflict.existing.id}`}
                    >
                      <span>{conflict.incoming.name}</span>
                      <small>
                        {conflict.matchedBy === 'id' ? 'ID' : '名称'} ·{' '}
                        {conflict.existing.name}
                      </small>
                    </div>
                  ))}
                  {plan.conflicts.length > 6 && (
                    <p className="conflict-list__more">
                      还有 {plan.conflicts.length - 6} 个冲突未显示。
                    </p>
                  )}
                </div>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(event) => setOverwrite(event.target.checked)}
                  />
                  <span>
                    <strong>覆盖同名或同 ID 食物</strong>
                    <small>
                      不勾选时会保留现有食物并跳过冲突；勾选后会以文件内容更新。
                    </small>
                  </span>
                </label>
              </>
            )}

            <div className="import-ok">
              <CheckCircle2 size={17} aria-hidden="true" />
              校验通过，可以导入。导入过程会一次性写入，失败不会留下半份数据。
            </div>

            {importError && (
              <p className="form-error" role="alert">
                {importError}
              </p>
            )}
          </div>
        )}

        <p className="import-schema-note">
          JSON 格式版本为 1，包含名称、分类、基准状态和每 100g 营养数据。
          完整字段可在下载的模板中查看。
        </p>
      </div>
    </Modal>
  );
}
