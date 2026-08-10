import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Palette, Pipette, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { PALETTE } from '../lib/material';
import { selectCurrentStepV7, useEditorV7Store, type EditorV7ActionResult } from '../store-v7';
import type { GradientStopV7, RgbaColorV7 } from '../v7/model';
import {
  EDITOR_V7_ADVANCED_BACKGROUND_MODES,
  hashBackgroundSeedV7,
  isAdvancedBackgroundModeV7,
  parseHexColorV7,
  representativeBackgroundColorV7,
  rgbaToHexV7,
  type EditorV7BackgroundModeAnyV7,
  type EditorV7PaletteThemeV7,
} from '../v7/background';

const MODE_LABELS: Record<EditorV7BackgroundModeAnyV7, string> = {
  solid: '单色',
  translucent: '透色',
  gradient: '渐变',
  cat_eye: '猫眼',
  glitter: '闪粉',
};

function materialThemes(): EditorV7PaletteThemeV7[] {
  const valid = PALETTE.map((entry) => ({ entry, color: parseHexColorV7(entry.hex) }))
    .filter((item): item is { entry: (typeof PALETTE)[number]; color: RgbaColorV7 } => item.color !== null);
  const definitions = [
    { id: 'material.soft', name: '柔雾裸粉', colorIds: ['c_nude_pink', 'c_milky_white', 'c_dusty_rose'] },
    { id: 'material.berry', name: '浆果夜色', colorIds: ['c_dusty_rose', 'c_berry', 'c_wine', 'c_deep_plum'] },
    { id: 'material.earth', name: '暖调大地', colorIds: ['c_nude_pink', 'c_caramel', 'c_grey_taupe'] },
  ];
  return definitions.flatMap((definition) => {
    const items = definition.colorIds
      .map((id) => valid.find((item) => item.entry.id === id))
      .filter((item): item is (typeof valid)[number] => item !== undefined);
    return items.length < 2 ? [] : [{
      id: definition.id,
      name: definition.name,
      sourceColorIds: items.map((item) => item.entry.id),
      colors: items.map((item) => item.color),
    }];
  });
}

function CommitRange({ label, value, min, max, step, unit = '', disabled, onCommit }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled: boolean;
  onCommit: (value: number) => EditorV7ActionResult;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const result = onCommit(Math.min(max, Math.max(min, draft)));
    if (!result.ok) setDraft(value);
  };
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-gray-600">
        <span>{label}</span><span className="tabular-nums text-gray-800">{Number(draft.toFixed(2))}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={draft} disabled={disabled}
        aria-label={label} onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit} onKeyUp={commit} onBlur={commit}
        className="h-10 w-full accent-primary disabled:cursor-not-allowed disabled:opacity-45" />
    </label>
  );
}

function CommitColor({ value, disabled, label, className, onCommit }: {
  value: string;
  disabled: boolean;
  label: string;
  className: string;
  onCommit: (value: string) => EditorV7ActionResult | void;
}) {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  const commitRef = useRef(onCommit);
  useEffect(() => { valueRef.current = value; setDraft(value); }, [value]);
  useEffect(() => { commitRef.current = onCommit; }, [onCommit]);
  useEffect(() => () => { if (timerRef.current !== null) clearTimeout(timerRef.current); }, []);

  const commit = (next: string) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (next === valueRef.current) return;
    const result = commitRef.current(next);
    if (result && !result.ok) setDraft(valueRef.current);
  };
  const schedule = (next: string) => {
    setDraft(next);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(next), 350);
  };

  return <input type="color" value={draft} disabled={disabled} aria-label={label} onChange={(event) => schedule(event.target.value)} onBlur={() => commit(draft)} className={className} />;
}

