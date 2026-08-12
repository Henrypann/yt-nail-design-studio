import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Ruler, X } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import type { NailLength, NailShape } from '@/lib/types';
import { LENGTHS, SHAPES, lengthName, shapeName } from '../lib/material';
import { useEditorV7Store } from '../store-v7';
import { resolveEditorGeometryV7 } from '../v7/geometry-registry';

export function EditorGeometryPanelV7({ onDismiss }: { onDismiss(): void }) {
  const toast = useToast();
  const doc = useEditorV7Store((state) => state.doc);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const setProductGeometry = useEditorV7Store((state) => state.setProductGeometry);
  const current = doc ? resolveEditorGeometryV7(doc.nails[currentFinger].geometryRef, currentFinger) : null;
  const initialShape = current?.status === 'resolved' ? current.shape : SHAPES[0];
  const initialLength = current?.status === 'resolved' ? current.length : LENGTHS[1];
  const [shape, setShape] = useState<NailShape>(initialShape);
  const [length, setLength] = useState<NailLength>(initialLength);

  useEffect(() => {
    if (current?.status !== 'resolved') return;
    setShape(current.shape);
    setLength(current.length);
  }, [current?.assetId, current?.revision, current?.status]);

  if (!doc || !shape || !length) return null;
  const unchanged = current?.status === 'resolved' && current.shape === shape && current.length === length;
  const disabled = readOnly || switching;
  const apply = () => {
    const result = setProductGeometry(shape, length);
    if (!result.ok) {
      if (result.reason !== 'not_allowed') toast.error(result.message);
      return;
    }
    toast.success(`已将十指切换为 ${shapeName(shape)} / ${lengthName(length)}`);
  };

  return (
    <section className="border-b border-info/20 bg-info-soft px-3 py-3 text-xs text-info" role="region" aria-label="编辑甲型与长度" data-testid="v7-geometry-editor">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80"><Ruler size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">编辑十指甲型与长度</p>
              <p className="mt-1 max-w-4xl leading-5 opacity-90">切换会在一个可撤销事务中更新十指 geometryRef。画笔、文字、效果与装饰继续使用 nail-local 坐标，并重新投影到新轮廓。</p>
            </div>
            <button type="button" aria-label="关闭甲型编辑" onClick={onDismiss} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={15} /></button>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] lg:items-end">
            <fieldset disabled={disabled}>
              <legend className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] opacity-65">甲型</legend>
              <div className="flex flex-wrap gap-1.5">
                {SHAPES.map((item) => <button key={item} type="button" aria-pressed={shape === item} onClick={() => setShape(item)} className={cx('min-h-11 min-w-11 rounded-xl border px-3 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', shape === item ? 'border-primary bg-white text-primary shadow-sm' : 'border-current/10 bg-white/60 text-gray-600')}>{shape === item && <Check size={12} className="mr-1 inline" />}{shapeName(item)}</button>)}
              </div>
            </fieldset>
            <fieldset disabled={disabled}>
              <legend className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] opacity-65">长度</legend>
              <div className="flex flex-wrap gap-1.5">
                {LENGTHS.map((item) => <button key={item} type="button" aria-pressed={length === item} onClick={() => setLength(item)} className={cx('min-h-11 min-w-11 rounded-xl border px-3 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', length === item ? 'border-primary bg-white text-primary shadow-sm' : 'border-current/10 bg-white/60 text-gray-600')}>{lengthName(item)}</button>)}
              </div>
            </fieldset>
            <Button disabled={disabled || unchanged} onClick={apply} className="min-h-11">应用到十指</Button>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 opacity-75"><AlertTriangle size={12} className="mt-0.5 shrink-0" />仅开放已签收 2D 产品轮廓；正式模板 SVG 会同步换成目标甲型资产。此操作不证明逐指扫描、物理贴合或制造可行性。</p>
        </div>
      </div>
    </section>
  );
}
