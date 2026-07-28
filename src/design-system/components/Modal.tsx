import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../cx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 宽度档位，默认 md(480px) */
  size?: 'sm' | 'md' | 'lg';
  /** 点击遮罩是否关闭，默认 true */
  closeOnOverlay?: boolean;
}

const sizeClasses = {
  sm: 'max-w-[360px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[640px]',
} as const;

/** 模态弹窗：遮罩淡入 + 面板缩放淡入（200ms ease-out），Esc 关闭 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cx(
          'w-full rounded-panel bg-white shadow-modal animate-modal-in',
          sizeClasses[size],
        )}
      >
        {(title || true) && (
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-button p-1 text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700"
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 text-sm text-gray-700">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
