/**
 * `/design/templates` 选款页（社区demo P0）
 *
 * STEP 1 甲型/长度确认后的独立路由页：收敛后的四类标签 + 大网格模板卡片，
 * 复用 TemplateGallery.tsx 同一套 material-library 数据与甲型适配逻辑（compatTier/shapeBadges/
 * notRecommendedReason），只是布局从窄栏改为全宽网格。选定模板后进画布；也可跳过直接进画布；
 * 顶部提供「进入社区查看更多模板」入口 → /design/community（基础 mock，未接真实数据）。
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, RefreshCw, Users } from 'lucide-react';
import { Badge, Button, Skeleton, useToast, cx } from '@/design-system';
import { Routes } from '@/app/routes';
import type { NailShape } from '@/lib/types';
import {
  compatTier,
  isHighFidelityConceptGalleryTemplate,
  loadLibraryIndex,
  loadShapeParams,
  notRecommendedReason,
  shapeBadges,
  sortTemplatesForShape,
  type LibraryIndex,
  type TemplateEntry,
} from '@/studio/preview/material-library';
import { useWizardStore } from '@/studio/wizard/wizard-store';
import { PETAL_VEIL_P0_ENABLED } from '@/studio/petal-veil/feature';
import { CrossProductLink } from '@/app/CrossProductLink';
import { communityProductHref } from '@/app/product-navigation';
import { communityHref } from '@/community/lib/entry-link';

type LoadState = 'loading' | 'ready' | 'error';

/** 与 Wizard 侧栏共用的顾客可见分类。 */
const GALLERY_TABS: { id: string; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'trending', label: '推荐' },
  { id: 'sweet', label: '甜美' },
  { id: 'minimal', label: '简约' },
  { id: 'luxe', label: '奢华' },
];

export default function TemplateGalleryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const appliedShape = useWizardStore((s) => s.appliedShape);
  const appliedLength = useWizardStore((s) => s.appliedLength);
  const templateId = useWizardStore((s) => s.templateId);
  const templateName = useWizardStore((s) => s.templateName);
  const applyTemplate = useWizardStore((s) => s.applyTemplate);

  const [state, setState] = useState<LoadState>('loading');
  const [index, setIndex] = useState<LibraryIndex | null>(null);
  const [shapeNames, setShapeNames] = useState<Record<string, string>>({});
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [retryKey, setRetryKey] = useState(0);

  /* 未走完 STEP 1（无甲型/长度）直接访问本页：兜底回退到 Wizard 入口 */
  useEffect(() => {
    if (!appliedShape || !appliedLength) navigate(Routes.designNew, { replace: true });
  }, [appliedShape, appliedLength, navigate]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const [idx, params] = await Promise.all([loadLibraryIndex(), loadShapeParams()]);
        if (cancelled) return;
        setIndex(idx);
        setShapeNames(
          Object.fromEntries(Object.entries(params.shapes).map(([k, v]) => [k, v.name_en ?? k])),
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
  }, [retryKey]);

  const tagNameById = useMemo(() => {
    const map = new Map<string, string>();
    index?.style_tags.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [index]);

  const visible = useMemo(() => {
    if (!index) return [];
    const highFidelityTemplates = index.templates.filter(isHighFidelityConceptGalleryTemplate);
    const enabledTemplates = PETAL_VEIL_P0_ENABLED
      ? highFidelityTemplates
      : highFidelityTemplates.filter((template) => template.id !== 't_petal_veil_french');
    const filtered =
      tagFilter === 'all'
        ? enabledTemplates
        : enabledTemplates.filter((t) => t.style_tags.includes(tagFilter));
    return appliedShape
      ? sortTemplatesForShape(filtered, appliedShape)
      : [...filtered].sort((a, b) => a.sort_order - b.sort_order);
  }, [index, tagFilter, appliedShape]);

  if (!appliedShape || !appliedLength) return null;

  const handleApply = (t: TemplateEntry) => {
    applyTemplate(t);
    if (t.asset_status === 'CONCEPT') {
      toast.warning(t.id === 't_petal_veil_french'
        ? '已应用 Petal Veil HQ 候选。Canonical Fixture 尚待人工视觉签收，制造状态未验证。'
        : `已应用「${t.name}」概念基础层。`);
    }
    navigate(Routes.designNew);
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4" data-debug-id="studio.design-templates">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">选择模板</h1>
          <p className="mt-0.5 text-xs text-gray-500">选一个模板作为起点，进入画布后仍可调整参数。也可跳过直接进入空白方案。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate(Routes.designNew)}>
            跳过，直接进入画布
          </Button>
          <CrossProductLink
            href={communityProductHref(communityHref({
              entry: 'template_gallery',
              returnTo: Routes.designTemplates,
              shape: appliedShape,
              length: appliedLength,
            }))}
            data-testid="template-gallery-community-entry"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-button border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Users size={13} />
            进入社区查看更多模板
          </CrossProductLink>
        </div>
      </header>

      {/* 标签：全部 / 当下流行 / 甜美（社区demo P0 固定范围） */}
      <div className="flex gap-1.5">
        {GALLERY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTagFilter(tab.id)}
            className={cx(
              'rounded-full border px-3 py-1.5 text-xs transition-colors duration-fast',
              tagFilter === tab.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {state === 'loading' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-gray-300 py-16">
          <p className="text-xs text-gray-500">模板库加载失败。请重试。</p>
          <Button size="sm" variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            <RefreshCw size={13} />
            重试
          </Button>
        </div>
      )}

      {state === 'ready' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <GalleryCard
              key={t.id}
              template={t}
              shape={appliedShape}
              shapeNames={shapeNames}
              tagNameById={tagNameById}
              selected={templateId === (t.render_template_id ?? t.id) && templateName === t.name}
              onApply={() => handleApply(t)}
            />
          ))}
          {visible.length === 0 && (
            <p className="col-span-full py-16 text-center text-xs text-gray-400">该标签下暂无模板。</p>
          )}
        </div>
      )}
    </div>
  );
}

