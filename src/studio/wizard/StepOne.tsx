/**
 * STEP 1 · 门禁（Studio-PRD §12.3）
 *
 * 客户卡片（Twin 三态）+ 甲型卡片 + 长度按钮 + [应用 → 预览十指] 五态按钮
 * （未选禁用 / 就绪 / 生成预览中 / 成功展开 / 失败 Toast）。
 */

import { useState } from 'react';
import { Badge, Button, Card, useToast } from '@/design-system';
import { CheckCircle2, AlertTriangle, MinusCircle, UserRound, ArrowRight } from 'lucide-react';
import type { Customer } from '@/lib/types';
import { loadLibraryIndex } from '@/studio/preview/material-library';
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

export function StepOne() {
  const toast = useToast();
  const customer = useWizardStore((s) => s.customer);
  const shape = useWizardStore((s) => s.shape);
  const length = useWizardStore((s) => s.length);
  const applying = useWizardStore((s) => s.applying);
  const stylePrompted = useWizardStore((s) => s.stylePrompted);
  const setShape = useWizardStore((s) => s.setShape);
  const setLength = useWizardStore((s) => s.setLength);
  const setStyle = useWizardStore((s) => s.setStyle);
  const markStylePrompted = useWizardStore((s) => s.markStylePrompted);
  const applyAndEnter = useWizardStore((s) => s.applyAndEnter);
  const applyTemplate = useWizardStore((s) => s.applyTemplate);
  const openPicker = useWizardStore((s) => s.openPicker);
  const [styleModalOpen, setStyleModalOpen] = useState(false);

  if (!customer) return null;

  const ready = shape !== null && length !== null;

  const enterCanvas = async (): Promise<void> => {
    const ok = await applyAndEnter();
    if (!ok) toast.error('预览生成失败，请重试。');
  };

  /** [应用 → 预览十指]：先弹风格推荐（每设计一次），再进入画布 */
  const handleApply = async () => {
    if (!stylePrompted) {
      setStyleModalOpen(true);
      return;
    }
    await enterCanvas();
  };

  /** 选用风格：进入画布后自动应用映射模板（best-effort，模板缺失不阻断） */
  const handleStyleSelect = async (st: StyleRecommendation) => {
    setStyle(st.id, st.name);
    setStyleModalOpen(false);
    const ok = await applyAndEnter();
    if (!ok) {
      toast.error('预览生成失败，请重试。');
      return;
    }
    if (st.template_id) {
      try {
        const index = await loadLibraryIndex();
        const template = index.templates.find((t) => t.id === st.template_id);
        if (template) applyTemplate(template);
      } catch {
        /* 模板映射失败不阻断：用户仍可在模板墙手动选择 */
      }
    }
  };

  const handleStyleSkip = async () => {
    markStylePrompted();
    setStyleModalOpen(false);
    await enterCanvas();
  };

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4" data-debug-id="studio.wizard.step1">
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

      {/* 甲型 + 长度 */}
      <Card padding="lg" data-debug-id="studio.wizard.step1.shape-length-picker">
        <ShapeLengthPicker shape={shape} length={length} onShapeChange={setShape} onLengthChange={setLength} />
      </Card>

      {/* [应用 → 预览十指] 五态 */}
      <div className="flex justify-end">
        <Button
          size="md"
          disabled={!ready}
          loading={applying}
          onClick={handleApply}
          className="min-w-[180px]"
        >
          {applying ? '生成预览中…' : (
            <>
              应用 → 预览十指
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
