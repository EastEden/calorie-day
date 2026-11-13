import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createId } from '../domain/id';

type ToastKind = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内使用');
  }
  return context;
}

const toastIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = createId('toast');
      setMessages((current) => {
        const next = [...current, { id, message, kind }];
        return next.length > 2 ? next.slice(next.length - 2) : next;
      });

      const duration = kind === 'error' ? 5200 : 2600;
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      for (const timer of timerMap.values()) {
        window.clearTimeout(timer);
      }
      timerMap.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {messages.map((message) => {
          const Icon = toastIcons[message.kind];
          return (
            <div
              key={message.id}
              className={`toast toast--${message.kind}`}
              role="status"
            >
              <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>{message.message}</span>
              <button
                type="button"
                className="toast__close"
                aria-label="关闭提示"
                onClick={() => dismiss(message.id)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
