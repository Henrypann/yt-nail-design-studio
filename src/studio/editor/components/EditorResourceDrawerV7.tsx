import { useMemo, useState } from 'react';
import { LibraryBig, Palette, X } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { PALETTE } from '../lib/material';
import { selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { parseHexColorV7, rgbaToHexV7, type EditorV7PaletteThemeV7 } from '../v7/background';
import { FlatVectorPanelV7 } from './FlatVectorPanelV7';
import { FlatContentResourcesV7 } from './FlatContentResourcesV7';
import { BackgroundPanelV7 } from './BackgroundPanelV7';
import { SurfaceEffectPanelV7 } from './SurfaceEffectPanelV7';
import { DimensionalDecorationPanelV7 } from './DimensionalDecorationPanelV7';
import { FinishCompositePanelV7 } from './FinishCompositePanelV7';
import { isFlatToolPanelModeV7 } from '../v7/flat-tool-panel-map';

export function EditorResourceDrawerV7({ onClose }: { onClose(): void }) {
  const toast = useToast();
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const resourceMode = useEditorV7Store((state) => state.resourceMode);
  const setBackgroundColor = useEditorV7Store((state) => state.setBackgroundColor);
  const applyBackgroundTheme = useEditorV7Store((state) => state.applyBackgroundPaletteTheme);
  const canSetBackgroundColor = selectedStep?.kind === 'background'
    && (selectedStep.background.mode === 'solid' || selectedStep.background.mode === 'translucent')
    && selectedStep.visible
    && !selectedStep.locked
    && !readOnly
    && !switching;
  const canApplyBackgroundPreset = selectedStep?.kind === 'background'
    && selectedStep.visible
    && !selectedStep.locked
    && !readOnly
    && !switching;
  const themes = useMemo((): EditorV7PaletteThemeV7[] => {
    const valid = PALETTE.map((entry) => ({ entry, color: parseHexColorV7(entry.hex) }))
      .filter((item): item is { entry: (typeof PALETTE)[number]; color: NonNullable<ReturnType<typeof parseHexColorV7>> } => item.color !== null);
    const definitions = [
      { id: 'material.soft', name: '柔雾裸粉', colorIds: ['c_nude_pink', 'c_milky_white', 'c_dusty_rose'] },
      { id: 'material.berry', name: '浆果夜色', colorIds: ['c_dusty_rose', 'c_berry', 'c_wine', 'c_deep_plum'] },
      { id: 'material.earth', name: '暖调大地', colorIds: ['c_nude_pink', 'c_caramel', 'c_grey_taupe'] },
    ];
    return definitions.flatMap((definition) => {
      const items = definition.colorIds.map((id) => valid.find((item) => item.entry.id === id)).filter((item): item is (typeof valid)[number] => Boolean(item));
      return items.length < 2 ? [] : [{ id: definition.id, name: definition.name, sourceColorIds: items.map((item) => item.entry.id), colors: items.map((item) => item.color) }];
    });
  }, []);
  const [selectedThemeId, setSelectedThemeId] = useState(themes[0]?.id ?? '');

  const applyBackgroundColor = (hex: string) => {
    const color = parseHexColorV7(hex);
    if (!color) return;
    const result = setBackgroundColor(currentFinger, color);
    if (!result.ok) toast.error(result.message);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" aria-label="当前层工具与参数" data-testid="v7-resource-drawer">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-3">
        <div>
          <div className="flex items-center gap-2"><LibraryBig size={15} className="text-primary" /><h2 className="text-xs font-semibold text-gray-800">当前层工具与参数</h2></div>
          <p className="mt-0.5 text-nano text-gray-500">随右侧选中层同步 · 不创建第二份状态</p>
        </div>
        <button type="button" aria-label="关闭资源" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={16} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedStep?.kind === 'flat_design' && isFlatToolPanelModeV7(resourceMode) && <FlatVectorPanelV7 variant="resources" panelMode={resourceMode} />}
        {selectedStep?.kind === 'flat_design' && (resourceMode === 'text' || resourceMode === 'assets') && <FlatContentResourcesV7 mode={resourceMode} />}

        {selectedStep?.kind === 'background' && <div className="space-y-3">
          <BackgroundPanelV7 />
          <div>
            <p className="text-nano font-semibold uppercase tracking-[0.12em] text-primary">基础色板</p>
            <p className="mt-1 text-nano leading-4 text-gray-500">单色与透色可直接取用；渐变、猫眼和闪粉参数均在本面板编辑。</p>
          </div>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="背景资源色板">
            {PALETTE.map((item) => <button key={item.id} type="button" disabled={!canSetBackgroundColor} title={canSetBackgroundColor ? `${item.name} ${item.hex}` : '当前背景模式请在属性中编辑颜色'} aria-label={`应用背景资源 ${item.name}`} onClick={() => applyBackgroundColor(item.hex)} className={cx('aspect-square min-h-11 rounded-xl border border-gray-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45')} style={{ backgroundColor: item.hex }} />)}
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="flex items-center gap-1.5 text-nano font-semibold uppercase tracking-[0.12em] text-primary"><Palette size={13} />灵感主题预设</p>
            <div className="mt-2 space-y-1.5">{themes.map((theme) => (
              <button key={theme.id} type="button" aria-pressed={selectedThemeId === theme.id} onClick={() => setSelectedThemeId(theme.id)} className={cx('flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-2.5 text-nano text-gray-700', selectedThemeId === theme.id ? 'border-primary ring-1 ring-primary/30' : 'border-gray-200')}>
                <span>{theme.name}</span><span className="flex">{theme.colors.map((color, index) => <span key={index} className="h-5 w-5 rounded-full border border-white" style={{ backgroundColor: rgbaToHexV7(color), marginLeft: index ? -4 : 0 }} />)}</span>
              </button>
            ))}</div>
            <button type="button" disabled={!canApplyBackgroundPreset || !selectedThemeId} onClick={() => { const theme = themes.find((item) => item.id === selectedThemeId); if (!theme) return; const result = applyBackgroundTheme(currentFinger, theme); if (!result.ok) toast.error(result.message); }} className="mt-2 min-h-11 w-full rounded-xl bg-gray-900 px-3 text-nano font-semibold text-white disabled:opacity-40">应用主题到当前指</button>
          </div>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-nano leading-4 text-gray-500">
            灵感主题仍会 materialize 为 EditorDocV7 的 RGBA/gradient 数据；Community InspirationPack 与来源追踪在 V7-15 接入。
          </div>
        </div>}

        {selectedStep?.kind === 'surface_effect' && <SurfaceEffectPanelV7 />}
        {selectedStep?.kind === 'dimensional_decoration' && <DimensionalDecorationPanelV7 />}
        {selectedStep?.kind === 'surface_finish' && <FinishCompositePanelV7 />}
      </div>
    </section>
  );
}
