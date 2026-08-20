/**
 * Quick Start 官方模板选择器（DEV-PLAN §5 / Studio-PRD §12.4）
 *
 * - 数据来自 material-library/index.json 中受治理的官方模板
 * - 仅保留受治理的官方模板；按当前甲型适配度确定性排序
 * - 状态：骨架屏 2×3 / 失败 Toast + [重试] / 选中 2px 主色边框 + ✓
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Badge, Button, Skeleton, useToast, cx } from '@/design-system';
import type { NailShape } from '@/lib/types';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import {
  compatTier,
  isHighFidelityConceptGalleryTemplate,
  loadLibraryIndex,
  notRecommendedReason,
  sortTemplatesForShape,
  type LibraryIndex,
  type TemplateEntry,
} from '@/studio/preview/material-library';
import { useWizardStore } from './wizard-store';
import { PETAL_VEIL_P0_ENABLED } from '@/studio/petal-veil/feature';

type LoadState = 'loading' | 'ready' | 'error';

export function TemplateGallery() {
  const toast = useToast();
  const appliedShape = useWizardStore((s) => s.appliedShape);
  const templateId = useWizardStore((s) => s.templateId);
  const templateName = useWizardStore((s) => s.templateName);
  const applyTemplate = useWizardStore((s) => s.applyTemplate);
  const readOnly = useWizardStore((s) => s.status !== 'draft');
  const mockFlags = useMockScenarios((s) => s.flags);

  const [state, setState] = useState<LoadState>('loading');
  const [index, setIndex] = useState<LibraryIndex | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        if (isScenarioOn(mockFlags, 'templates.loadFail')) throw new Error('模板库加载失败（MOCK）');
        const idx = await loadLibraryIndex();
        if (cancelled) return;
        setIndex(idx);
        setState('ready');
      } catch {
        if (!cancelled) {
          setState('error');
          toast.error('模板库加载失败。请重试。');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey, mockFlags]);

  const visible = useMemo(() => {
    if (!index) return [];
    const highFidelityTemplates = index.templates.filter(isHighFidelityConceptGalleryTemplate);
    const enabledTemplates = PETAL_VEIL_P0_ENABLED
      ? highFidelityTemplates
      : highFidelityTemplates.filter((template) => template.id !== 't_petal_veil_french');
    return appliedShape
      ? sortTemplatesForShape(enabledTemplates, appliedShape)
      : [...enabledTemplates].sort((a, b) => a.sort_order - b.sort_order);
  }, [index, appliedShape]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2">
        <div><p className="text-sm font-semibold text-ink">官方模板</p><p className="text-nano text-mute">按当前甲型适配度排序 · 概念/模拟证据单独标注</p></div>
      </div>

      {/* 卡片列表（窄栏单列） */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {state === 'loading' && (
          <div className="grid grid-cols-1 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-gray-300 py-10">
            <p className="text-xs text-gray-500">模板库加载失败。请重试。</p>
            <Button size="sm" variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
              <RefreshCw size={13} />
              重试
            </Button>
          </div>
        )}

        {state === 'ready' && (
          <div className="grid grid-cols-1 gap-2">
            {visible.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                shape={appliedShape}
                selected={templateId === (t.render_template_id ?? t.id) && templateName === t.name}
                disabled={readOnly}
                onApply={() => {
                  applyTemplate(t);
                  if (t.asset_status === 'CONCEPT') {
                    toast.warning(t.id === 't_petal_veil_french'
                      ? '已应用 Petal Veil HQ 候选。Canonical Fixture 尚待人工视觉签收，制造状态未验证。'
                      : `已应用「${t.name}」概念基础层。`);
                  }
                }}
              />
            ))}
            {visible.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-400">
                该风格下暂无模板。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: TemplateEntry;
  shape: NailShape | null;
  selected: boolean;
  disabled: boolean;
  onApply: () => void;
}

function TemplateCard({ template, shape, selected, disabled, onApply }: TemplateCardProps) {
  const tier = shape ? compatTier(template, shape) : 'neutral';
  const reason = shape ? notRecommendedReason(template, shape) : null;

  return (
    <div
      className={cx(
        'group relative flex flex-col overflow-hidden rounded-card border bg-white text-left',
        'transition-all duration-fast ease-out',
        selected ? 'border-2 border-primary' : 'border-gray-200 hover:border-primary/60',
        tier === 'not' && 'saturate-[0.6]',
      )}
    >
      {selected && (
        <span className="absolute bottom-1.5 right-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
          <Check size={10} />
        </span>
      )}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        <img
          src={`/${template.thumbnail_url}`}
          alt={template.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {(template.asset_status === 'CONCEPT' || template.asset_status === 'SIMULATED') && (
          <span className="absolute right-1.5 top-1.5 rounded-button border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-nano font-medium text-amber-800">
            {template.asset_status === 'SIMULATED' ? '已签收模拟' : template.id === 't_petal_veil_french' ? 'HQ 候选 · 待签收' : '高保真概念'}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium text-gray-900">{template.name}</span>
        </div>
        <div className="flex flex-wrap gap-1 text-nano text-gray-500">
          {tier === 'high' && <Badge variant="success" className="px-1 py-0 text-nano">适配当前甲型</Badge>}
          {tier === 'not' && <Badge variant="warning" className="px-1 py-0 text-nano">需人工检查</Badge>}
        </div>
        {/* 不建议原因（不建议 ≠ 禁止，仍可应用） */}
        {tier === 'not' && reason && (
          <p className="text-nano leading-snug text-warning">
            ⚠ {reason}。仍可选择。
          </p>
        )}
        {template.asset_status === 'CONCEPT' && template.capability_summary && (
          <div className="space-y-0.5 rounded-button bg-amber-50 px-1.5 py-1 text-nano leading-snug">
            <p className="text-success">✓ {template.capability_summary.supported.join(' / ')}</p>
            <p className="text-amber-800">○ {template.capability_summary.pending.join(' / ')}</p>
            {template.asset_spec_url && (
              <a
                href={template.asset_spec_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-medium text-primary underline underline-offset-2"
              >
                查看 Asset Spec
              </a>
            )}
          </div>
        )}
        <div className="mt-auto pt-1">
          <Button
            size="sm"
            variant={selected ? 'secondary' : 'primary'}
            disabled={disabled}
            onClick={onApply}
            className="h-7 w-full text-nano"
          >
            {template.asset_status === 'CONCEPT'
              ? selected
                ? template.id === 't_petal_veil_french' ? '已应用 HQ 候选' : '已应用概念基础层'
                : template.id === 't_petal_veil_french' ? '应用 HQ 候选' : '应用概念基础层'
              : selected
                ? '已应用 · 再次应用'
                : '应用此模板'}
          </Button>
        </div>
      </div>
    </div>
  );
}
