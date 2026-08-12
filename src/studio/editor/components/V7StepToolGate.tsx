import { cx } from '@/design-system';
import type { EditorToolIdV7 } from '../v7/registry';

const TOOL_LABELS: Record<EditorToolIdV7, string> = {
  select: '选择',
  background_fill: '铺色',
  color_picker: '取色',
  gradient: '渐变',
  brush: '画笔',
  eraser: '橡皮擦',
  shape: '形状',
  french: '法式',
  text: '文字',
  import_2d: '导入 2D',
  mask: '遮罩',
  cat_eye: '猫眼',
  glitter: '闪粉',
  mirror: '镜面',
  ink_bloom: '晕染',
  relief: '浮雕 2.5D',
  attachment: '立体饰品',
  finish_picker: '封层选择',
  preview_3d: '最终 3D 预览',
};

export function V7StepToolGate({ tools, compact = false }: { tools: readonly EditorToolIdV7[]; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-2.5" data-testid="v7-tool-gate">
      <div className="flex items-center justify-between gap-2">
        <p className="text-nano font-semibold uppercase tracking-[0.12em] text-gray-500">适用工具</p>
        <span className="text-nano text-gray-400">后续 PR 开放创作</span>
      </div>
      <div className={cx('mt-2 flex flex-wrap gap-1.5', compact && 'gap-1')}>
        {tools.map((tool) => (
          <button
            key={tool}
            type="button"
            disabled
            aria-label={`${TOOL_LABELS[tool]}，尚未开放`}
            title="当前 PR 只验证步骤与工具权限；具体创作将在后续 PR 开放"
            className="min-h-8 rounded-full border border-gray-200 bg-white px-2.5 text-nano text-gray-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {TOOL_LABELS[tool]}
          </button>
        ))}
      </div>
    </div>
  );
}
