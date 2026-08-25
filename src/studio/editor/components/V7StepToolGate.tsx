import { cx } from '@/design-system';
import { useLocale, type MessageKey } from '@/lib/i18n';
import type { EditorToolIdV7 } from '../v7/registry';

const TOOL_KEYS: Record<EditorToolIdV7, MessageKey> = { select: 'editorV7.tool.select', background_fill: 'editorV7.gate.backgroundFill', color_picker: 'editorV7.gate.colorPicker', gradient: 'editorV7.gate.gradient', brush: 'editorV7.tool.brush', eraser: 'editorV7.gate.eraser', shape: 'editorV7.tool.shape', french: 'editorV7.tool.french', text: 'editorV7.tool.text', import_2d: 'editorV7.tool.assets', mask: 'editorV7.gate.mask', cat_eye: 'editorV7.gate.catEye', glitter: 'editorV7.gate.glitter', mirror: 'editorV7.gate.mirror', ink_bloom: 'editorV7.gate.inkBloom', relief: 'editorV7.gate.relief', attachment: 'editorV7.gate.attachment', finish_picker: 'editorV7.gate.finishPicker', preview_3d: 'editorV7.gate.preview3d' };

export function V7StepToolGate({ tools, compact = false }: { tools: readonly EditorToolIdV7[]; compact?: boolean }) {
  const { t } = useLocale();
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-2.5" data-testid="v7-tool-gate">
      <div className="flex items-center justify-between gap-2">
        <p className="text-nano font-semibold uppercase tracking-[0.12em] text-gray-500">{t('editorV7.gate.applicableTools')}</p>
        <span className="text-nano text-gray-400">{t('editorV7.gate.futureCreation')}</span>
      </div>
      <div className={cx('mt-2 flex flex-wrap gap-1.5', compact && 'gap-1')}>
        {tools.map((tool) => (
          <button
            key={tool}
            type="button"
            disabled
            aria-label={`${t(TOOL_KEYS[tool])}，${t('editorV7.gate.notOpen')}`}
            title={t('editorV7.gate.permissionOnly')}
            className="min-h-8 rounded-full border border-gray-200 bg-white px-2.5 text-nano text-gray-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t(TOOL_KEYS[tool])}
          </button>
        ))}
      </div>
    </div>
  );
}
