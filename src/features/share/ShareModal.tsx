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
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();
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
      setError(t('share.insufficient'));
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
          throw new Error(t('share.noContent'));
        }

        const width = 402;
        const cssHeight = Math.ceil(node.getBoundingClientRect().height);
        if (!cssHeight || cssHeight < 1) {
          throw new Error(t('share.invalidHeight'));
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
            : t('share.generateFailed'),
        );
      }
    }

    void generate();

    return () => {
      cancelled = true;
    };
  }, [currentLog, open, retryToken, selectedDate, summary, t]);

  const saveImage = () => {
    if (!image) {
      return;
    }
    downloadDataUrl(`nutrition-${selectedDate}.png`, image);
    showToast(t('share.downloadStarted'));
  };

  const title = isToday(selectedDate)
    ? t('share.titleToday')
    : t('share.titleDate', { date: formatLongDate(selectedDate) });

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={title}
        description={t('share.description')}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('share.close')}
            </Button>
            <Button
              icon={<Download size={16} />}
              onClick={saveImage}
              disabled={!image}
            >
              {t('share.save')}
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
              <strong>{t('share.generatingTitle')}</strong>
              <p>{t('share.generatingBody')}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="share-generation-error" role="alert">
              <span className="share-generation-error__icon">
                <ImageIcon size={24} aria-hidden="true" />
              </span>
              <strong>{t('share.errorTitle')}</strong>
              <p>{error}</p>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={15} />}
                onClick={() => setRetryToken((value) => value + 1)}
              >
                {t('share.retry')}
              </Button>
            </div>
          )}

          {status === 'ready' && image && (
            <>
              <div className="share-preview">
                <img
                  className="share-preview__image"
                  src={image}
                  alt={t('share.imageAlt')}
                />
              </div>
              <div className="share-preview__meta">
                <span>
                  {dimensions
                    ? `${dimensions.width} × ${dimensions.height}px`
                    : t('share.widthOnly')}
                </span>
                <span>{t('share.saveHint')}</span>
              </div>
            </>
          )}

          {!currentLog && (
            <div className="share-generation-error" role="alert">
              <p>{t('share.loading')}</p>
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
