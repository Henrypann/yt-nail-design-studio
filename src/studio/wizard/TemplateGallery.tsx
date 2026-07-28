/**
 * 模板选择器 + 甲型×风格映射（DEV-PLAN §5 / Studio-PRD §12.4）
 *
 * - 数据全部来自 material-library/index.json（模板 + 风格标签）
 * - 风格筛选（默认「全部」）
 * - 选甲型后自动三档排序：推荐（绿标）→ 一般 → 不建议（饱和度 60% + ⚠ reason，仍可应用）
 * - 卡片最佳甲型 badge：★ 首选 / ✓ 推荐 / ⚠ 不建议
 * - 状态：骨架屏 2×3 / 失败 Toast + [重试] / 选中 2px 主色边框 + ✓
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Badge, Button, Skeleton, useToast, cx } from '@/design-system';
import type { NailShape } from '@/lib/types';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import {
  compatTier,
  loadLibraryIndex,
  loadShapeParams,
  notRecommendedReason,
  shapeBadges,
  sortTemplatesForShape,
  type LibraryIndex,
  type TemplateEntry,
} from '@/studio/preview/material-library';
import { useWizardStore } from './wizard-store';

type LoadState = 'loading' | 'ready' | 'error';

export function TemplateGallery() {
  const toast = useToast();
  const appliedShape = useWizardStore((s) => s.appliedShape);
  const templateId = useWizardStore((s) => s.templateId);
  const applyTemplate = useWizardStore((s) => s.applyTemplate);
  const readOnly = useWizardStore((s) => s.status !== 'draft');
  const mockFlags = useMockScenarios((s) => s.flags);

  const [state, setState] = useState<LoadState>('loading');
  const [index, setIndex] = useState<LibraryIndex | null>(null);
  const [shapeNames, setShapeNames] = useState<Record<string, string>>({});
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        if (isScenarioOn(mockFlags, 'templates.loadFail')) throw new Error('模板库加载失败（MOCK）');
        const [idx, params] = await Promise.all([loadLibraryIndex(), loadShapeParams()]);
        if (cancelled) return;
        setIndex(idx);
        setShapeNames(
          Object.fromEntries(Object.entries(params.shapes).map(([k, v]) => [k, v.name])),
        );
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

  const tagNameById = useMemo(() => {
    const map = new Map<string, string>();
    index?.style_tags.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [index]);

  const visible = useMemo(() => {
    if (!index) return [];
    const filtered =
      tagFilter === 'all'
        ? index.templates
        : index.templates.filter((t) => t.style_tags.includes(tagFilter));
    return appliedShape
      ? sortTemplatesForShape(filtered, appliedShape)
      : [...filtered].sort((a, b) => a.sort_order - b.sort_order);
  }, [index, tagFilter, appliedShape]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* 风格筛选：标签完全由 material-library/index.json 驱动 */}
      <div className="flex flex-wrap gap-1.5">
        {[{ id: 'all', name: '全部' }, ...(index?.style_tags ?? [])].map((tag) => (
          <button
            key={tag.id}
            onClick={() => setTagFilter(tag.id)}
            className={cx(
              'rounded-full border px-2.5 py-1 text-xs transition-colors duration-fast',
              tagFilter === tag.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900',
            )}
          >
            {tag.name}
          </button>
        ))}
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
                shapeNames={shapeNames}
                tagNameById={tagNameById}
                selected={templateId === t.id}
                disabled={readOnly}
                onApply={() => applyTemplate(t)}
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
  shapeNames: Record<string, string>;
  tagNameById: Map<string, string>;
  selected: boolean;
  disabled: boolean;
  onApply: () => void;
}

function TemplateCard({ template, shape, shapeNames, tagNameById, selected, disabled, onApply }: TemplateCardProps) {
  const tier = shape ? compatTier(template, shape) : 'neutral';
  const reason = shape ? notRecommendedReason(template, shape) : null;
  const badges = shapeBadges(template);
  const shapeName = (s: NailShape) => shapeNames[s] ?? s;

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
        <span className="absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
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
        {tier === 'high' && (
          <span className="absolute left-1.5 top-1.5 rounded-button bg-success px-1.5 py-0.5 text-[10px] font-medium text-white">
            推荐
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium text-gray-900">{template.name}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {template.style_tags.map((tag) => (
            <span key={tag} className="rounded-button bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500">
              {tagNameById.get(tag) ?? tag}
            </span>
          ))}
        </div>
        {/* 最佳甲型 badge（方向 B） */}
        <div className="flex flex-wrap gap-1 text-[10px] text-gray-500">
          {badges.best && <Badge variant="success" className="px-1 py-0 text-[10px]">★ {shapeName(badges.best)}</Badge>}
          {badges.good.length > 0 && (
            <Badge variant="gray" className="px-1 py-0 text-[10px]">✓ {badges.good.map(shapeName).join(', ')}</Badge>
          )}
          {badges.bad.length > 0 && (
            <Badge variant="warning" className="px-1 py-0 text-[10px]">⚠ {badges.bad.map(shapeName).join(', ')}</Badge>
          )}
        </div>
        {/* 不建议原因（不建议 ≠ 禁止，仍可应用） */}
        {tier === 'not' && reason && (
          <p className="text-[10px] leading-snug text-warning">
            ⚠ {reason}。仍可选择。
          </p>
        )}
        <div className="mt-auto pt-1">
          <Button
            size="sm"
            variant={selected ? 'secondary' : 'primary'}
            disabled={disabled}
            onClick={onApply}
            className="h-7 w-full text-[11px]"
          >
            {selected ? '已应用 · 再次应用' : '应用此模板'}
          </Button>
        </div>
      </div>
    </div>
  );
}
