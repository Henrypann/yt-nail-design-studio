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
import { useLocale } from '@/lib/i18n';
import { isReadOnly } from '@/lib/state-machine';
import { taxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';
import { loadDecorations, type DecorationAsset } from '@/studio/preview/nail-assets';
import { loadFinishes, loadPalette, type FinishMeta, type PaletteColor } from '@/studio/preview/material-library';
import { downloadBlob, hasPreview, renderPreviewPng } from '@/studio/preview/export-png';
import { isPetalVeilRecipe } from '@/studio/editor/lib/recipe-model';
import { FINGER_LABEL } from '@/studio/preview/TenFingerPreview';
import { useWizardStore } from './wizard-store';

export function ParamsPanel() {
  const toast = useToast();
  const { locale } = useLocale();
  const s = useWizardStore();
  const mockFlags = useMockScenarios((s2) => s2.flags);
  const readOnly = isReadOnly(s.status);
  const petalP0 = isPetalVeilRecipe(s.recipe);

  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [finishes, setFinishes] = useState<FinishMeta[]>([]);
  const [decorations, setDecorations] = useState<DecorationAsset[]>([]);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (petalP0) return;
    loadPalette().then(setPalette).catch(() => toast.error('色板加载失败。'));
    loadFinishes().then(setFinishes).catch(() => undefined);
    loadDecorations().then(setDecorations).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petalP0]);

  /* ── 导出 PNG ── */
  const handleExport = async () => {
    if (exporting) return;
    if (!hasPreview()) {
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

  if (petalP0) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
        <div className="rounded-panel border border-warning/30 bg-warning-soft px-3 py-2 text-[11px] leading-relaxed text-warning">
          高保真候选 · 待视觉签收<br />
          Canonical Renderer 不代表生产或制造可用。
        </div>
        {readOnly && (
          <div className="rounded-panel border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
            设计已冻结（顾客已确认），画布只读。
          </div>
        )}
        <section className="rounded-panel border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-900">Petal Veil Signature · 已锁定</p>
          <dl className="mt-3 grid grid-cols-[72px_1fr] gap-y-2 text-[11px]">
            <dt className="text-gray-400">规格</dt><dd className="text-gray-700">Almond · Medium</dd>
            <dt className="text-gray-400">底层</dt><dd className="text-gray-700">奶雾裸透 · 0.92</dd>
            <dt className="text-gray-400">法式</dt><dd className="text-gray-700">柔边微法式 · 0.75</dd>
            <dt className="text-gray-400">重音指</dt><dd className="text-gray-700">仅 R4 · 五瓣低浮雕花</dd>
            <dt className="text-gray-400">渲染器</dt><dd className="break-all text-gray-700">three-pbr/petal-veil-1</dd>
          </dl>
          <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
            P0 不开放底色、质感、逐指换色或附件枚举。
          </p>
        </section>
        <section className="mt-auto flex flex-col gap-2 border-t border-gray-100 pt-3">
          <Button variant="secondary" loading={exporting} onClick={handleExport}>
            <Download size={14} />
            导出 HQ PNG
          </Button>
          {s.status === 'draft' ? (
            <Button onClick={() => setConfirmOpen(true)}>
              <Check size={14} />
              顾客已确认
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-1.5 rounded-button bg-info-soft py-2 text-xs text-info">
              <Check size={13} /> 已标记「顾客已确认」
            </div>
          )}
        </section>
        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="标记顾客已确认"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>取消</Button>
              <Button onClick={async () => {
                const ok = await s.markConfirmed();
                if (ok) setConfirmOpen(false);
              }}>标记已确认</Button>
            </>
          }
        >
          顾客已在店内确认该方案？确认后设计将冻结；资产视觉签收仍保持 pending。
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      {s.recipe?.recipeRef.id === 'mercury-dew' && (
        <div className="rounded-panel border border-warning/30 bg-warning-soft px-3 py-2 text-[11px] text-warning" data-testid="mercury-output-policy">
          模拟效果 · 尚未完成生产验证
        </div>
      )}
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
                title={`${taxonomyLabel('community-color', c.id, locale, { zh: c.name, en: c.name_en })} ${c.hex}`}
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
                <span className="text-[10px] text-gray-500">
                  {taxonomyLabel('community-color', c.id, locale, { zh: c.name, en: c.name_en })}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 质感（驱动高保真甲面：高光带/弧面阴影三质感差异化） */}
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
              {taxonomyLabel('wizard-finish', f.id, locale, { zh: f.name, en: f.name_en })}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-gray-400">切换后甲面高光与弧面效果即时更新。</p>
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
                      title={taxonomyLabel('attachment', d.id, locale, { zh: d.name })}
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
                      title={taxonomyLabel('community-color', c.id, locale, { zh: c.name, en: c.name_en })}
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
