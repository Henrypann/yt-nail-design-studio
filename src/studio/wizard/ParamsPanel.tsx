/**
 * 右栏：参数面板 + 逐指例外 + 操作区（Studio-PRD §12.4）
 *
 * - 8 色色板（palette.json，点击 → 十指即时替换）
 * - 质感下拉（gloss/matte/pearl，原型期仅记录参数）
 * - 参数级逐指例外：点击预览中某指 → 附件替换（爱心/珍珠/蝴蝶结/星星）+ 该指单独换底色，
 *   写入 finger_overrides（Wizard 内完成，不进 Editor）
 * - 操作：[导出预览 PNG]（SVG→PNG 下载，失败 Toast + 重试）/
 *   [顾客已确认]（二次确认弹窗 → 冻结只读）/ [3D 预览] 置灰「即将推出」
 */

import { useEffect, useState } from 'react';
import { Ban, Check, Download, RotateCcw } from 'lucide-react';
import { Badge, Button, Modal, useToast, cx } from '@/design-system';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { isReadOnly } from '@/lib/state-machine';
import { loadDecorations, type DecorationAsset } from '@/studio/preview/nail-assets';
import { loadFinishes, loadPalette, type FinishMeta, type PaletteColor } from '@/studio/preview/material-library';
import { downloadBlob, hasPreviewSvg, renderPreviewPng } from '@/studio/preview/export-png';
import { FINGER_LABEL } from '@/studio/preview/TenFingerPreview';
import { useWizardStore } from './wizard-store';

