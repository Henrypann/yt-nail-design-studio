import { ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../cx';
import { useLocale } from '@/lib/i18n';

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
  /** 嵌套在工作区侧栏之上时使用；默认层级和 Esc 行为保持不变。 */
  layer?: 'default' | 'workspace';
  /** 对话框稳定验收钩子；默认 modal-dialog */
  testId?: string;
}

const sizeClasses = {
  sm: 'max-w-[360px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[640px]',
} as const;

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex !== -1 && !el.hasAttribute('disabled'),
  );
}

/**
 * 模态弹窗：遮罩从第一帧起不透明并盖住页面；仅面板做 200ms 缩放淡入。
 * 打开时将 body 中除弹层外的兄弟节点标为 inert / aria-hidden，并陷阱焦点。
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  layer = 'default',
  testId = 'modal-dialog',
}: ModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = getFocusable(dialogRef.current);
    (focusable[0] ?? dialogRef.current)?.focus();

    const hidden: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child === overlay) continue;
      child.setAttribute('inert', '');
      child.setAttribute('aria-hidden', 'true');
      hidden.push(child);
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const child of hidden) {
        child.removeAttribute('inert');
        child.removeAttribute('aria-hidden');
      }
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (layer === 'workspace') {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = dialog.contains(active);
      if (e.shiftKey) {
        if (!inside || active === first || active === dialog) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [layer, open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={cx(
        'fixed inset-0 isolate flex items-center justify-center p-4',
        layer === 'workspace' ? 'z-[200]' : 'z-50',
      )}
      data-testid="modal-root"
    >
      <div
        className="absolute inset-0 bg-black/30 opacity-100"
        data-testid="modal-scrim"
        aria-hidden="true"
        onMouseDown={() => {
          if (closeOnOverlay) onClose();
        }}
      />
      <div
        ref={dialogRef}
        className={cx(
          'relative z-10 w-full rounded-panel bg-white opacity-100 shadow-modal animate-modal-in',
          sizeClasses[size],
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        data-testid={testId}
      >
        {(title || true) && (
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
            <h2 id={titleId} className="text-sm font-semibold text-gray-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-button p-1 text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700"
              aria-label={t('common.close')}
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
