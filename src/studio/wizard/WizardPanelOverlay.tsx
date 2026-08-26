import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function WizardPanelOverlay({
  open,
  title,
  side,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  side: 'left' | 'bottom';
  onClose(): void;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const underlay = document.querySelector<HTMLElement>('[data-testid="wizard-canvas-first"]');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    underlay?.setAttribute('inert', '');
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      underlay?.removeAttribute('inert');
    };
  }, [open]);

  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return createPortal(
    <div className={cx('fixed inset-0 z-[110]')}>
      <button type="button" className="absolute inset-0 bg-gray-950/30 backdrop-blur-[1px]" aria-label={`${t('common.close')}${title}`} onClick={onClose} />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={trapFocus}
        className={cx(
          'absolute flex min-h-0 flex-col overflow-hidden border-hairline bg-surface shadow-modal',
          side === 'left'
            ? 'inset-y-0 left-0 w-[min(320px,calc(100vw-48px))] border-r'
            : 'inset-x-0 bottom-0 max-h-[72dvh] rounded-t-2xl border-t',
        )}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline px-4">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button ref={closeRef} type="button" aria-label={`${t('common.close')}${title}`} onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-mute hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary">
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