interface GalleryCardProps {
  template: TemplateEntry;
  shape: NailShape;
  shapeNames: Record<string, string>;
  tagNameById: Map<string, string>;
  selected: boolean;
  onApply: () => void;
}

function GalleryCard({ template, shape, shapeNames, tagNameById, selected, onApply }: GalleryCardProps) {
  const tier = compatTier(template, shape);
  const reason = notRecommendedReason(template, shape);
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
        <span className="absolute bottom-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Check size={12} />
        </span>
      )}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        <img src={`/${template.thumbnail_url}`} alt={template.name} className="h-full w-full object-cover" loading="lazy" />
        {tier === 'high' && (
          <span className="absolute left-1.5 top-1.5 rounded-button bg-success px-1.5 py-0.5 text-nano font-medium text-white">
            推荐
          </span>
        )}
        {(template.asset_status === 'CONCEPT' || template.asset_status === 'SIMULATED') && (
          <span className="absolute right-1.5 top-1.5 rounded-button border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-nano font-medium text-amber-800">
            {template.asset_status === 'SIMULATED' ? '已签收模拟' : template.id === 't_petal_veil_french' ? 'HQ 候选 · 待签收' : '高保真概念'}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="truncate text-sm font-medium text-gray-900">{template.name}</span>
        <div className="flex flex-wrap gap-1">
          {template.style_tags.map((tag) => (
            <span key={tag} className="rounded-button bg-gray-100 px-1.5 py-0.5 text-nano text-gray-500">
              {tagNameById.get(tag) ?? tag}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-nano text-gray-500">
          {badges.best && <Badge variant="success" className="px-1 py-0 text-nano">★ {shapeName(badges.best)}</Badge>}
          {badges.good.length > 0 && (
            <Badge variant="gray" className="px-1 py-0 text-nano">✓ {badges.good.map(shapeName).join(', ')}</Badge>
          )}
          {badges.bad.length > 0 && (
            <Badge variant="warning" className="px-1 py-0 text-nano">⚠ {badges.bad.map(shapeName).join(', ')}</Badge>
          )}
        </div>
        {tier === 'not' && reason && (
          <p className="text-nano leading-snug text-warning">⚠ {reason}。仍可选择。</p>
        )}
        <div className="mt-auto pt-1.5">
          <Button size="sm" variant={selected ? 'secondary' : 'primary'} onClick={onApply} className="h-8 w-full text-xs">
            {selected ? '已应用 · 再次应用' : '应用此模板'}
          </Button>
        </div>
      </div>
    </div>
  );
}
