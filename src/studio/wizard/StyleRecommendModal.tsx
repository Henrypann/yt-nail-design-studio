/**
 * 风格推荐弹窗（DEV-PLAN v1.3.0 · Wizard 框架）
 *
 * 选定甲型后、进入 STEP 2 画布前弹出：与甲型匹配的当下流行风格推荐，
 * YouTube 封面式 16:9 大卡 + 适配长度 + 推荐理由。
 * 数据一律 fetch 自 /assets/styles/manifest.json（不硬编码）；
 * 选中风格 → 映射 material-library 模板自动应用；[暂不选择] 直接进入画布。
 * MOCK 封面强制标注，不得以占位图冒充正式图（入库红线）。
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { Badge, Button, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { NailLength, NailShape } from '@/lib/types';
import { loadShapeCapabilities } from '@/studio/preview/material-library';

export interface StyleRecommendation {
  id: string;
  name: string;
  name_en: string;
  priority: number;
  best_lengths: NailLength[];
  best_length_label: string;
  reason: string;
  cover_url: string;
  cover_status: 'REAL' | 'MOCK';
  template_id: string | null;
}

interface StyleManifest {
  recommendations: Partial<Record<NailShape, StyleRecommendation[]>>;
}

export interface StyleRecommendModalProps {
  open: boolean;
  shape: NailShape | null;
  length: NailLength | null;
  onSelect: (style: StyleRecommendation) => void;
  onSkip: () => void;
}

export function StyleRecommendModal({ open, shape, length, onSelect, onSkip }: StyleRecommendModalProps) {
  const { locale, text } = useLocale();
  const [styles, setStyles] = useState<StyleRecommendation[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [shapeLabel, setShapeLabel] = useState('');

  useEffect(() => {
    if (!open || !shape) return;
    let cancelled = false;
    loadShapeCapabilities()
      .then((registry) => {
        if (cancelled) return;
        setShapeLabel(registry.shapes.find((item) => item.id === shape)?.label_en ?? shape);
      })
      .catch(() => {
        if (!cancelled) setShapeLabel(shape);
      });
    fetch('/assets/styles/manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<StyleManifest>;
      })
      .then((m) => {
        if (cancelled) return;
        const list = [...(m.recommendations[shape] ?? [])].sort((a, b) => a.priority - b.priority);
        setStyles(list);
        setLoadFailed(list.length === 0);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shape]);

  /* Esc 跳过 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onSkip]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="风格推荐"
      data-debug-id="studio.wizard.style-recommend-modal"
    >
      <div className="w-full max-w-[1060px] rounded-panel bg-white shadow-modal animate-modal-in">
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
            className="rounded-button p-1.5 text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* 卡片区：桌面 3 列，窄屏纵向 */}
        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-3">
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
                  <img
                    src={st.cover_url}
                    alt={`${st.name_en} 风格封面`}
                    className="h-full w-full object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                    TOP {st.priority}
                  </span>
                  {st.cover_status === 'MOCK' && (
                    <span className="absolute right-2 top-2">
                      <Badge variant="gray" className="text-[10px]">MOCK 占位图</Badge>
                    </span>
                  )}
                </div>

                {/* 文案区 */}
                <div className="flex flex-1 flex-col gap-1.5 px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{locale === 'en' ? st.name_en : st.name}</span>
                    {locale === 'zh' && <span className="truncate text-[11px] text-gray-400">{st.name_en}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500">最佳长度 {st.best_length_label}</span>
                    {lengthFit && (
                      <Badge variant="success" className="text-[10px]">适配当前长度</Badge>
                    )}
                  </div>
                  <p className="line-clamp-3 text-xs leading-relaxed text-gray-600">{st.reason}</p>
                  <div className="mt-auto pt-2">
                    <Button size="sm" className="w-full" onClick={() => onSelect(st)}>
                      {text('选用此风格', 'Use this look')}
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
          <Button variant="ghost" size="sm" onClick={onSkip}>
            {text('暂不选择，直接进入画布', 'Skip and open canvas')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
