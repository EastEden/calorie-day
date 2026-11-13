import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { toPng } from 'html-to-image';
import {
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatLongDate, isToday } from '../../domain/dates';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../ui/ToastProvider';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { downloadDataUrl } from '../../utils/download';
import { ShareCard } from './ShareCard';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
}

type GenerationStatus = 'idle' | 'generating' | 'ready' | 'error';

interface ImageDimensions {
  width: number;
  height: number;
}

export function ShareModal({ open, onClose }: ShareModalProps) {
  const { currentLog, summary, selectedDate } = useApp();
  const { showToast } = useToast();
  const captureRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setImage(null);
      setError(null);
      setDimensions(null);
      return;
    }

    if (!currentLog || !summary.target || summary.entryCount === 0) {
      setStatus('error');
      setError('这一天的记录不足，暂时无法生成分享图。');
      return;
    }

    let cancelled = false;
    setStatus('generating');
    setImage(null);
    setError(null);
    setDimensions(null);

    async function generate() {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        const node = captureRef.current;
        if (!node) {
          throw new Error('没有找到分享图内容。');
        }

        const width = 402;
        const cssHeight = Math.ceil(node.getBoundingClientRect().height);
        if (!cssHeight || cssHeight < 1) {
          throw new Error('分享图内容高度异常。');
        }

        const dataUrl = await toPng(node, {
          width,
          height: cssHeight,
          pixelRatio: 3,
          backgroundColor: '#f4f1e8',
          cacheBust: true,
          skipFonts: true,
          style: {
            margin: '0',
            transform: 'none',
          },
        });

        if (cancelled) {
          return;
        }

        setImage(dataUrl);
        setStatus('ready');

        const preview = new Image();
        preview.onload = () => {
          if (!cancelled) {
            setDimensions({
              width: preview.naturalWidth,
              height: preview.naturalHeight,
            });
          }
        };
        preview.src = dataUrl;
      } catch (generationError) {
        if (cancelled) {
          return;
        }
        setStatus('error');
        setError(
          generationError instanceof Error
            ? generationError.message
            : '图片生成失败，请重试。',
        );
      }
    }

    void generate();

    return () => {
      cancelled = true;
    };
  }, [currentLog, open, retryToken, selectedDate, summary]);

  const saveImage = () => {
    if (!image) {
      return;
    }
    downloadDataUrl(`nutrition-${selectedDate}.png`, image);
    showToast('分享图已开始下载。');
  };

  const title = isToday(selectedDate)
    ? '分享今日营养'
    : `分享 ${formatLongDate(selectedDate)} 的营养`;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={title}
        description="固定 1206px 宽的竖版长图，高度随餐食内容自动增加。"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              关闭
            </Button>
            <Button
              icon={<Download size={16} />}
              onClick={saveImage}
              disabled={!image}
            >
              保存 PNG
            </Button>
          </>
        }
      >
        <div className="share-modal">
          {status === 'generating' && (
            <div className="share-generating" role="status">
              <span className="share-generating__spinner">
                <Loader2 size={24} />
              </span>
              <strong>正在生成分享图</strong>
              <p>正在把你的今日营养排成一张长图，请稍候。</p>
            </div>
          )}

          {status === 'error' && (
            <div className="share-generation-error" role="alert">
              <span className="share-generation-error__icon">
                <ImageIcon size={24} aria-hidden="true" />
              </span>
              <strong>这次没有生成成功</strong>
              <p>{error}</p>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={15} />}
                onClick={() => setRetryToken((value) => value + 1)}
              >
                重新生成
              </Button>
            </div>
          )}

          {status === 'ready' && image && (
            <>
              <div className="share-preview">
                <img
                  className="share-preview__image"
                  src={image}
                  alt="今日营养分享图预览"
                />
              </div>
              <div className="share-preview__meta">
                <span>
                  {dimensions
                    ? `${dimensions.width} × ${dimensions.height}px`
                    : '1206px 宽'}
                </span>
                <span>在 iPhone 上也可以长按预览图保存</span>
              </div>
            </>
          )}

          {!currentLog && (
            <div className="share-generation-error" role="alert">
              <p>记录还没有加载完成，请关闭后再试。</p>
            </div>
          )}
        </div>
      </Modal>

      {open && currentLog && (
        <div className="share-render-host" aria-hidden="true">
          <div className="share-capture" ref={captureRef}>
            <ShareCard
              summary={summary}
              log={currentLog}
              date={selectedDate}
            />
          </div>
        </div>
      )}
    </>
  );
}
