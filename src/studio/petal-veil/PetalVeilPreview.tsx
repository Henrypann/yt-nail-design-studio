import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, cx } from '@/design-system';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import type { RecipeInstanceV1 } from '@/studio/editor/lib/recipe-model';
import { registerPreviewExporter } from '@/studio/preview/export-png';
import { compilePetalVeilAppearance, compilePetalVeilSet } from './appearance';
import type { PetalVeilRenderer, PetalVeilSceneMode } from './three-renderer';

interface CanvasProps {
  recipe: RecipeInstanceV1;
  mode: PetalVeilSceneMode;
  finger?: FingerCode;
  registerExport?: boolean;
  className?: string;
}
const PETAL_RENDERER_REVISION = 2;

function PetalVeilCanvas({
  recipe,
  mode,
  finger = 'R4',
  registerExport = false,
  className,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PetalVeilRenderer | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const models = useMemo(
    () => (mode === 'single' ? [compilePetalVeilAppearance(recipe, finger)] : compilePetalVeilSet(recipe)),
    [finger, mode, recipe],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setState('error');
      return;
    }
    setState('loading');
    let cancelled = false;
    let renderer: PetalVeilRenderer | null = null;
    let resize: ResizeObserver | null = null;
    const onLost = (event: Event) => {
      event.preventDefault();
      setState('error');
    };

    void import('./three-renderer').then((rendererModule) => {
      if (cancelled) return;
      if (!rendererModule.supportsPetalVeilWebGL()) {
        setState('error');
        return;
      }
      renderer = new rendererModule.PetalVeilRenderer(canvas, models, mode);
      rendererRef.current = renderer;
      resize = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect) renderer?.resize(rect.width, rect.height);
      });
      resize.observe(canvas);
      canvas.addEventListener('webglcontextlost', onLost);
      if (registerExport) {
        registerPreviewExporter({
          rendererId: 'three-pbr/petal-veil-1',
          isReady: () => Boolean(rendererRef.current),
          renderPng: () => renderer!.renderPng(2400, 1600),
          renderThumbnail: () => renderer!.renderPng(640, 426),
        });
      }
      setState('ready');
    }).catch(() => {
      if (!cancelled) setState('error');
    });

    return () => {
      cancelled = true;
      resize?.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      if (registerExport) registerPreviewExporter(null);
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, [mode, models, registerExport, retryKey, PETAL_RENDERER_REVISION]);

  if (state === 'error') {
    return (
      <div
        className={cx(
          'flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-card border border-error/30 bg-error-soft px-6 text-center',
          className,
        )}
        role="alert"
        data-testid="petal-hq-unavailable"
      >
        <p className="text-sm font-medium text-error">模拟 3D 预览不可用</p>
        <p className="max-w-sm text-xs leading-relaxed text-gray-600">
          当前区域没有渲染 2D 内容。请返回并切换到标准 2D 预览；模拟 3D 不代表物理适配或制造验证。
        </p>
        <Button size="sm" variant="secondary" onClick={() => setRetryKey((key) => key + 1)}>
          重试模拟 3D
        </Button>
      </div>
    );
  }

  return (
    <div className={cx('relative h-full min-h-[280px] overflow-hidden rounded-card bg-[#D8D0CA]', className)}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        data-testid={`petal-hq-${mode}`}
        data-renderer="three-pbr/petal-veil-1"
      />
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#D8D0CA] text-xs text-gray-500">
          正在生成高保真预览…
        </div>
      )}
    </div>
  );
}

export function PetalVeilTiledPreview({
  recipe,
  selectedFinger,
  onFingerClick,
  onOpenSingle,
  registerExport = true,
  showControls = true,
}: {
  recipe: RecipeInstanceV1;
  selectedFinger?: FingerCode | null;
  onFingerClick?: (finger: FingerCode) => void;
  onOpenSingle?: (finger: FingerCode) => void;
  registerExport?: boolean;
  showControls?: boolean;
}) {
  return (
    <div className="relative h-full min-h-[420px]" data-debug-id="studio.preview.petal-hq-tiled">
      <PetalVeilCanvas recipe={recipe} mode="tiled" registerExport={registerExport} />
      {showControls && <div className="pointer-events-none absolute inset-x-0 bottom-3 grid grid-cols-5 gap-x-3 px-6">
        {FINGER_CODES.map((finger) => (
          <button
            key={finger}
            type="button"
            className={cx(
              'pointer-events-auto h-8 rounded-button text-nano font-medium transition-colors',
              selectedFinger === finger ? 'bg-primary text-white' : 'bg-white/80 text-gray-500 hover:bg-white',
            )}
            onClick={() => onFingerClick?.(finger)}
            onDoubleClick={() => onOpenSingle?.(finger)}
          >
            {finger}{finger === 'R4' ? ' · 花' : ''}
          </button>
        ))}
      </div>}
    </div>
  );
}

export function PetalVeilSinglePreview({
  recipe,
  finger = 'R4',
  onExit,
  registerExport = false,
}: {
  recipe: RecipeInstanceV1;
  finger?: FingerCode;
  onExit?: () => void;
  registerExport?: boolean;
}) {
  const model = compilePetalVeilAppearance(recipe, finger);
  return (
    <div className="flex h-full min-h-[440px] flex-col gap-3 rounded-card border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{finger} · 单指细节</p>
          <p className="text-nano text-gray-400">{model.appearanceChecksum}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="warning">HQ 候选 · 待视觉签收</Badge>
          {onExit && <Button size="sm" variant="ghost" onClick={onExit}>返回十指</Button>}
        </div>
      </div>
      <PetalVeilCanvas recipe={recipe} mode="single" finger={finger} registerExport={registerExport} className="flex-1" />
      <p className="text-center text-xs text-gray-500">
        奶雾裸透底 · 柔边微法式{finger === 'R4' ? ' · 五瓣低浮雕花 0.18mm' : ''}
      </p>
    </div>
  );
}

export function PetalVeilPresentationCanvas({ recipe }: { recipe: RecipeInstanceV1 }) {
  return <PetalVeilCanvas recipe={recipe} mode="presentation" className="h-full" />;
}
