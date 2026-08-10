import { LibraryBig, X } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { PALETTE } from '../lib/material';
import { selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { parseHexColorV7 } from '../v7/background';
import { FlatVectorPanelV7 } from './FlatVectorPanelV7';

export function EditorResourceDrawerV7({ onClose }: { onClose(): void }) {
  const toast = useToast();
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const setBackgroundColor = useEditorV7Store((state) => state.setBackgroundColor);
  const canSetBackgroundColor = selectedStep?.kind === 'background'
    && (selectedStep.background.mode === 'solid' || selectedStep.background.mode === 'translucent')
    && !selectedStep.locked
    && !readOnly
    && !switching;

  const applyBackgroundColor = (hex: string) => {
    const color = parseHexColorV7(hex);
    if (!color) return;
    const result = setBackgroundColor(currentFinger, color);
    if (!result.ok) toast.error(result.message);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" aria-label="资源与预设" data-testid="v7-resource-drawer">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-3">
        <div>
          <div className="flex items-center gap-2"><LibraryBig size={15} className="text-primary" /><h2 className="text-xs font-semibold text-gray-800">资源与预设</h2></div>
          <p className="mt-0.5 text-[10px] text-gray-500">工具资源，不创建第二份设计状态</p>
        </div>
        <button type="button" aria-label="关闭资源" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={16} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedStep?.kind === 'flat_design' && <FlatVectorPanelV7 variant="resources" />}

        {selectedStep?.kind === 'background' && <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">基础色板</p>
            <p className="mt-1 text-[10px] leading-4 text-gray-500">单色与透色可直接取用；渐变、猫眼和闪粉参数在右侧属性中编辑。</p>
          </div>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="背景资源色板">
            {PALETTE.map((item) => <button key={item.id} type="button" disabled={!canSetBackgroundColor} title={canSetBackgroundColor ? `${item.name} ${item.hex}` : '当前背景模式请在属性中编辑颜色'} aria-label={`应用背景资源 ${item.name}`} onClick={() => applyBackgroundColor(item.hex)} className={cx('aspect-square min-h-11 rounded-xl border border-gray-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45')} style={{ backgroundColor: item.hex }} />)}
          </div>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-[10px] leading-4 text-gray-500">
            灵感主题仍会 materialize 为 EditorDocV7 的 RGBA/gradient 数据；Community InspirationPack 与来源追踪在 V7-15 接入。
          </div>
        </div>}

        {selectedStep && selectedStep.kind !== 'background' && selectedStep.kind !== 'flat_design' && <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs leading-5 text-gray-500">当前工艺步骤的素材与预设尚未开放。步骤数据会继续保留，可在右侧属性查看 fidelity 与 fallback。</div>}
      </div>
    </section>
  );
}
