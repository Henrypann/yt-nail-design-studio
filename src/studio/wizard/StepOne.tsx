/**
 * STEP 1 · 门禁（Studio-PRD §12.3）
 *
 * 客户卡片（Twin 三态）+ 甲型卡片 + 长度按钮 + 右侧即时预览（所见即所得，
 * 甲型/长度一变即重渲染）+ [下一步：选风格 →]（首次）/ [进入画布 →]（已选过风格）。
 * 进入画布失败：持久内联错误条（常驻到重试成功，不再只依赖会消失的 toast）。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, cx, useToast } from '@/design-system';
import { CheckCircle2, AlertTriangle, MinusCircle, UserRound, ArrowRight, RefreshCw } from 'lucide-react';
import type { Customer } from '@/lib/types';
import { Routes } from '@/app/routes';
import { loadLibraryIndex, loadShapeParams } from '@/studio/preview/material-library';
import { loadSilhouette, type SilhouetteAsset } from '@/studio/preview/nail-assets';
import { NailCellView } from '@/studio/preview/TiledNailsPreview';
import { useWizardStore } from './wizard-store';
import { ShapeLengthPicker } from './ShapeLengthPicker';
import { StyleRecommendModal, type StyleRecommendation } from './StyleRecommendModal';
import { countDesignsByCustomer } from './design-repository';

/** 未扫描指数（Twin Mock：由客户 id 稳定派生 2–5，仅展示用，标 MOCK） */
function mockUnscannedCount(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 4) + 2;
}

function TwinNotice({ customer }: { customer: Customer }) {
  switch (customer.twinStatus) {
    case 'MOCK_VALID':
      return (
        <div className="flex items-center gap-2 text-xs text-success">
          <CheckCircle2 size={14} />
          十指已全部扫描
          <Badge variant="gray" className="text-[10px]">MOCK · 预览使用标准尺寸</Badge>
        </div>
      );
    case 'MOCK_LOW_CONFIDENCE':
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-warning">
          <AlertTriangle size={14} />
          {mockUnscannedCount(customer.id)} 指未扫描。可跳过，提交生产前须补全。
          <Badge variant="gray" className="text-[10px]">MOCK · 预览使用标准尺寸</Badge>
        </div>
      );
    case 'NO_DATA':
      return (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <MinusCircle size={14} />
          客户尚未扫描。预览将使用标准尺寸。
        </div>
      );
  }
}

/** 甲型/长度即时预览：选择一变即重新渲染（与 STEP 2 同一套单甲渲染器） */
function LiveShapePreview() {
  const shape = useWizardStore((s) => s.shape);
  const length = useWizardStore((s) => s.length);
  const [sil, setSil] = useState<SilhouetteAsset | null>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!shape || !length) {
      setSil(null);
      setLabel('');
      return;
    }
    let cancelled = false;
    loadSilhouette(shape, length)
      .then((asset) => {
        if (!cancelled) setSil(asset);
      })
      .catch(() => {
        if (!cancelled) setSil(null);
      });
    loadShapeParams()
      .then((p) => {
        if (cancelled) return;
        const shapeName = p.shapes[shape]?.name_en ?? shape;
        const len = p.lengths[length];
        setLabel(`${shapeName} · ${len.name}（${len.lengthMm}mm）`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shape, length]);

  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-2 rounded-panel border border-gray-100 bg-gray-50/60 px-3 py-4 lg:w-[190px]"
      data-debug-id="studio.wizard.step1.live-preview"
    >
      {sil ? (
        <>
          <NailCellView
            finger="L3"
            shape={shape!}
            length={length!}
            silhouetteD={sil.d}
            viewBox={sil.viewBox}
            baseColor="#F5E0D3"
            finish="gloss"
            patternMarkup={null}
            patternK={1}
            patternVisible={false}
            patternFadeMs={0}
            failed={false}
            selected={false}
            hasOverride={false}
            strokeScale={120 / Number(sil.viewBox.split(/\s+/)[2] ?? 120)}
            readOnly
            size="md"
          />
          <p className="text-center text-[11px] text-gray-500">{label}</p>
        </>
      ) : (
        <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-16 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-300">
            💅
          </div>
          <p className="text-[11px] leading-relaxed text-gray-400">
            选择甲型与长度
            <br />
            这里即时预览效果
          </p>
        </div>
      )}
    </div>
  );
}

