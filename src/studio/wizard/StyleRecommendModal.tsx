/**
 * 风格推荐弹窗（DEV-PLAN v1.3.0 · Wizard 框架）
 *
 * 选定甲型后、进入 STEP 2 画布前弹出：与甲型匹配的当下流行风格推荐，
 * YouTube 封面式 16:9 大卡 + 适配长度 + 推荐理由。
 * 数据一律 fetch 自 /assets/styles/manifest.json（不硬编码）；
 * 选中风格 → 映射 material-library 模板自动应用；[暂不选择] 直接进入画布。
 * 封面证据等级：
 * - REAL：正式摄影/签收素材；
 * - CONCEPT：高保真概念方向，必须声明 V7 结构化配方或近似基础模板的实际能力；
 * - MOCK：程序占位图。
 * 三者必须显式标注，不得把 Editorial Concept 冒充 Canonical Renderer 输出。
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { Badge, Button, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { NailLength, NailShape } from '@/lib/types';
import { loadLibraryIndex, loadShapeCapabilities } from '@/studio/preview/material-library';
import { filterResolvableStyleRecommendations } from '@/studio/preview/resolve-template';
import { createRecommendationRequestGate, partitionStyles } from './partition-styles';

export interface StyleRecommendation {
  id: string;
  name: string;
  name_en: string;
  priority: number;
  featured?: boolean;
  best_lengths: NailLength[];
  best_length_label: string;
  reason: string;
  cover_url: string;
  cover_status: 'REAL' | 'CONCEPT' | 'MOCK';
  preview_fidelity?: 'CANONICAL' | 'APPROXIMATE';
  concept_note?: string;
  base_template_name?: string;
  asset_spec_url?: string;
  template_id: string | null;
  recipe_ref?: { id: string; version: string; preset_id: string };
}

interface StyleManifest {
  recommendations: Partial<Record<NailShape, StyleRecommendation[]>>;
}

export interface StyleRecommendModalProps {
  open: boolean;
  shape: NailShape | null;
  length: NailLength | null;
  onSelect: (style: StyleRecommendation) => void | Promise<void>;
  onSkip: () => void;
}

export function StyleRecommendModal({ open, shape, length, onSelect, onSkip }: StyleRecommendModalProps) {
  const { locale, text } = useLocale();
  const [styles, setStyles] = useState<StyleRecommendation[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [shapeLabel, setShapeLabel] = useState('');
  const [failedCovers, setFailedCovers] = useState<Set<string>>(() => new Set());
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const requestGate = useRef(createRecommendationRequestGate());

  useEffect(() => {
    if (!open || !shape) return;
    const requestToken = requestGate.current.begin();
    setStyles([]);
    setLoadFailed(false);
    setFailedCovers(new Set());
    setSelectingId(null);
    setShapeLabel(shape);
    loadShapeCapabilities()
      .then((registry) => {
        if (!requestGate.current.isCurrent(requestToken)) return;
        setShapeLabel(registry.shapes.find((item) => item.id === shape)?.label_en ?? shape);
      })
      .catch(() => {
        if (requestGate.current.isCurrent(requestToken)) setShapeLabel(shape);
      });
    Promise.all([
      fetch('/assets/styles/manifest.json').then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<StyleManifest>;
      }),
      loadLibraryIndex(),
    ])
      .then(([manifest, index]) => {
        if (!requestGate.current.isCurrent(requestToken)) return;
        // 程序化 MOCK 只属于内部资产 QA，不进入面向设计师的推荐主路径。
        const valid = filterResolvableStyleRecommendations(manifest.recommendations[shape] ?? [], index)
          .filter((style) => style.cover_status !== 'MOCK');
        const partitioned = partitionStyles(valid);
        const list = [...partitioned.primary, ...partitioned.concept];
        setStyles(list);
        setLoadFailed(list.length === 0);
      })
      .catch(() => {
        if (requestGate.current.isCurrent(requestToken)) setLoadFailed(true);
      });
    return () => {
      requestGate.current.invalidate(requestToken);
    };
  }, [open, shape]);

  const selectStyle = async (style: StyleRecommendation) => {
    if (selectingId) return;
    setSelectingId(style.id);
    try {
      await onSelect(style);
    } finally {
      setSelectingId(null);
    }
  };

  /* Esc 跳过 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectingId === null) onSkip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onSkip, selectingId]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="风格推荐"
      data-debug-id="studio.wizard.style-recommend-modal"
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[1060px] flex-col overflow-hidden rounded-panel bg-white shadow-modal animate-modal-in">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Sparkles size={16} className="text-primary" />
              {text(
                `为 ${shapeLabel || shape || '当前甲型'} 推荐当下流行风格`,
                `Trending looks for ${shapeLabel || shape || 'this shape'}`,
              )}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {text('选择一款直接进入画布（自动应用匹配模板），或跳过自行搭配', 'Choose a look to apply its template, or skip and design freely')}
            </p>
          </div>
          <button
            onClick={onSkip}
            disabled={selectingId !== null}
            className="rounded-button p-1.5 text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* 卡片区：桌面 3 列，窄屏纵向 */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-3 sm:px-6 sm:py-5">
          {loadFailed && (
            <p className="col-span-full py-8 text-center text-sm text-gray-500">
              风格推荐加载失败，可直接进入画布自行搭配。
            </p>
          )}
          {styles.map((st) => {
            const lengthFit = length !== null && st.best_lengths.includes(length);
            return (
              <div
                key={st.id}
                className={cx(
                  'group flex flex-col overflow-hidden rounded-card border bg-white',
                  'transition-all duration-base ease-out hover:-translate-y-0.5 hover:shadow-float',
                  lengthFit ? 'border-gray-200' : 'border-gray-100',
                )}
              >
                {/* 16:9 封面（YouTube 封面比例） */}
                <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                  {failedCovers.has(st.id) ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-gray-500">
                      {text('封面暂不可用，模板仍可安全应用', 'Cover unavailable; the validated template can still be applied')}
                    </div>
                  ) : (
                    <img
                      src={st.cover_url}
                      alt={`${st.name_en} 风格封面`}
                      className="h-full w-full object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
                      loading="lazy"
                      onError={() => setFailedCovers((current) => new Set(current).add(st.id))}
                    />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-nano font-medium text-amber-200">
                    TOP {st.priority}
                  </span>
                  {st.cover_status === 'CONCEPT' && (
                    <span className="absolute right-2 top-2">
                      <Badge variant="warning" className="bg-white/90 text-nano backdrop-blur-sm">
                        高保真概念
                      </Badge>
                    </span>
                  )}
                </div>

                {/* 文案区 */}
                <div className="flex flex-1 flex-col gap-1.5 px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{locale === 'en' ? st.name_en : st.name}</span>
                    {locale === 'zh' && <span className="truncate text-nano text-gray-400">{st.name_en}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-nano">
                    <span className="text-gray-500">最佳长度 {st.best_length_label}</span>
                    {lengthFit && (
                      <Badge variant="success" className="text-nano">适配当前长度</Badge>
                    )}
                  </div>
                  <p className="line-clamp-3 text-xs leading-relaxed text-gray-600">{st.reason}</p>
                  {st.cover_status === 'CONCEPT' && (
                    <div className="rounded-button border border-warning/20 bg-warning-soft px-2 py-1.5 text-nano leading-relaxed text-warning">
                      <p>{st.concept_note ?? '概念封面用于审美方向；当前画布为近似基础方案。'}</p>
                      {st.base_template_name && (
                        <p className="mt-0.5 opacity-80">{st.recipe_ref ? '基础渲染：' : '当前应用：'}{st.base_template_name}</p>
                      )}
                      {st.asset_spec_url && (
                        <a
                          href={st.asset_spec_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block font-medium underline underline-offset-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          查看 Asset Spec
                        </a>
                      )}
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    <Button
                      size="sm"
                      className="w-full"
                      loading={selectingId === st.id}
                      disabled={selectingId !== null && selectingId !== st.id}
                      onClick={() => void selectStyle(st)}
                    >
                      {st.cover_status === 'CONCEPT'
                        ? st.recipe_ref
                          ? text('应用 V7 配方方案', 'Apply V7 recipe')
                          : text('应用近似基础方案', 'Apply approximate base')
                        : text('选用此风格', 'Use this look')}
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end border-t border-gray-200 px-6 py-3">
          <Button variant="ghost" size="sm" disabled={selectingId !== null} onClick={onSkip}>
            {text('暂不选择，直接进入画布', 'Skip and open canvas')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
