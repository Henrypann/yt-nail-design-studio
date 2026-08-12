import { ScanSearch } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { taxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';
import {
  compatibilityLabel,
  compatibilityTitle,
  compatibilityToneClass,
  getShapeLengthCompatibility,
} from '@/studio/compatibility';
import { COLOR_PRESETS, SURFACE_PRESETS, shapeName } from '../lib/material';
import { isEditorShapeEnabled, TIER_ONE_EDITOR_SHAPES } from '../lib/material';
import { GEOMETRY_LENGTH_BY_PRESET, resolveFingerData, type LengthPreset } from '../lib/model';
import { useEditorStore } from '../store';
import { LayerPanel } from './LayerPanel';
import { RecipeInspector } from './RecipeInspector';

export type InspectorTab = 'design' | 'layers' | 'check';

const LENGTHS: { id: LengthPreset; label: string; extension: string }[] = [
  { id: 'natural', label: '本甲长度', extension: '+0mm' },
  { id: 'short-extension', label: '短延长', extension: '+4mm' },
  { id: 'medium', label: '中长度', extension: '+8mm' },
  { id: 'long', label: '长', extension: '+12mm' },
];
function DesignInspector() {
  const { locale, text } = useLocale();
  const doc = useEditorStore((state) => state.doc);
  const readOnly = useEditorStore((state) => state.readOnly);
  const commit = useEditorStore((state) => state.commit);
  const currentFinger = useEditorStore((state) => state.currentFinger);
  const editCurrentFingerData = useEditorStore((state) => state.editCurrentFingerData);
  if (!doc) return null;
  const currentData = resolveFingerData(doc, currentFinger);
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="editor-design-inspector"
      data-debug-id="studio.editor.inspector.design"
    >
      <p className="rounded-button bg-info-soft px-2 py-1.5 text-nano leading-relaxed text-info">
        {text('甲型、长度和表面属于整套设计；颜色遵循底部“编辑范围”。', 'Shape, length and surface apply to the set. Color follows EDIT SCOPE below.')}
      </p>
      <section>
        <p className="mb-2 text-nano font-medium text-gray-700">NAIL SHAPE</p>
        <div className="grid grid-cols-3 gap-1.5">
          {TIER_ONE_EDITOR_SHAPES.map((capability) => {
            const enabled = isEditorShapeEnabled(capability);
            const selected = doc.shape === capability.id;
            const compatibility = getShapeLengthCompatibility(capability.id, doc.length);
            const hint = compatibilityTitle(compatibility, locale);
            const badge = compatibilityLabel(compatibility, locale);
            return (
            <button
              key={capability.id}
              disabled={readOnly || !enabled}
              title={enabled ? hint || shapeName(capability.id, locale) : `${shapeName(capability.id, locale)} · Pending geometry sign-off`}
              data-shape-id={capability.id}
              data-editor-enabled={enabled}
              data-compatibility={enabled ? compatibility.severity : undefined}
              onClick={() => commit((draft) => { draft.shape = capability.id; })}
              className={cx(
                'rounded-button border px-2 py-1.5 text-nano',
                selected ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600',
                enabled && compatibilityToneClass(compatibility, selected),
                !enabled && 'cursor-not-allowed opacity-45',
              )}
            >
              {shapeName(capability.id, locale)}
              {enabled && !selected && badge && <span aria-hidden="true" className="ml-1 text-nano opacity-75">{badge}</span>}
            </button>
            );
          })}
        </div>
        <p className="mt-1 text-nano text-gray-400">Almond / Oval / Coffin available. Squoval / Square remain gated until geometry sign-off.</p>
      </section>
      <section>
        <p className="mb-2 text-nano font-medium text-gray-700">{text('长度 · 扫描相对值', 'LENGTH · RELATIVE TO SCAN')}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {LENGTHS.map((length) => {
            const selected = doc.lengthPreset === length.id;
            const compatibility = getShapeLengthCompatibility(
              doc.shape,
              GEOMETRY_LENGTH_BY_PRESET[length.id],
            );
            const hint = compatibilityTitle(compatibility, locale);
            const badge = compatibilityLabel(compatibility, locale);
            return (
              <button
                key={length.id}
                disabled={readOnly}
                title={hint || undefined}
                data-compatibility={compatibility.severity}
                onClick={() =>
                  commit((draft) => {
                    draft.lengthPreset = length.id;
                    draft.length = GEOMETRY_LENGTH_BY_PRESET[length.id];
                  })
                }
                className={cx(
                  'flex items-center justify-between rounded-button border px-2 py-1.5 text-nano',
                  selected ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600',
                  compatibilityToneClass(compatibility, selected),
                )}
              >
                <span>
                  {taxonomyLabel('design-length', length.id, locale, { zh: length.label })}
                  {!selected && badge && <span aria-hidden="true" className="ml-1 text-nano opacity-75">{badge}</span>}
                </span>
                <span className="tnum opacity-65">{length.extension}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-nano text-gray-400">{text('无扫描时回退为 14 / 18 / 22 / 26mm。', 'Fallback without scan: 14 / 18 / 22 / 26mm.')}</p>
      </section>
      <section>
        <p className="mb-2 text-nano font-medium text-gray-700">{text('色彩预设', 'COLOR PRESETS')}</p>
        <div className="grid grid-cols-5 gap-1">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color.id}
              title={color.name}
              disabled={readOnly}
              onClick={() => editCurrentFingerData((data) => { data.baseColor = color.hex; })}
              className={cx(
                'flex flex-col items-center gap-1 rounded-button p-1 text-nano text-gray-500',
                currentData.baseColor.toLowerCase() === color.hex.toLowerCase() && 'bg-primary-soft text-primary ring-1 ring-primary',
              )}
            >
              <span className="h-7 w-7 rounded-full border border-gray-200" style={{ backgroundColor: color.hex }} />
              <span>{color.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-2 text-nano font-medium text-gray-700">{text('表面预设', 'SURFACE')}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {SURFACE_PRESETS.map((surface) => {
            const available = surface.id === 'gloss' || surface.id === 'matte';
            const selected =
              doc.appearance.topFinish === surface.appearance.top_finish &&
              doc.appearance.opticalEffect === surface.appearance.optical_effect;
            return (
              <button
                key={surface.id}
                disabled={readOnly || !available}
                title={available ? surface.name : `${surface.name} 将在 E3 接入 Shader`}
                onClick={() =>
                  commit((draft) => {
                    draft.appearance.topFinish = surface.appearance.top_finish;
                    draft.appearance.opticalEffect = surface.appearance.optical_effect;
                  })
                }
                className={cx(
                  'flex items-center justify-between rounded-button border px-2 py-1.5 text-nano',
                  selected ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600',
                  !available && 'cursor-not-allowed opacity-45',
                )}
              >
                <span>
                  {surface.id === 'gloss' || surface.id === 'matte'
                    ? taxonomyLabel('top-finish', surface.id, locale, { zh: surface.name })
                    : taxonomyLabel('optical-effect', surface.id, locale, { zh: surface.name })}
                </span>
                {!available && <span className="text-nano">E3</span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function EditorInspector(props: {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onOpenRisk: () => void;
}) {
  const { text } = useLocale();
  const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'design', label: text('设计', 'DESIGN') },
    { id: 'layers', label: text('图层', 'LAYERS') },
    { id: 'check', label: text('检查', 'CHECK') },
  ];
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-gray-50" data-testid="editor-inspector">
      <div className="grid grid-cols-3 border-b border-gray-200 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={props.tab === tab.id}
            onClick={() => props.onTabChange(tab.id)}
            className={cx(
              'rounded-button px-2 py-1.5 text-nano',
              props.tab === tab.id ? 'bg-primary-soft font-medium text-primary' : 'text-gray-500 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {props.tab === 'design' && <div className="flex flex-col gap-3"><RecipeInspector /><DesignInspector /></div>}
        {props.tab === 'layers' && <LayerPanel />}
        {props.tab === 'check' && (
          <div className="flex flex-col gap-3" data-debug-id="studio.editor.inspector.check">
            <section className="rounded-panel border border-gray-200 bg-white p-3">
              <h3 className="text-xs font-semibold text-gray-800">二维风险检查</h3>
              <p className="mt-1 text-nano leading-relaxed text-gray-500">
                当前只检查附件数量、高度参数和边缘距离。结果不等于生产可行。
              </p>
              <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={props.onOpenRisk}>
                <ScanSearch size={13} />
                P0 风险筛查 · MOCK
              </Button>
            </section>
            <section className="rounded-panel border border-dashed border-gray-200 bg-white p-3 text-nano text-gray-500">
              猫眼、极光、丝绸和三维模拟属于 E3+，本轮未以占位效果冒充完成。
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}