export function BackgroundPanelV7() {
  const toast = useToast();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const setMode = useEditorV7Store((state) => state.setBackgroundMode);
  const setAdvancedMode = useEditorV7Store((state) => state.setAdvancedBackgroundMode);
  const setColor = useEditorV7Store((state) => state.setBackgroundColor);
  const setOpacity = useEditorV7Store((state) => state.setBackgroundOpacity);
  const setGradientStops = useEditorV7Store((state) => state.setGradientStops);
  const addGradientStop = useEditorV7Store((state) => state.addGradientStop);
  const removeGradientStop = useEditorV7Store((state) => state.removeGradientStop);
  const setGradientDirection = useEditorV7Store((state) => state.setGradientDirection);
  const setCatEye = useEditorV7Store((state) => state.setCatEyeParameters);
  const setGlitter = useEditorV7Store((state) => state.setGlitterParameters);
  const applyTheme = useEditorV7Store((state) => state.applyBackgroundPaletteTheme);

  const background = step?.kind === 'background' ? step.background : null;
  const representative = useMemo(() => background ? representativeBackgroundColorV7(background) : null, [background]);
  const canonicalHex = representative ? rgbaToHexV7(representative) : '#000000';
  const canonicalOpacity = background ? Math.round(background.opacity * 100) : 100;
  const [hexDraft, setHexDraft] = useState(canonicalHex);
  const [hexError, setHexError] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState(canonicalOpacity);
  const themes = useMemo(materialThemes, []);
  const [selectedThemeId, setSelectedThemeId] = useState(themes[0]?.id ?? '');

  useEffect(() => { setHexDraft(canonicalHex); setHexError(null); }, [canonicalHex, currentFinger]);
  useEffect(() => setOpacityDraft(canonicalOpacity), [canonicalOpacity, currentFinger]);
  if (!background || !step) return null;

  const canEdit = !readOnly && !switching && !step.locked;
  const report = (result: EditorV7ActionResult) => {
    if (!result.ok && result.reason !== 'not_allowed') toast.error(result.message);
    return result;
  };
  const applyHex = (value: string): EditorV7ActionResult | void => {
    const parsed = parseHexColorV7(value);
    if (!parsed) { setHexError('请输入 6 位十六进制颜色，例如 #C94C65'); return; }
    setHexDraft(rgbaToHexV7(parsed)); setHexError(null);
    if (rgbaToHexV7(parsed) !== canonicalHex) return report(setColor(currentFinger, parsed));
  };
  const applyOpacity = () => {
    const bounded = Math.min(100, Math.max(0, Math.round(opacityDraft)));
    setOpacityDraft(bounded);
    if (bounded !== canonicalOpacity) report(setOpacity(currentFinger, bounded / 100));
  };
  const switchMode = (mode: EditorV7BackgroundModeAnyV7) => {
    report(isAdvancedBackgroundModeV7(mode) ? setAdvancedMode(currentFinger, mode) : setMode(currentFinger, mode));
  };
  const replaceGradientStop = (index: number, patch: Partial<GradientStopV7>) => {
    if (background.mode !== 'gradient') return { ok: false, reason: 'not_allowed', message: '当前背景不是渐变' } as EditorV7ActionResult;
    const stops = background.stops.map((stop, current) => current === index ? { ...stop, ...patch } : stop);
    return report(setGradientStops(currentFinger, stops));
  };

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-primary/15 bg-primary-soft/30 p-3" data-testid="v7-background-panel">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">背景铺色</p>
        <p className="mt-1 text-[10px] leading-4 text-gray-500">只修改 {currentFinger} 的唯一背景；每次确认形成一次可撤销操作。</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 sm:grid-cols-5" aria-label="背景模式">
        {(['solid', 'translucent', ...EDITOR_V7_ADVANCED_BACKGROUND_MODES] as const).map((mode) => (
          <button key={mode} type="button" disabled={!canEdit || background.mode === mode}
            aria-pressed={background.mode === mode} onClick={() => switchMode(mode)}
            className={cx('min-h-11 rounded-lg px-2 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed',
              background.mode === mode ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50 disabled:opacity-45')}>
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {(background.mode === 'translucent' || background.mode === 'cat_eye' || background.mode === 'glitter') && (
        <p className="rounded-lg border border-info/20 bg-info-soft px-2.5 py-2 text-[10px] leading-4 text-info">
          {background.mode === 'translucent'
            ? '透色为确定性 2D 近似预览，不代表真实材料或制造结果。'
            : background.previewFidelity === 'unavailable'
              ? `${MODE_LABELS[background.mode]} 当前标记为不可预览；参数会保留，但不会伪造效果。`
              : background.previewFidelity === 'exact'
                ? `${MODE_LABELS[background.mode]} 当前标记为精确 2D 表达；仍不代表真实材料或制造结果。`
                : `${MODE_LABELS[background.mode]} 为确定性 2D 近似预览，不代表真实材料或制造结果。`}
        </p>
      )}

      {(background.mode === 'solid' || background.mode === 'translucent') && (
        <fieldset disabled={!canEdit} className="space-y-2 disabled:opacity-45">
          <legend className="text-[10px] font-semibold text-gray-600">基础色板</legend>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-4">
            {PALETTE.map((color) => (
              <button key={color.id} type="button" aria-label={`设置背景颜色 ${color.name} ${color.hex}`}
                aria-pressed={color.hex.toLowerCase() === canonicalHex} title={`${color.name} · ${color.hex}`}
                onClick={() => applyHex(color.hex)}
                className={cx('h-11 min-w-11 rounded-full border border-gray-300 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2', color.hex.toLowerCase() === canonicalHex && 'ring-2 ring-primary ring-offset-2')}
                style={{ backgroundColor: color.hex }} />
            ))}
          </div>
          <div className="grid grid-cols-[44px_1fr] gap-2">
            <label className="relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-gray-300 bg-white" title="打开系统颜色选择器">
              <Pipette size={15} className="pointer-events-none absolute z-10 text-white drop-shadow" />
              <span className="absolute inset-1 rounded-md" style={{ backgroundColor: canonicalHex }} />
              <CommitColor key={`${currentFinger}-base`} value={canonicalHex} disabled={!canEdit} label="选择背景颜色" onCommit={applyHex} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <input value={hexDraft} aria-label="背景十六进制颜色" spellCheck={false}
              onChange={(event) => setHexDraft(event.target.value)} onBlur={() => applyHex(hexDraft)}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setHexDraft(canonicalHex); setHexError(null); event.currentTarget.blur(); } }}
              className={cx('h-11 min-w-0 rounded-lg border bg-white px-3 font-mono text-xs uppercase text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', hexError ? 'border-error' : 'border-gray-300')} />
          </div>
          <p className={cx('text-[10px] leading-4', hexError ? 'text-error' : 'text-gray-500')} role={hexError ? 'alert' : undefined}>{hexError ?? '取色写入 canonical sRGB，不采样 3D 灯光、高光或阴影。'}</p>
        </fieldset>
      )}

      {background.mode === 'gradient' && (
        <div className="space-y-3" data-testid="v7-gradient-controls">
          <div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-gray-600">渐变色标 · {background.stops.length}/8</p>
            <button type="button" disabled={!canEdit || background.stops.length >= 8} onClick={() => report(addGradientStop(currentFinger))}
              className="flex min-h-10 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 text-[10px] text-gray-700 disabled:opacity-40"><Plus size={12} />添加</button></div>
          {background.stops.map((stop, index) => (
            <div key={`${index}-${stop.offset}`} className="grid grid-cols-[44px_1fr_38px] items-center gap-2 rounded-lg bg-white p-2">
              <CommitColor key={`${currentFinger}-gradient-${index}-${stop.offset}`} value={rgbaToHexV7(stop.color)} disabled={!canEdit} label={`色标 ${index + 1} 颜色`}
                onCommit={(value) => { const color = parseHexColorV7(value); return color ? replaceGradientStop(index, { color }) : undefined; }} className="h-10 w-11 rounded border border-gray-200" />
              <CommitRange label={`位置 ${index + 1}`} value={Math.round(stop.offset * 100)} min={0} max={100} step={1} unit="%" disabled={!canEdit}
                onCommit={(value) => replaceGradientStop(index, { offset: value / 100 })} />
              <button type="button" aria-label={`删除色标 ${index + 1}`} disabled={!canEdit || background.stops.length <= 2}
                onClick={() => report(removeGradientStop(currentFinger, index))} className="flex h-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30"><Minus size={14} /></button>
            </div>
          ))}
          <CommitRange label="渐变方向" value={background.directionDeg} min={0} max={359} step={1} unit="°" disabled={!canEdit}
            onCommit={(value) => report(setGradientDirection(currentFinger, value))} />
        </div>
      )}

      {background.mode === 'cat_eye' && (
        <div className="space-y-3" data-testid="v7-cat-eye-controls">
          <label className="flex items-center justify-between gap-3 text-[10px] font-semibold text-gray-600">磁光颜色
            <CommitColor key={`${currentFinger}-cat-eye`} value={rgbaToHexV7(background.color)} disabled={!canEdit} label="猫眼颜色"
              onCommit={(value) => { const color = parseHexColorV7(value); return color ? report(setCatEye(currentFinger, { ...background, color })) : undefined; }} className="h-11 w-16 rounded-lg border border-gray-300" /></label>
          <CommitRange label="磁光方向" value={background.directionDeg} min={0} max={359} step={1} unit="°" disabled={!canEdit} onCommit={(value) => report(setCatEye(currentFinger, { ...background, directionDeg: value }))} />
          <CommitRange label="磁光强度" value={background.intensity} min={0} max={1} step={0.01} disabled={!canEdit} onCommit={(value) => report(setCatEye(currentFinger, { ...background, intensity: value }))} />
          <CommitRange label="光带宽度" value={background.bandWidth} min={0.04} max={0.8} step={0.01} disabled={!canEdit} onCommit={(value) => report(setCatEye(currentFinger, { ...background, bandWidth: value }))} />
        </div>
      )}

      {background.mode === 'glitter' && (
        <div className="space-y-3" data-testid="v7-glitter-controls">
          <div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-gray-600">闪粉颜色 · {background.colors.length}/8</p>
            <button type="button" disabled={!canEdit || background.colors.length >= 8} onClick={() => report(setGlitter(currentFinger, { ...background, colors: [...background.colors, background.colors[background.colors.length - 1]] }))}
              className="flex min-h-10 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 text-[10px] text-gray-700 disabled:opacity-40"><Plus size={12} />添加</button></div>
          <div className="flex flex-wrap gap-2">{background.colors.map((color, index) => (
            <label key={index} className="relative"><CommitColor key={`${currentFinger}-glitter-${index}`} value={rgbaToHexV7(color)} disabled={!canEdit} label={`闪粉颜色 ${index + 1}`}
              onCommit={(value) => { const next = parseHexColorV7(value); return next ? report(setGlitter(currentFinger, { ...background, colors: background.colors.map((item, current) => current === index ? next : item) })) : undefined; }} className="h-11 w-12 rounded-lg border border-gray-300" />
              {background.colors.length > 1 && <button type="button" aria-label={`删除闪粉颜色 ${index + 1}`} disabled={!canEdit} onClick={() => report(setGlitter(currentFinger, { ...background, colors: background.colors.filter((_, current) => current !== index) }))}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white"><Minus size={10} /></button>}</label>
          ))}</div>
          <CommitRange label="闪粉密度" value={background.density} min={0} max={1} step={0.01} disabled={!canEdit} onCommit={(value) => report(setGlitter(currentFinger, { ...background, density: value }))} />
          <CommitRange label="粒径" value={background.particleSizeMm} min={0.01} max={2} step={0.01} unit=" mm" disabled={!canEdit} onCommit={(value) => report(setGlitter(currentFinger, { ...background, particleSizeMm: value }))} />
          <div className="grid grid-cols-[1fr_44px] gap-2"><input value={background.seed} readOnly className="h-11 min-w-0 rounded-lg border border-gray-300 bg-white px-3 font-mono text-[10px] text-gray-600" aria-label="闪粉确定性种子" />
            <button type="button" title="生成新的确定性布局" aria-label="更换闪粉布局" disabled={!canEdit}
              onClick={() => report(setGlitter(currentFinger, { ...background, seed: `glitter-${hashBackgroundSeedV7(background.seed).toString(16)}` }))}
              className="flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 disabled:opacity-40"><RefreshCw size={14} /></button></div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-600"><SlidersHorizontal size={13} />背景透明度</span><span className="text-xs font-semibold tabular-nums text-gray-800">{opacityDraft}%</span></div>
        <input type="range" min="0" max="100" step="1" value={opacityDraft} disabled={!canEdit} aria-label="背景透明度"
          onChange={(event) => setOpacityDraft(Number(event.target.value))} onPointerUp={applyOpacity} onKeyUp={applyOpacity} onBlur={applyOpacity}
          className="h-11 w-full accent-primary disabled:cursor-not-allowed disabled:opacity-45" />
      </div>

      <div className="space-y-2 border-t border-primary/10 pt-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-600"><Palette size={13} />灵感主题配色</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">{themes.map((theme) => (
          <button key={theme.id} type="button" aria-pressed={selectedThemeId === theme.id} onClick={() => setSelectedThemeId(theme.id)}
            className={cx('flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-white px-2.5 text-[10px] text-gray-700', selectedThemeId === theme.id ? 'border-primary ring-1 ring-primary/30' : 'border-gray-200')}>
            <span>{theme.name}</span><span className="flex">{theme.colors.map((color, index) => <span key={index} className="h-5 w-5 rounded-full border border-white" style={{ backgroundColor: rgbaToHexV7(color), marginLeft: index ? -4 : 0 }} />)}</span>
          </button>
        ))}</div>
        <button type="button" disabled={!canEdit || !selectedThemeId} onClick={() => { const theme = themes.find((item) => item.id === selectedThemeId); if (theme) report(applyTheme(currentFinger, theme)); }}
          className="min-h-11 w-full rounded-lg bg-gray-900 px-3 text-[10px] font-semibold text-white disabled:opacity-40">确认应用到当前指</button>
        <p className="text-[9px] leading-4 text-gray-500">颜色来自 material-library；确认后写成 EditorDoc 渐变，不保持双向联动。来源引用字段延后 V7-13。</p>
      </div>
    </div>
  );
}
