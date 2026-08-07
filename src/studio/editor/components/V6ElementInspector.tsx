import { Copy, Eye, EyeOff, FlipHorizontal2, Lock, Trash2, Unlock } from 'lucide-react';
import { Button } from '@/design-system';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { useEditorV6Store } from '../store-v6';
import { readElementTransform } from '../v6/interaction';

export function V6ElementInspector() {
  const { text } = useLocale();
  const state = useEditorV6Store();
  const targetFinger = useStateFinger(state.currentFinger);
  const layer = state.doc?.nails[state.currentFinger].layers.find((candidate) => candidate.id === state.activeLayerId);
  const element = layer?.elements.find((candidate) => candidate.id === state.selectedElementId);

  if (!element) {
    return <p className="p-3 text-xs leading-5 text-gray-500">{text('选择画布元素后可调整位置、缩放、旋转与逐指复制。', 'Select a canvas element to edit its position, scale, rotation, or finger placement.')}</p>;
  }

  const transform = readElementTransform(element);
  const blocked = state.readOnly || Boolean(layer?.locked) || element.locked;
  const updateNumber = (key: 'x' | 'y' | 'scale' | 'rotation', value: string) => {
    const number = Number(value);
    if (Number.isFinite(number)) state.updateSelectedElementTransform({ [key]: number });
  };

  return (
    <div className="space-y-3 border-t border-gray-200 p-3" data-debug-id="studio.editor.element-inspector-v6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-gray-700">{String(element.name ?? element.kind)}</p>
          <p className="text-[10px] text-gray-400">{element.domain} · {element.kind}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" disabled={state.readOnly || layer?.locked} onClick={state.toggleSelectedElementVisible} title={element.visible ? text('隐藏元素', 'Hide element') : text('显示元素', 'Show element')} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
            {element.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button type="button" disabled={state.readOnly || layer?.locked} onClick={state.toggleSelectedElementLocked} title={element.locked ? text('解锁元素', 'Unlock element') : text('锁定元素', 'Lock element')} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
            {element.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['x', 'y'] as const).map((key) => (
          <label key={key} className="text-[10px] uppercase text-gray-500">{key}
            <input type="number" value={Math.round(transform[key] * 10) / 10} disabled={blocked} onChange={(event) => updateNumber(key, event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100" />
          </label>
        ))}
      </div>
      <label className="block text-[10px] text-gray-500">{text('缩放', 'Scale')} · {transform.scale.toFixed(2)}
        <input type="range" min="0.15" max="4" step="0.05" value={transform.scale} disabled={blocked} onChange={(event) => updateNumber('scale', event.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-[10px] text-gray-500">{text('旋转', 'Rotation')} · {Math.round(transform.rotation)}°
        <input type="range" min="-180" max="180" step="1" value={transform.rotation} disabled={blocked} onChange={(event) => updateNumber('rotation', event.target.value)} className="mt-1 w-full" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="ghost" disabled={blocked} onClick={state.duplicateSelectedElement}><Copy size={13} /> {text('复制元素', 'Duplicate')}</Button>
        <Button size="sm" variant="ghost" disabled={blocked} onClick={() => state.removeElementFromCurrentLayer(element.id)}><Trash2 size={13} /> {text('删除', 'Delete')}</Button>
      </div>

      <div className="rounded-button border border-gray-200 bg-gray-50 p-2">
        <p className="text-[10px] font-medium text-gray-600">{text('逐指编排', 'Finger placement')}</p>
        <div className="mt-2 flex gap-2">
          <select value={targetFinger.value} onChange={(event) => targetFinger.set(event.target.value as FingerCode)} className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs">
            {FINGER_CODES.filter((finger) => finger !== state.currentFinger).map((finger) => <option key={finger}>{finger}</option>)}
          </select>
          <Button size="sm" variant="ghost" disabled={state.readOnly || !layer} onClick={() => layer && state.copyLayerToFinger(layer.id, targetFinger.value)}>{text('复制图层', 'Copy layer')}</Button>
        </div>
        <Button size="sm" variant="ghost" className="mt-2 w-full" disabled={state.readOnly || !layer || layer.typeId === 'builtin.base_surface'} onClick={state.mirrorActiveLayerToOpposite}>
          <FlipHorizontal2 size={13} /> {text('镜像到对侧同指', 'Mirror to opposite finger')}
        </Button>
      </div>
    </div>
  );
}

function useStateFinger(current: FingerCode) {
  const fallback = FINGER_CODES.find((finger) => finger !== current) ?? 'L1';
  const [value, set] = useState<FingerCode>(fallback);
  useEffect(() => {
    if (value === current) set(FINGER_CODES.find((finger) => finger !== current) ?? 'L1');
  }, [current, value]);
  return { value, set };
}
import { useEffect, useState } from 'react';
