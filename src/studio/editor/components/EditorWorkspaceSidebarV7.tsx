import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Layers3, SlidersHorizontal, X } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { LayerPanelV7 } from './LayerPanelV7';

export type EditorWorkspacePanelTabV7 = 'layers' | 'inspector';

export function EditorWorkspaceSidebarV7({
  compact,
  open,
  tab,
  onTabChange,
  onClose,
}: {
  compact: boolean;
  open: boolean;
  tab: EditorWorkspacePanelTabV7;
  onTabChange(tab: EditorWorkspacePanelTabV7): void;
  onClose(): void;
}) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (compact && open) closeRef.current?.focus();
  }, [compact, open]);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (!compact) {
    return (
      <aside className="grid h-full min-h-0 w-[clamp(220px,22vw,340px)] shrink-0 grid-rows-[minmax(260px,1.2fr)_minmax(180px,0.8fr)] border-l border-hairline bg-surface" data-testid="v7-workspace-sidebar" data-overlay-open="false">
        <div className="flex min-h-0 border-b border-gray-200"><LayerPanelV7 mode="tree" /></div>
        <div className="flex min-h-0"><LayerPanelV7 mode="inspector" /></div>
      </aside>
    );
  }

  if (!open) return null;
  return createPortal(
    <>
      <button type="button" className="fixed inset-0 z-[90] bg-gray-950/20 backdrop-blur-[1px]" aria-label={t('editorV7.sidebar.close')} onClick={onClose} />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={tab === 'layers' ? t('editorV7.sidebar.layersPanel') : t('editorV7.sidebar.propertiesPanel')}
        onKeyDown={trapFocus}
        className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden border border-hairline bg-surface shadow-modal min-[800px]:left-auto min-[800px]:w-[min(360px,42vw)]"
        data-testid="v7-workspace-sidebar"
        data-overlay-open="true"
      >
        <div className="flex items-center gap-1 border-b border-gray-200 p-2">
          <button type="button" aria-pressed={tab === 'layers'} onClick={() => onTabChange('layers')} className={cx('flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', tab === 'layers' ? 'bg-primary-soft text-primary' : 'text-gray-500 hover:bg-gray-50')}><Layers3 size={14} />{t('editorV7.tool.layers')}</button>
          <button type="button" aria-pressed={tab === 'inspector'} onClick={() => onTabChange('inspector')} className={cx('flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', tab === 'inspector' ? 'bg-primary-soft text-primary' : 'text-gray-500 hover:bg-gray-50')}><SlidersHorizontal size={14} />{t('editorV7.tool.properties')}</button>
          <button ref={closeRef} type="button" aria-label={t('editorV7.sidebar.close')} onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={16} /></button>
        </div>
        <div className="flex min-h-0 flex-1">{tab === 'layers' ? <LayerPanelV7 mode="tree" /> : <LayerPanelV7 mode="inspector" />}</div>
      </aside>
    </>,
    document.body,
  );
}
