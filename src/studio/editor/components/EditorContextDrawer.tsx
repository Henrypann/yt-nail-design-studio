import { useRef } from 'react';
import { Check, ImagePlus, X } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';
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

const BRUSH_PRESETS: { id: BrushPreset; label: MessageKey }[] = [
  { id: 'fine', label: 'editor.extra.thin' },
  { id: 'standard', label: 'editor.extra.standard' },
  { id: 'thick', label: 'editor.extra.thick' },
];

export function EditorContextDrawer(props: {
  active: EditorToolSection;
  onboardingOpen: boolean;
  onClose: () => void;
  onOpenInspector: (tab: 'design' | 'layers' | 'check') => void;
  onFinishOnboarding: () => void;
}) {
  const { locale, t } = useLocale();
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
      toast.warning(t('editor.extra.uploadTypes'));
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
        toast.success(t('editor.extra.imageAdded'));
      };
      image.onerror = () => toast.error(t('editor.extra.imageParseFailed'));
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-3"
      data-testid="editor-context-drawer"
      data-debug-id="studio.editor.context-drawer"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-900">
          {props.active === 'looks'
            ? t('app.lookPresets')
            : props.active === 'draw'
              ? t('app.drawTools')
              : props.active === 'components'
                ? t('app.components')
                : t('app.import')}
        </h2>
        <button onClick={props.onClose} aria-label={t('editor.extra.collapseTools')} className="text-gray-400 hover:text-gray-700">
          <X size={14} />
        </button>
      </header>

      {props.onboardingOpen && (
        <section className="mb-3 rounded-panel border border-primary/20 bg-primary-soft p-3" data-testid="editor-onboarding">
          <p className="text-xs font-semibold text-primary">{t('app.firstDesign3Steps')}</p>
          <ol className="mt-2 flex flex-col gap-2 text-nano text-gray-700">
            <li><button className="text-left hover:text-primary" onClick={() => props.onOpenInspector('layers')}>{t('app.1ChooseLookPreset')}</button></li>
            <li><button className="text-left hover:text-primary" onClick={() => props.onOpenInspector('design')}>{t('app.2AdjustShapeLengthColorFinish')}</button></li>
            <li><span>{t('app.3SelectNailBelowThenChooseCurrentAll10')}</span></li>
          </ol>
          <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={props.onFinishOnboarding}>
            <Check size={12} />
            {t('app.skipGotIt')}
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
                  toast.success(t('app.lookNameEnLookIdAsKeyofTypeofRecipeByLookApplied', { look_name: look.name, LOOK_NAME_EN_look_id_as_keyof_typeof_RECIPE_BY_LOOK_: LOOK_NAME_EN[look.id as keyof typeof RECIPE_BY_LOOK] }));
                }
              }}
              className="rounded-card border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:border-primary hover:shadow-float disabled:opacity-40"
            >
              <span className="block text-sm font-medium text-gray-900">
                {locale === 'en-US' ? LOOK_NAME_EN[look.id as keyof typeof RECIPE_BY_LOOK] : look.name}
              </span>
              <span className="mt-0.5 block text-nano text-gray-400">
                {look.id === 'solid-color'
                  ? t('app.baseColorNoPatternLayer')
                  : look.id === 'classic-french'
                    ? t('app.applyThenDrag3PinkHandlesCanvas')
                    : t('app.structuredVerticalGradient')}
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
                      'rounded-button px-2 py-1.5 text-nano',
                      brushPreset === preset.id ? 'bg-primary-soft text-primary' : 'bg-white text-gray-600',
                    )}
                  >
                    {t(preset.label)}
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
              <label className="text-nano text-gray-500">
                {t('editor.extra.lineWidth')} {brushSize}（{BRUSH_PRESET_SIZES[brushPreset]} {t('editor.extra.presetSuffix')}
                <input type="range" min={2} max={30} value={brushSize} onChange={(event) => setBrush({ size: Number(event.target.value) })} className="w-full accent-primary" />
              </label>
            </>
          )}
        </div>
      )}

      {props.active === 'components' && (
        <div className="rounded-card border border-gray-200 bg-white p-3 text-xs text-gray-600">
          {t('editor.extra.attachmentsHint')}
          <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => props.onOpenInspector('layers')}>
            {t('editor.extra.openAttachments')}
          </Button>
        </div>
      )}

      {props.active === 'import' && (
        <div className="flex flex-col items-center rounded-card border border-dashed border-gray-300 bg-white p-5 text-center">
          <ImagePlus size={24} className="text-gray-400" />
          <p className="mt-2 text-xs text-gray-600">{t('editor.extra.importArtwork')}</p>
          <Button size="sm" variant="secondary" className="mt-3" disabled={readOnly} onClick={() => fileRef.current?.click()}>
            {t('editor.extra.chooseFile')}
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
