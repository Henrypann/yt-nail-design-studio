import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cx } from '../cx';

/** Toast 四型（PRD §七） */
export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastOptions {
  /** 覆盖自动消失毫秒数；error 默认 5000 */
  duration?: number;
}

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

/** 自动消失时长（PRD §七）：success 3s / warning 5s / error 5s+手动关闭 / info 3s */
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  warning: 5000,
  error: 5000,
  info: 3000,
};

const typeStyles: Record<ToastType, { bar: string; icon: typeof Info; iconColor: string }> = {
  success: { bar: 'bg-success', icon: CheckCircle2, iconColor: 'text-success' },
  warning: { bar: 'bg-warning', icon: AlertTriangle, iconColor: 'text-warning' },
  error: { bar: 'bg-error', icon: XCircle, iconColor: 'text-error' },
  info: { bar: 'bg-info', icon: Info, iconColor: 'text-info' },
};

export interface ToastApi {
  success: (message: string, opts?: ToastOptions) => void;
  warning: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
  info: (message: string, opts?: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** 全局 Toast：页面顶部居中、距顶 24px、同时最多 1 条、左侧 4px 状态色竖条 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, opts?: ToastOptions) => {
      dismiss(); // 同时最多 1 条：新条替换旧条
      const duration = opts?.duration ?? DEFAULT_DURATION[type];
      const id = ++idRef.current;
      setToast({ id, type, message, duration });
      timerRef.current = window.setTimeout(() => {
        setToast((cur) => (cur && cur.id === id ? null : cur));
        timerRef.current = null;
      }, duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => show('success', m, o),
      warning: (m, o) => show('warning', m, o),
      error: (m, o) => show('error', m, o),
      info: (m, o) => show('info', m, o),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast &&
        createPortal(
          <div
            key={toast.id}
            className="fixed left-1/2 top-6 z-[60] flex max-w-[480px] -translate-x-1/2 items-stretch overflow-hidden rounded-panel bg-white shadow-modal animate-toast-in"
            role="status"
          >
            <div className={cx('w-1 shrink-0', typeStyles[toast.type].bar)} />
            <div className="flex items-center gap-2 py-2.5 pl-3 pr-2">
              {(() => {
                const Icon = typeStyles[toast.type].icon;
                return <Icon size={16} className={cx('shrink-0', typeStyles[toast.type].iconColor)} />;
              })()}
              <span className="text-sm text-gray-800">{toast.message}</span>
              <button
                onClick={dismiss}
                className="ml-1 rounded-button p-1 text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700"
                aria-label="关闭通知"
              >
                <X size={14} />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 <ToastProvider> 内使用');
  return ctx;
}
