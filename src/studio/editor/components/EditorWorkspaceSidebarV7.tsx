import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Layers3, SlidersHorizontal, X } from 'lucide-react';
import { cx } from '@/design-system';
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
      <aside className="grid h-full min-h-0 w-[340px] shrink-0 grid-rows-[minmax(220px,0.9fr)_minmax(280px,1.1fr)] border-l border-gray-200 bg-white" data-testid="v7-workspace-sidebar" data-overlay-open="false">
        <div className="flex min-h-0 border-b border-gray-200"><LayerPanelV7 mode="tree" /></div>
        <div className="flex min-h-0"><LayerPanelV7 mode="inspector" /></div>
      </aside>
    );
  }

  if (!open) return null;
  return createPortal(
    <>
      <button type="button" className="fixed inset-0 z-[90] bg-gray-950/20 backdrop-blur-[1px]" aria-label="关闭工作区面板" onClick={onClose} />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={tab === 'layers' ? '层级面板' : '属性面板'}
        onKeyDown={trapFocus}
        className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden border border-gray-200 bg-white shadow-modal md:left-auto md:w-[360px]"
        data-testid="v7-workspace-sidebar"
        data-overlay-open="true"
      >
        <div className="flex items-center gap-1 border-b border-gray-200 p-2">
          <button type="button" aria-pressed={tab === 'layers'} onClick={() => onTabChange('layers')} className={cx('flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', tab === 'layers' ? 'bg-primary-soft text-primary' : 'text-gray-500 hover:bg-gray-50')}><Layers3 size={14} />层级</button>
          <button type="button" aria-pressed={tab === 'inspector'} onClick={() => onTabChange('inspector')} className={cx('flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', tab === 'inspector' ? 'bg-primary-soft text-primary' : 'text-gray-500 hover:bg-gray-50')}><SlidersHorizontal size={14} />属性</button>
          <button ref={closeRef} type="button" aria-label="关闭工作区面板" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={16} /></button>
        </div>
        <div className="flex min-h-0 flex-1">{tab === 'layers' ? <LayerPanelV7 mode="tree" /> : <LayerPanelV7 mode="inspector" />}</div>
      </aside>
    </>,
    document.body,
  );
}
