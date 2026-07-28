/**
 * 甲型卡片 + 长度按钮（STEP 1 门禁共用：首次进入与顶栏 [修改] 编辑态）
 *
 * - 6 甲型卡片：线稿 SVG（material-library/shapes/silhouettes/）+ 名称，默认/悬浮/选中三态
 * - 4 长度按钮：选中显示毫米值；甲型线稿随长度联动伸缩（切换对应长度 silhouette）
 * - 数据全部来自 material-library（shape-params + silhouettes），不硬编码
 */

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cx } from '@/design-system';
import type { NailLength, NailShape } from '@/lib/types';
import { loadSilhouette, silhouetteFileName, type SilhouetteAsset } from '@/studio/preview/nail-assets';
import { loadShapeParams, type ShapeParams } from '@/studio/preview/material-library';

const SHAPE_ORDER: NailShape[] = ['almond', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
const LENGTH_ORDER: NailLength[] = ['short', 'medium', 'long', 'extra-long'];

/**
 * MVP 收敛（DEV-PLAN v1.3.0）：仅 almond 可选，
 * 其余甲型置灰禁用并标注「即将推出」，曲线/资产验收通过后逐型开放。
 */
const MVP_ENABLED_SHAPES: ReadonlySet<NailShape> = new Set(['almond']);

/** 加载某长度下全部 6 甲型线稿（模块缓存，切换长度仅拉新长度档） */
function useSilhouettes(length: NailLength): Partial<Record<NailShape, SilhouetteAsset>> {
  const [map, setMap] = useState<Partial<Record<NailShape, SilhouetteAsset>>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SHAPE_ORDER.map((shape) =>
        loadSilhouette(shape, length).then((asset) => [shape, asset] as const),
      ),
    )
      .then((entries) => {
        if (cancelled) return;
        setMap(Object.fromEntries(entries));
      })
      .catch(() => {
        /* 单个线稿失败不阻塞选择：卡片降级为占位框 */
      });
    return () => {
      cancelled = true;
    };
  }, [length]);
  return map;
}

export interface ShapeLengthPickerProps {
  shape: NailShape | null;
  length: NailLength | null;
  onShapeChange: (s: NailShape) => void;
  onLengthChange: (l: NailLength) => void;
}

export function ShapeLengthPicker({ shape, length, onShapeChange, onLengthChange }: ShapeLengthPickerProps) {
  const [params, setParams] = useState<ShapeParams | null>(null);
  useEffect(() => {
    loadShapeParams().then(setParams).catch(() => undefined);
  }, []);

  const effectiveLength = length ?? 'medium'; // 未选长度时线稿按 medium 展示
  const silhouettes = useSilhouettes(effectiveLength);

  return (
    <div className="flex flex-col gap-4">
      {/* 甲型卡片 */}
      <div>
        <p className="mb-2 text-xs font-medium text-gray-700">甲型</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SHAPE_ORDER.map((s) => {
            const sil = silhouettes[s];
            const selected = shape === s;
            const enabled = MVP_ENABLED_SHAPES.has(s);
            const lengthMm = params?.lengths[effectiveLength].lengthMm ?? 18;
            return (
              <button
                key={s}
                onClick={() => enabled && onShapeChange(s)}
                disabled={!enabled}
                title={enabled ? undefined : '即将推出：MVP 阶段仅开放杏仁形'}
                className={cx(
                  'group relative flex flex-col items-center gap-1 rounded-card border bg-white px-2 pb-2 pt-3',
                  'transition-all duration-fast ease-out',
                  selected
                    ? 'border-2 border-primary bg-primary-soft'
                    : enabled
                      ? 'border-gray-200 hover:border-primary'
                      : 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60',
                )}
                aria-pressed={selected}
              >
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                    <Check size={10} />
                  </span>
                )}
                {/* 线稿随长度联动伸缩：svg 高度 ∝ lengthMm，底部对齐 */}
                <span
                  className={cx(
                    'flex h-20 items-end transition-colors duration-fast',
                    enabled ? 'text-gray-500 group-hover:text-primary' : 'text-gray-300',
                  )}
                >
                  {sil ? (
                    <svg
                      viewBox={sil.viewBox}
                      preserveAspectRatio="xMidYMax meet"
                      style={{ height: `${Math.round(lengthMm * 2.6)}px` }}
                      className="transition-all duration-base ease-out"
                    >
                      <path
                        d={sil.d}
                        fill={selected ? 'rgba(194,73,122,0.08)' : 'none'}
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span
                      className="block w-8 rounded-t-full bg-gray-100 animate-skeleton-pulse"
                      style={{ height: `${Math.round(lengthMm * 2.6)}px` }}
                    />
                  )}
                </span>
                <span
                  className={cx(
                    'text-xs transition-colors duration-fast',
                    selected
                      ? 'font-medium text-primary'
                      : enabled
                        ? 'text-gray-600 group-hover:text-gray-900'
                        : 'text-gray-400',
                  )}
                >
                  {params?.shapes[s].name ?? silhouetteFileName(s, effectiveLength).split('_')[0]}
                </span>
                {!enabled && (
                  <span className="rounded-full bg-gray-200 px-1.5 py-px text-[10px] text-gray-500">
                    即将推出
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 长度按钮 */}
      <div>
        <p className="mb-2 text-xs font-medium text-gray-700">长度</p>
        <div className="flex gap-2">
          {LENGTH_ORDER.map((l) => {
            const meta = params?.lengths[l];
            const selected = length === l;
            return (
              <button
                key={l}
                onClick={() => onLengthChange(l)}
                className={cx(
                  'flex h-9 items-center gap-1.5 rounded-button border px-4 text-sm',
                  'transition-colors duration-fast ease-out',
                  selected
                    ? 'border-primary bg-primary font-medium text-primary-foreground'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                )}
                aria-pressed={selected}
              >
                {meta?.name ?? l}
                {selected && meta && <span className="text-xs opacity-80 tnum">{meta.lengthMm}mm</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