export function ParamsPanel() {
  const toast = useToast();
  const s = useWizardStore();
  const mockFlags = useMockScenarios((s2) => s2.flags);
  const readOnly = isReadOnly(s.status);

  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [finishes, setFinishes] = useState<FinishMeta[]>([]);
  const [decorations, setDecorations] = useState<DecorationAsset[]>([]);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    loadPalette().then(setPalette).catch(() => toast.error('色板加载失败。'));
    loadFinishes().then(setFinishes).catch(() => undefined);
    loadDecorations().then(setDecorations).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 导出 PNG ── */
  const handleExport = async () => {
    if (exporting) return;
    if (!hasPreviewSvg()) {
      toast.warning('预览尚未就绪，请稍候再导出。');
      return;
    }
    setExporting(true);
    try {
      if (isScenarioOn(mockFlags, 'export.fail')) throw new Error('导出失败（MOCK）');
      const blob = await renderPreviewPng(2);
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadBlob(blob, `nail-preview-${s.designId}-${stamp}.png`);
      toast.success('预览 PNG 已导出。');
    } catch {
      toast.error('导出失败，请重试。');
    } finally {
      setExporting(false);
    }
  };

  const fingerOverride = s.selectedFinger ? s.fingerOverrides[s.selectedFinger] : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      {readOnly && (
        <div className="rounded-panel border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
          设计已冻结（顾客已确认），画布只读。如需修改，请在设计列表基于已确认设计创建新版本。
        </div>
      )}

      {/* 底色色板 */}
      <section>
        <p className="mb-2 text-xs font-medium text-gray-700">底色</p>
        <div className="grid grid-cols-4 gap-2">
          {palette.map((c) => {
            const active = s.baseColor === c.hex;
            return (
              <button
                key={c.id}
                disabled={readOnly}
                onClick={() => s.setBaseColor(c.hex)}
                title={`${c.name} ${c.hex}`}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-button p-1 transition-all duration-fast',
                  active ? 'ring-2 ring-primary ring-offset-1' : 'hover:bg-gray-50',
                  readOnly && 'cursor-not-allowed opacity-60',
                )}
              >
                <span
                  className="h-7 w-7 rounded-full border border-gray-200"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-[10px] text-gray-500">{c.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 质感（仅记录参数） */}
      <section>
        <p className="mb-2 text-xs font-medium text-gray-700">质感</p>
        <select
          value={s.finish}
          disabled={readOnly}
          onChange={(e) => s.setFinish(e.target.value as typeof s.finish)}
          className="h-9 w-full rounded-button border border-gray-300 bg-white px-3 text-sm transition-colors duration-fast hover:border-gray-400 focus:border-primary focus:outline-none disabled:bg-gray-50"
        >
          {finishes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}（{f.name_en}）
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-gray-400">原型期仅记录参数，不做真实渲染差异。</p>
      </section>

      {/* 参数级逐指例外 */}
      <section className="rounded-panel border border-gray-200 p-3">
        {s.selectedFinger ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-900">
                {FINGER_LABEL[s.selectedFinger]} · 单独定制
              </p>
              <button
                onClick={() => s.setSelectedFinger(null)}
                className="text-[10px] text-gray-400 hover:text-gray-700"
              >
                完成
              </button>
            </div>

            {/* 附件替换 */}
            <div>
              <p className="mb-1.5 text-[11px] text-gray-500">附件</p>
              <div className="grid grid-cols-5 gap-1">
                <button
                  disabled={readOnly}
                  onClick={() => s.setFingerOverride(s.selectedFinger!, { decorationId: null })}
                  title="无附件"
                  className={cx(
                    'flex h-9 items-center justify-center rounded-button border text-gray-400 transition-colors duration-fast',
                    !fingerOverride?.decorationId ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <Ban size={14} />
                </button>
                {decorations.map((d) => {
                  const active = fingerOverride?.decorationId === d.id;
                  return (
                    <button
                      key={d.id}
                      disabled={readOnly}
                      onClick={() => s.setFingerOverride(s.selectedFinger!, { decorationId: d.id })}
                      title={d.name}
                      className={cx(
                        'flex h-9 items-center justify-center rounded-button border transition-colors duration-fast',
                        active ? 'border-primary bg-primary-soft' : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <svg viewBox="-16 -16 32 32" className="h-6 w-6" dangerouslySetInnerHTML={{ __html: d.innerMarkup }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 该指单独换底色 */}
            <div>
              <p className="mb-1.5 text-[11px] text-gray-500">该指底色</p>
              <div className="grid grid-cols-8 gap-1">
                {palette.map((c) => {
                  const active = fingerOverride?.baseColor === c.hex;
                  return (
                    <button
                      key={c.id}
                      disabled={readOnly}
                      onClick={() => s.setFingerOverride(s.selectedFinger!, { baseColor: c.hex })}
                      title={c.name}
                      className={cx(
                        'h-6 w-6 rounded-full border transition-all duration-fast',
                        active ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-gray-200',
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>
            </div>

            {fingerOverride && (fingerOverride.baseColor || fingerOverride.decorationId) && (
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly}
                onClick={() => s.clearFingerOverride(s.selectedFinger!)}
                className="self-start text-gray-500"
              >
                <RotateCcw size={12} />
                清除该指定制
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-gray-400">
            点击预览中的指甲，可为该指单独换色或加装饰（重音指）。
          </p>
        )}
      </section>

      {/* 操作区 */}
      <section className="mt-auto flex flex-col gap-2 border-t border-gray-100 pt-3">
        <Button variant="secondary" loading={exporting} onClick={handleExport}>
          <Download size={14} />
          导出预览 PNG
        </Button>
        {s.status === 'draft' ? (
          <Button onClick={() => setConfirmOpen(true)}>
            <Check size={14} />
            顾客已确认
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-button bg-info-soft py-2 text-xs text-info">
            <Check size={13} />
            已标记「顾客已确认」
            {s.confirmation && (
              <Badge variant="blue" className="text-[10px]">{s.confirmation.confirmedBy}</Badge>
            )}
          </div>
        )}
        <Button variant="secondary" disabled title="即将推出">
          3D 预览 · 即将推出
        </Button>
      </section>

      {/* 顾客已确认 · 二次确认弹窗（线下场景：无线上确认功能） */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="标记顾客已确认"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              onClick={async () => {
                const ok = await s.markConfirmed();
                if (ok) setConfirmOpen(false);
              }}
            >
              标记已确认
            </Button>
          </>
        }
      >
        顾客已在店内确认该方案？确认后设计将冻结，不可再编辑。
      </Modal>
    </div>
  );
}
