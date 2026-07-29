import { useRef } from 'react';
import { Check, ImagePlus, X } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { LOOK_PRESETS, PALETTE } from '../lib/material';
import { createLayerMeta, genId } from '../lib/model';
import { BRUSH_PRESET_SIZES, useEditorStore, type BrushPreset } from '../store';
import type { EditorToolSection } from './EditorToolRail';

const RECIPE_BY_LOOK = {
  'solid-color': 'solid',
  'classic-french': 'french',
  'nude-gradient': 'gradient',
} as const;
const LOOK_NAME_EN: Record<keyof typeof RECIPE_BY_LOOK, string> = {
  'solid-color': 'Solid color',
  'classic-french': 'Classic French',
  'nude-gradient': 'Nude gradient',
};

const BRUSH_PRESETS: { id: BrushPreset; label: string }[] = [
  { id: 'fine', label: '细线' },
  { id: 'standard', label: '标准' },
  { id: 'thick', label: '粗线' },
];

export function EditorContextDrawer(props: {
  active: EditorToolSection;
  onboardingOpen: boolean;
  onClose: () => void;
  onOpenInspector: (tab: 'design' | 'layers' | 'check') => void;
  onFinishOnboarding: () => void;
}) {
  const { locale, text } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const brushColor = useEditorStore((state) => state.brushColor);
  const brushPreset = useEditorStore((state) => state.brushPreset);
  const brushSize = useEditorStore((state) => state.brushSize);
  const setBrush = useEditorStore((state) => state.setBrush);
  const setBrushPreset = useEditorStore((state) => state.setBrushPreset);
  const applyRecipe = useEditorStore((state) => state.applyRecipe);
  const editCurrentFingerData = useEditorStore((state) => state.editCurrentFingerData);
  const readOnly = useEditorStore((state) => state.readOnly);

  const importFile = (file: File) => {
    if (!/image\/(png|jpeg|svg\+xml)/.test(file.type)) {
      toast.warning('仅支持 PNG / JPG / SVG');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => {
        editCurrentFingerData((data) => {
          data.pattern.push({
            id: genId('el_img'),
            kind: 'image',
            ...createLayerMeta(file.name, data.pattern.length),
            dataUrl,
            width: image.naturalWidth,
            height: image.naturalHeight,
            transform: { x: 0, y: -90, scale: 1, rotation: 0 },
          });
        });
        props.onOpenInspector('layers');
        toast.success('图片已加入图案分区');
      };
      image.onerror = () => toast.error('图片解析失败');
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-3" data-testid="editor-context-drawer">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-900">
          {props.active === 'looks'
            ? text('款式预设', 'LOOK PRESETS')
            : props.active === 'draw'
              ? text('绘制工具', 'DRAW TOOLS')
              : props.active === 'components'
                ? text('组件', 'COMPONENTS')
                : text('导入素材', 'IMPORT')}
        </h2>
        <button onClick={props.onClose} aria-label="收起工具面板" className="text-gray-400 hover:text-gray-700">
          <X size={14} />
        </button>
      </header>

      {props.onboardingOpen && (
        <section className="mb-3 rounded-panel border border-primary/20 bg-primary-soft p-3" data-testid="editor-onboarding">
          <p className="text-xs font-semibold text-primary">{text('第一次设计 · 3 步', 'FIRST DESIGN · 3 STEPS')}</p>
          <ol className="mt-2 flex flex-col gap-2 text-[11px] text-gray-700">
            <li><button className="text-left hover:text-primary" onClick={() => props.onOpenInspector('layers')}>{text('1. 选择一个款式预设', '1. Choose a look preset')}</button></li>
            <li><button className="text-left hover:text-primary" onClick={() => props.onOpenInspector('design')}>{text('2. 调整甲型、长度、颜色和表面', '2. Adjust shape, length, color and finish')}</button></li>
            <li><span>{text('3. 在底部选择当前指，并明确选择“仅当前指”或“十指同步”', '3. Select a nail below, then choose CURRENT or ALL 10')}</span></li>
          </ol>
          <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={props.onFinishOnboarding}>
            <Check size={12} />
            {text('跳过 / 我已了解', 'Skip / Got it')}
          </Button>
        </section>
      )}

      {props.active === 'looks' && (
        <div className="flex flex-col gap-2">
          {LOOK_PRESETS.filter((look) => look.id in RECIPE_BY_LOOK).map((look) => (
            <button
              key={look.id}
              disabled={readOnly}
              onClick={() => {
                const result = applyRecipe(RECIPE_BY_LOOK[look.id as keyof typeof RECIPE_BY_LOOK]);
                if (result === 'ok') {
                  props.onOpenInspector('layers');
                  toast.success(text(`已应用「${look.name}」`, `${LOOK_NAME_EN[look.id as keyof typeof RECIPE_BY_LOOK]} applied`));
                }
              }}
              className="rounded-card border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:border-primary hover:shadow-float disabled:opacity-40"
            >
              <span className="block text-sm font-medium text-gray-900">
                {locale === 'en' ? LOOK_NAME_EN[look.id as keyof typeof RECIPE_BY_LOOK] : look.name}
              </span>
              <span className="mt-0.5 block text-[10px] text-gray-400">
                {look.id === 'solid-color'
                  ? text('纯底色 · 无图案元素', 'Base color · No pattern layer')
                  : look.id === 'classic-french'
                    ? text('应用后直接在画布拖动三个粉色控制点', 'Apply, then drag the 3 pink handles on canvas')
                    : text('结构化纵向渐变', 'Structured vertical gradient')}
              </span>
            </button>
          ))}
        </div>
      )}

      {props.active === 'draw' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(['brush', 'eraser'] as const).map((id) => (
              <button
                key={id}
                disabled={readOnly}
                onClick={() => setTool(id)}
                className={cx(
                  'rounded-button border px-3 py-2 text-xs',
                  tool === id ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600',
                )}
              >
                {id === 'brush' ? '画笔 B' : '橡皮 E'}
              </button>
            ))}
          </div>
          {tool === 'brush' && (
            <>
              <div className="grid grid-cols-3 gap-1">
                {BRUSH_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setBrushPreset(preset.id)}
                    className={cx(
                      'rounded-button px-2 py-1.5 text-[11px]',
                      brushPreset === preset.id ? 'bg-primary-soft text-primary' : 'bg-white text-gray-600',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PALETTE.slice(0, 8).map((color) => (
                  <button
                    key={color.id}
                    title={color.name}
                    onClick={() => setBrush({ color: color.hex })}
                    className={cx('h-7 rounded-full border', brushColor === color.hex ? 'ring-2 ring-primary' : 'border-gray-200')}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
              <label className="text-[11px] text-gray-500">
                线宽 {brushSize}（{BRUSH_PRESET_SIZES[brushPreset]} 预设）
                <input type="range" min={2} max={30} value={brushSize} onChange={(event) => setBrush({ size: Number(event.target.value) })} className="w-full accent-[#C2497A]" />
              </label>
            </>
          )}
        </div>
      )}

      {props.active === 'components' && (
        <div className="rounded-card border border-gray-200 bg-white p-3 text-xs text-gray-600">
          附件属于独立制造分区。请在右侧“图层”中添加、排序和调整高度。
          <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => props.onOpenInspector('layers')}>
            打开附件分区
          </Button>
        </div>
      )}

      {props.active === 'import' && (
        <div className="flex flex-col items-center rounded-card border border-dashed border-gray-300 bg-white p-5 text-center">
          <ImagePlus size={24} className="text-gray-400" />
          <p className="mt-2 text-xs text-gray-600">导入 PNG / JPG / SVG 到图案分区</p>
          <Button size="sm" variant="secondary" className="mt-3" disabled={readOnly} onClick={() => fileRef.current?.click()}>
            选择文件
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importFile(file);
              event.target.value = '';
            }}
          />
        </div>
      )}
    </aside>
  );
}
