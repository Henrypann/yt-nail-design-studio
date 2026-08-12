import {
  Eraser,
  Gem,
  Image,
  Layers3,
  LibraryBig,
  MousePointer2,
  Paintbrush,
  PaintBucket,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Type,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { cx } from '@/design-system';
import { selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import type { FlatVectorToolV7 } from '../v7/flat-vector';
import {
  deriveEditorWorkspaceToolsV7,
  type EditorWorkspaceToolAvailabilityV7,
  type EditorWorkspaceToolIdV7,
} from '../v7/workspace-ia';

const TOOL_META: Record<EditorWorkspaceToolIdV7, { label: string; icon: typeof MousePointer2; flatTool?: FlatVectorToolV7 }> = {
  select: { label: '选择', icon: MousePointer2, flatTool: 'select' },
  background: { label: '背景', icon: PaintBucket },
  brush: { label: '画笔', icon: Paintbrush, flatTool: 'brush' },
  eraser: { label: '橡皮', icon: Eraser, flatTool: 'eraser' },
  shape: { label: '图形', icon: Shapes, flatTool: 'rectangle' },
  text: { label: '文字', icon: Type },
  assets: { label: '素材', icon: Image },
  effects: { label: '效果', icon: Sparkles },
  decorations: { label: '立体', icon: Gem },
};

function toolButtonClass(active: boolean, horizontal: boolean): string {
  return cx(
    'group relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 aria-[disabled=true]:cursor-not-allowed aria-[disabled=true]:opacity-45',
    horizontal ? 'shrink-0 px-2' : 'w-12 flex-col gap-0.5 py-1',
    active ? 'border-primary bg-primary text-white shadow-sm' : 'border-transparent bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50',
  );
}

export function EditorToolRailV7({
  orientation = 'vertical',
  resourcesOpen,
  onToggleResources,
  onOpenPanel,
  onActivateTool,
  onBlockedTool,
}: {
  orientation?: 'vertical' | 'horizontal';
  resourcesOpen: boolean;
  onToggleResources(): void;
  onOpenPanel(tab: 'layers' | 'inspector'): void;
  onActivateTool(tool: EditorWorkspaceToolAvailabilityV7, trigger: HTMLButtonElement): void;
  onBlockedTool(tool: EditorWorkspaceToolAvailabilityV7, trigger: HTMLButtonElement): void;
}) {
  const nail = useEditorV7Store(selectCurrentNailV7);
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const activeFlatTool = useEditorV7Store((state) => state.activeFlatTool);
  const resourceMode = useEditorV7Store((state) => state.resourceMode);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const horizontal = orientation === 'horizontal';
  if (!nail) return null;

  const availability = deriveEditorWorkspaceToolsV7(nail, {
    selectedStepId: selectedStep?.id ?? null,
    readOnly,
    switching,
  });
  const moveToolFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    const previousKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (![previousKey, nextKey, 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.closest('nav')?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .filter((button) => button.getClientRects().length > 0);
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0 || buttons.length === 0) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === previousKey
          ? (currentIndex - 1 + buttons.length) % buttons.length
          : (currentIndex + 1) % buttons.length;
    buttons[nextIndex].focus();
    buttons[nextIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  return (
    <nav
      aria-label="设计工具"
      data-testid={`v7-tool-rail-${orientation}`}
      className={cx(
        'border-gray-200 bg-white',
        horizontal ? 'flex items-center gap-1 overflow-x-auto border-t px-2 py-1.5' : 'flex w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r px-2 py-2',
      )}
    >
      {availability.map((tool) => {
        const meta = TOOL_META[tool.id];
        const Icon = meta.icon;
        const reasonId = `v7-tool-reason-${orientation}-${tool.id}`;
        const active = tool.id === 'select'
          ? selectedStep?.kind === 'flat_design' && activeFlatTool === 'select'
          : tool.id === 'background'
          ? selectedStep?.kind === 'background'
          : tool.id === 'effects'
            ? selectedStep?.kind === 'surface_effect'
            : tool.id === 'decorations'
              ? selectedStep?.kind === 'dimensional_decoration'
          : tool.id === 'text' || tool.id === 'assets'
            ? selectedStep?.kind === 'flat_design' && resourcesOpen && resourceMode === tool.id
          : meta.flatTool !== undefined && selectedStep?.kind === 'flat_design' && activeFlatTool === meta.flatTool;
        return (
          <button
            key={tool.id}
            type="button"
            aria-disabled={!tool.enabled}
            aria-label={tool.enabled ? meta.label : `${meta.label}，${tool.reason ?? '当前不可用'}`}
            aria-describedby={!tool.enabled ? reasonId : undefined}
            aria-pressed={active}
            data-tool={tool.id}
            data-tool-id={tool.id}
            data-tool-status={tool.status}
            data-step-kind={tool.requiredStepKind}
            data-target-step-id={tool.targetStepId ?? undefined}
            title={tool.enabled ? meta.label : tool.reason}
            onClick={(event) => {
              if (tool.enabled) onActivateTool(tool, event.currentTarget);
              else onBlockedTool(tool, event.currentTarget);
            }}
            onKeyDown={moveToolFocus}
            className={toolButtonClass(active, horizontal)}
          >
            <Icon size={16} />
            {!horizontal && <span className="text-[9px] font-medium">{meta.label}</span>}
            {!tool.enabled && <span id={reasonId} className="sr-only">{tool.reason ?? '当前工具不可用'}</span>}
          </button>
        );
      })}

      <span className={cx('bg-gray-200', horizontal ? 'mx-1 h-7 w-px shrink-0' : 'my-1 h-px w-9')} aria-hidden="true" />
      <button type="button" aria-label="资源" aria-pressed={resourcesOpen} onClick={onToggleResources} onKeyDown={moveToolFocus} className={toolButtonClass(resourcesOpen, horizontal)} title="打开资源与预设">
        <LibraryBig size={16} />
        {!horizontal && <span className="text-[9px] font-medium">资源</span>}
      </button>
      <button type="button" aria-label="层级" onClick={() => onOpenPanel('layers')} onKeyDown={moveToolFocus} className={cx(toolButtonClass(false, horizontal), 'xl:hidden')} title="打开层级">
        <Layers3 size={16} />
        {!horizontal && <span className="text-[9px] font-medium">层级</span>}
      </button>
      <button type="button" aria-label="属性" onClick={() => onOpenPanel('inspector')} onKeyDown={moveToolFocus} className={cx(toolButtonClass(false, horizontal), 'xl:hidden')} title="打开属性">
        <SlidersHorizontal size={16} />
        {!horizontal && <span className="text-[9px] font-medium">属性</span>}
      </button>
    </nav>
  );
}
