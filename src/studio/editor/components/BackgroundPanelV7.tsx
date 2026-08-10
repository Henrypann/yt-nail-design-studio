import { useEffect, useMemo, useState } from 'react';
import { Pipette, SlidersHorizontal } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { PALETTE } from '../lib/material';
import { selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import {
  isAdvancedBackgroundModeV7,
  parseHexColorV7,
  representativeBackgroundColorV7,
  rgbaToHexV7,
  type EditorV7BackgroundModeV7,
} from '../v7/background';

const MODE_LABELS: Record<EditorV7BackgroundModeV7, string> = {
  solid: '单色',
  translucent: '透色',
};

export function BackgroundPanelV7() {
  const toast = useToast();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const setMode = useEditorV7Store((state) => state.setBackgroundMode);
  const setColor = useEditorV7Store((state) => state.setBackgroundColor);
  const setOpacity = useEditorV7Store((state) => state.setBackgroundOpacity);

  const background = step?.kind === 'background' ? step.background : null;
  const representative = useMemo(
    () => background ? representativeBackgroundColorV7(background) : null,
    [background],
  );
  const canonicalHex = representative ? rgbaToHexV7(representative) : '#000000';
  const canonicalOpacity = background ? Math.round(background.opacity * 100) : 100;
  const [hexDraft, setHexDraft] = useState(canonicalHex);
  const [hexError, setHexError] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState(canonicalOpacity);

  useEffect(() => {
    setHexDraft(canonicalHex);
    setHexError(null);
  }, [canonicalHex, currentFinger]);

  useEffect(() => setOpacityDraft(canonicalOpacity), [canonicalOpacity, currentFinger]);

  if (!background || !step) return null;

  const advanced = isAdvancedBackgroundModeV7(background.mode);
  const canEdit = !readOnly && !switching && !step.locked;
  const canEditColor = canEdit && !advanced;

  const report = (result: ReturnType<typeof setColor>) => {
    if (!result.ok && result.reason !== 'not_allowed') toast.error(result.message);
  };

  const applyHex = (value: string) => {
    const parsed = parseHexColorV7(value);
    if (!parsed) {
      setHexError('请输入 6 位十六进制颜色，例如 #C94C65');
      return;
    }
    setHexDraft(rgbaToHexV7(parsed));
    setHexError(null);
    if (rgbaToHexV7(parsed) !== canonicalHex) report(setColor(currentFinger, parsed));
  };

  const applyOpacity = () => {
    const bounded = Math.min(100, Math.max(0, Math.round(opacityDraft)));
    setOpacityDraft(bounded);
    if (bounded !== canonicalOpacity) report(setOpacity(currentFinger, bounded / 100));
  };

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-primary/15 bg-primary-soft/30 p-3" data-testid="v7-background-panel">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">背景铺色</p>
        <p className="mt-1 text-[10px] leading-4 text-gray-500">只修改 {currentFinger}；颜色与透明度分别保存，可撤销。</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1" aria-label="背景模式">
        {(['solid', 'translucent'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={!canEdit || background.mode === mode}
            aria-pressed={background.mode === mode}
            onClick={() => report(setMode(currentFinger, mode))}
            className={cx(
              'min-h-11 rounded-lg px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed',
              background.mode === mode ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50 disabled:opacity-45',
            )}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {advanced && (
        <p className="rounded-lg border border-warning/20 bg-warning-soft px-2.5 py-2 text-[10px] leading-4 text-warning">
          当前为 {background.mode} 背景。选择“单色”或“透色”会用代表色显式转换；原效果可通过撤销恢复。
        </p>
      )}
      {background.mode === 'translucent' && (
        <p className="rounded-lg border border-info/20 bg-info-soft px-2.5 py-2 text-[10px] leading-4 text-info">
          2D 透色为近似预览，屏幕透明度不代表真实材料透光率。
        </p>
      )}

      <fieldset disabled={!canEditColor} className="space-y-2 disabled:opacity-45">
        <legend className="text-[10px] font-semibold text-gray-600">基础色板</legend>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-4">
          {PALETTE.map((color) => {
            const active = color.hex.toLowerCase() === canonicalHex;
            return (
              <button
                key={color.id}
                type="button"
                aria-label={`设置背景颜色 ${color.name} ${color.hex}`}
                aria-pressed={active}
                title={`${color.name} · ${color.hex}`}
                onClick={() => applyHex(color.hex)}
                className={cx(
                  'h-11 min-w-11 rounded-full border border-gray-300 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  active && 'ring-2 ring-primary ring-offset-2',
                )}
                style={{ backgroundColor: color.hex }}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-[44px_1fr] gap-2">
          <label className="relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-gray-300 bg-white" title="打开系统颜色选择器">
            <Pipette size={15} className="pointer-events-none absolute z-10 text-white drop-shadow" />
            <span className="absolute inset-1 rounded-md" style={{ backgroundColor: canonicalHex }} />
            <input
              type="color"
              value={canonicalHex}
              aria-label="选择背景颜色"
              onChange={(event) => applyHex(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <input
            value={hexDraft}
            aria-label="背景十六进制颜色"
            spellCheck={false}
            onChange={(event) => setHexDraft(event.target.value)}
            onBlur={() => applyHex(hexDraft)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                setHexDraft(canonicalHex);
                setHexError(null);
                event.currentTarget.blur();
              }
            }}
            className={cx(
              'h-11 min-w-0 rounded-lg border bg-white px-3 font-mono text-xs uppercase text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              hexError ? 'border-error' : 'border-gray-300',
            )}
          />
        </div>
        <p className={cx('text-[10px] leading-4', hexError ? 'text-error' : 'text-gray-500')} role={hexError ? 'alert' : undefined}>
          {hexError ?? '取色只写入 canonical sRGB，不采样 3D 灯光、高光或阴影。'}
        </p>
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-600"><SlidersHorizontal size={13} />背景透明度</span>
          <span className="text-xs font-semibold tabular-nums text-gray-800">{opacityDraft}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={opacityDraft}
          disabled={!canEdit}
          aria-label="背景透明度"
          onChange={(event) => setOpacityDraft(Number(event.target.value))}
          onPointerUp={applyOpacity}
          onKeyUp={applyOpacity}
          onBlur={applyOpacity}
          className="h-11 w-full accent-primary disabled:cursor-not-allowed disabled:opacity-45"
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-600">高级背景 · V7-06</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {['渐变', '猫眼', '闪粉'].map((label) => (
            <button key={label} type="button" disabled className="min-h-11 rounded-lg border border-dashed border-gray-300 bg-white text-[10px] text-gray-400">
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