export function StepOne() {
  const customer = useWizardStore((s) => s.customer);
  const shape = useWizardStore((s) => s.shape);
  const length = useWizardStore((s) => s.length);
  const applying = useWizardStore((s) => s.applying);
  const applyError = useWizardStore((s) => s.applyError);
  const stylePrompted = useWizardStore((s) => s.stylePrompted);
  const setShape = useWizardStore((s) => s.setShape);
  const setLength = useWizardStore((s) => s.setLength);
  const setStyle = useWizardStore((s) => s.setStyle);
  const markStylePrompted = useWizardStore((s) => s.markStylePrompted);
  const applyAndEnter = useWizardStore((s) => s.applyAndEnter);
  const applyTemplate = useWizardStore((s) => s.applyTemplate);
  const openPicker = useWizardStore((s) => s.openPicker);
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  if (!customer) return null;

  const ready = shape !== null && length !== null;

  /** [进入画布]：失败由持久内联错误条呈现（applyError），样式/长度选择保留。
   *  成功后先跳选款页（社区demo入口），已选过模板的路径直接进画布。 */
  const enterCanvas = async (): Promise<void> => {
    const ok = await applyAndEnter();
    if (ok) navigate(Routes.designTemplates);
  };

  /** 首次点击：先弹风格推荐（每设计一次）；已选过风格则直接进入画布 */
  const handleApply = async () => {
    if (!stylePrompted) {
      setStyleModalOpen(true);
      return;
    }
    await enterCanvas();
  };

  /** 选用风格：模板映射必须存在；缺失时显式报错，不把纯底色冒充选款成功。
   *  已经选定具体模板，跳过选款页直接进画布。 */
  const handleStyleSelect = async (st: StyleRecommendation) => {
    setStyle(st.id, st.name);
    setStyleModalOpen(false);
    const ok = await applyAndEnter();
    if (!ok) return; // 内联错误条已呈现
    if (st.template_id) {
      try {
        const index = await loadLibraryIndex();
        const template = index.templates.find((t) => t.id === st.template_id);
        if (!template) {
          toast.error(`风格「${st.name}」引用的模板不存在，请选择其他风格。`);
          navigate(Routes.designTemplates);
          return;
        }
        applyTemplate(template);
        if (st.cover_status === 'CONCEPT') {
          toast.warning(
            `已应用「${st.base_template_name ?? template.name}」近似基础方案；高保真 3D 层仍为概念资产，当前画布不代表生产结果。`,
          );
        }
        navigate(Routes.designNew);
      } catch {
        toast.error('模板目录加载失败。可在模板库刷新后重新选择。');
        navigate(Routes.designTemplates);
      }
    } else {
      navigate(Routes.designTemplates);
    }
  };

  const handleStyleSkip = async () => {
    markStylePrompted();
    setStyleModalOpen(false);
    await enterCanvas();
  };

  return (
    <div className="mx-auto flex h-full max-w-[860px] flex-col gap-4 overflow-y-auto" data-debug-id="studio.wizard.step1">
      {/* 客户卡片（Twin 三态 + 历史设计数） */}
      <Card padding="md" className="flex items-center gap-4" data-debug-id="studio.wizard.step1.customer-card">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <UserRound size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900">{customer.name}</span>
            <span className="text-xs text-gray-400 tnum">{countDesignsByCustomer(customer.id)} 个历史设计</span>
          </div>
          <div className="mt-1">
            <TwinNotice customer={customer} />
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={openPicker}>
          更换客户
        </Button>
      </Card>

      {/* 甲型 + 长度 + 即时预览（所见即所得） */}
      <Card padding="lg" data-debug-id="studio.wizard.step1.shape-length-picker">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <ShapeLengthPicker shape={shape} length={length} onShapeChange={setShape} onLengthChange={setLength} />
          </div>
          <LiveShapePreview />
        </div>
      </Card>

      {/* 进入画布失败：持久错误条（常驻到重试成功） */}
      {applyError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-panel border border-error/20 bg-error-soft px-3 py-2 text-xs text-error"
          data-debug-id="studio.wizard.step1.apply-error"
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={13} />
            {applyError}
          </span>
          <button
            onClick={() => void handleApply()}
            className={cx(
              'flex items-center gap-1 rounded-button border border-error/30 bg-white px-2 py-1',
              'transition-colors duration-fast hover:bg-error-soft',
            )}
          >
            <RefreshCw size={11} />
            重试
          </button>
        </div>
      )}

      {/* [下一步：选风格 →]（首次）/ [进入画布 →]（已选过风格）：吸底常驻，短视口不被顶出折叠线 */}
      <div className="sticky bottom-0 -mx-1 mt-auto flex justify-end border-t border-gray-100 bg-white/95 px-1 py-2 backdrop-blur-sm">
        <Button
          size="md"
          disabled={!ready}
          loading={applying}
          onClick={handleApply}
          className="min-w-[180px]"
        >
          {applying ? '生成预览中…' : (
            <>
              {stylePrompted ? '进入画布' : '下一步：选风格'}
              <ArrowRight size={14} />
            </>
          )}
        </Button>
      </div>

      {/* 风格推荐弹窗：选定甲型长度后、进入画布前 */}
      <StyleRecommendModal
        open={styleModalOpen}
        shape={shape}
        length={length}
        onSelect={handleStyleSelect}
        onSkip={() => void handleStyleSkip()}
      />
    </div>
  );
}
