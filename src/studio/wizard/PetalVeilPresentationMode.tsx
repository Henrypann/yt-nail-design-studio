import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Badge } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { RecipeInstanceV1 } from '@/studio/editor/lib/recipe-model';
import {
  PetalVeilPresentationCanvas,
  PetalVeilSinglePreview,
} from '@/studio/petal-veil/PetalVeilPreview';

export function PetalVeilPresentationMode({
  open,
  onClose,
  recipe,
}: {
  open: boolean;
  onClose: () => void;
  recipe: RecipeInstanceV1;
}) {
  const { t } = useLocale();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const underlay = document.querySelector<HTMLElement>('[data-testid="wizard-canvas-first"]');
    underlay?.setAttribute('inert', '');
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => closeButtonRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); underlay?.removeAttribute('inert'); previousFocusRef.current?.focus(); };
  }, [onClose, open]);

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
      data-debug-id="studio.presentation.petal-hq"
      role="dialog"
      aria-modal="true"
      aria-label={`${t('customer.customerPresentation')} Petal Veil`}
      onKeyDown={trapFocus}
    >
      <header className="flex shrink-0 flex-col items-stretch gap-3 px-4 py-5 sm:px-8 lg:flex-row lg:items-center">
        <div>
          <p className="text-lg font-medium tracking-tight text-gray-900">{t('wizard.petalVeilFrench')}</p>
          <p className="text-xs text-gray-500">{t('wizard.petalVeilPresentationSpec')}</p>
        </div>
        <Badge variant="warning">{t('wizard.hqCandidate')}</Badge>
        <Badge variant="gray">{t('app.manufacturingUnverified')}</Badge>
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2 overflow-x-auto">
          <span className="text-nano text-gray-400">Esc {t('common.close')}</span>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.7fr)] lg:gap-6">
        <section className="min-h-0 overflow-hidden rounded-card border border-white/80 bg-white/45 shadow-card">
          <PetalVeilPresentationCanvas recipe={recipe} />
        </section>
        <section className="min-h-0">
          <PetalVeilSinglePreview recipe={recipe} finger="R4" />
        </section>
      </main>
    </div>,
    document.body,
  );
}
