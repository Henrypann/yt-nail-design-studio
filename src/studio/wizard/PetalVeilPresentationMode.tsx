import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge } from '@/design-system';
import type { DesignStatus } from '@/lib/types';
import type { RecipeInstanceV1 } from '@/studio/editor/lib/recipe-model';
import {
  PetalVeilPresentationCanvas,
  PetalVeilSinglePreview,
} from '@/studio/petal-veil/PetalVeilPreview';

export function PetalVeilPresentationMode({
  open,
  onClose,
  recipe,
  status,
  onMarkConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  recipe: RecipeInstanceV1;
  status: DesignStatus;
  onMarkConfirmed?: () => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirming(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;
  const confirmed = status !== 'draft';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#F7F3EE]"
      data-debug-id="studio.presentation.petal-hq"
      role="dialog"
      aria-label="Petal Veil 顾客展示"
    >
      <header className="flex shrink-0 items-center gap-3 px-8 py-5">
        <div>
          <p className="text-lg font-medium tracking-tight text-gray-900">Petal Veil French</p>
          <p className="text-xs text-gray-500">Almond · Medium · 重点手指 R4</p>
        </div>
        <Badge variant="warning">高保真候选 · 待视觉签收</Badge>
        <Badge variant="gray">制造未验证</Badge>
        {confirmed && <Badge variant="blue"><Check size={11} /> 顾客已确认</Badge>}
        <div className="ml-auto flex items-center gap-2">
          {!confirmed && onMarkConfirmed && (
            confirming ? (
              <div className="flex items-center gap-2 rounded-panel border border-primary/30 bg-white px-3 py-2 shadow-modal">
                <span className="text-xs text-gray-600">确认后设计冻结为只读。</span>
                <button
                  type="button"
                  disabled={marking}
                  onClick={async () => {
                    setMarking(true);
                    const ok = await onMarkConfirmed();
                    setMarking(false);
                    if (ok) setConfirming(false);
                  }}
                  className="rounded-button bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {marking ? '标记中…' : '确认标记'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="px-2 py-1 text-xs text-gray-500">
                  再等等
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 rounded-button border border-primary/30 bg-white px-3 py-2 text-xs font-medium text-primary"
              >
                <Check size={13} />
                顾客已确认
              </button>
            )
          )}
          <span className="text-[11px] text-gray-400">Esc 退出</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="退出顾客展示"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.7fr)_minmax(320px,0.7fr)] gap-6 px-8 pb-8">
        <section className="min-h-0 overflow-hidden rounded-card border border-white/80 bg-white/45 shadow-card">
          <PetalVeilPresentationCanvas recipe={recipe} />
        </section>
        <section className="min-h-0">
          <PetalVeilSinglePreview recipe={recipe} finger="R4" />
        </section>
      </main>
    </div>
  );
}
