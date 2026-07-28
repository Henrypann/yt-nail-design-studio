/**
 * 甲型能力目录 + 长度选择。
 *
 * - Tier 1：5 个主流甲型常驻平铺。
 * - Tier 2：10 个扩展甲型折叠展示。
 * - 注册可见与几何/模板可用性解耦；点击门禁由 shape-capabilities 统一决定。
 * - 轮廓只从 shape-params 的生成 SVG 读取，不在组件内保存第二份几何。
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '@/design-system';
import type { NailLength, NailShape } from '@/lib/types';
import { loadSilhouette, type SilhouetteAsset } from '@/studio/preview/nail-assets';
import {
  isWizardShapeEnabled,
  loadShapeCapabilities,
  loadShapeParams,
  shapeAvailabilityLabel,
  type ShapeCapability,
  type ShapeCapabilitiesRegistry,
  type ShapeParams,
} from '@/studio/preview/material-library';

const LENGTH_ORDER: NailLength[] = ['short', 'medium', 'long', 'extra-long'];

function sortCapabilities(shapes: ShapeCapability[]): ShapeCapability[] {
  return [...shapes].sort((a, b) => a.order - b.order);
}

/** 只加载已有 geometry_id 的轮廓；产品占位不会发起必然失败的 SVG 请求。 */
function useSilhouettes(
  capabilities: ShapeCapability[],
  length: NailLength,
): Partial<Record<NailShape, SilhouetteAsset>> {
  const [map, setMap] = useState<Partial<Record<NailShape, SilhouetteAsset>>>({});

  useEffect(() => {
    let cancelled = false;
    const geometryShapes = capabilities.filter((shape) => shape.geometry_id !== null);
    Promise.allSettled(
      geometryShapes.map(async (shape) => {
        const asset = await loadSilhouette(shape.geometry_id!, length);
        return [shape.id, asset] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      const entries = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      setMap(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [capabilities, length]);

  return map;
}

export interface ShapeLengthPickerProps {
  shape: NailShape | null;
  length: NailLength | null;
  onShapeChange: (shape: NailShape) => void;
  onLengthChange: (length: NailLength) => void;
}

interface ShapeCardProps {
  capability: ShapeCapability;
  silhouette?: SilhouetteAsset;
  selected: boolean;
  lengthMm: number;
  onSelect: (shape: NailShape) => void;
}

function ShapeCard({ capability, silhouette, selected, lengthMm, onSelect }: ShapeCardProps) {
  const enabled = isWizardShapeEnabled(capability);
  const availability = shapeAvailabilityLabel(capability);
  const unavailableReason = `${capability.label}·${availability}`;

  return (
    <button
      type="button"
      onClick={() => {
        if (enabled) onSelect(capability.id);
      }}
      aria-disabled={!enabled}
      aria-pressed={selected}
      data-shape-id={capability.id}
      data-shape-tier={capability.tier}
      data-wizard-enabled={enabled}
      title={enabled ? capability.label : unavailableReason}
      className={cx(
        'group relative flex min-w-0 flex-col items-center gap-1 rounded-card border bg-white px-2 pb-2 pt-3',
        'transition-all duration-fast ease-out',
        selected
          ? 'border-2 border-primary bg-primary-soft'
          : enabled
            ? 'border-gray-200 hover:border-primary'
            : 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-65',
      )}
    >
      {selected && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
          <Check size={10} />
        </span>
      )}

      <span
        className={cx(
          'flex h-20 items-end transition-colors duration-fast',
          enabled ? 'text-gray-500 group-hover:text-primary' : 'text-gray-300',
        )}
      >
        {silhouette ? (
          <svg
            viewBox={silhouette.viewBox}
            preserveAspectRatio="xMidYMax meet"
            style={{ height: `${Math.round(lengthMm * 2.6)}px` }}
            className="max-w-full transition-all duration-base ease-out"
            aria-hidden="true"
          >
            <path
              d={silhouette.d}
              fill={selected ? 'rgba(194,73,122,0.08)' : 'none'}
              stroke="currentColor"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span
            className="block w-8 rounded-t-[45%] border border-dashed border-current bg-white/50"
            style={{ height: `${Math.round(lengthMm * 2.6)}px` }}
            aria-hidden="true"
          />
        )}
      </span>

      <span
        className={cx(
          'truncate text-xs transition-colors duration-fast',
          selected
            ? 'font-medium text-primary'
            : enabled
              ? 'text-gray-600 group-hover:text-gray-900'
              : 'text-gray-400',
        )}
      >
        {capability.label}
      </span>

      {!enabled && (
        <span className="rounded-full bg-gray-200 px-1.5 py-px text-[10px] leading-4 text-gray-500">
          {availability}
        </span>
      )}
    </button>
  );
}

export function ShapeLengthPicker({ shape, length, onShapeChange, onLengthChange }: ShapeLengthPickerProps) {
  const [params, setParams] = useState<ShapeParams | null>(null);
  const [registry, setRegistry] = useState<ShapeCapabilitiesRegistry | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tierTwoOpen, setTierTwoOpen] = useState(false);

  useEffect(() => {
    Promise.all([loadShapeParams(), loadShapeCapabilities()])
      .then(([nextParams, nextRegistry]) => {
        setParams(nextParams);
        setRegistry(nextRegistry);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  const tierOne = useMemo(
    () => sortCapabilities(registry?.shapes.filter((item) => item.tier === 1) ?? []),
    [registry],
  );
  const tierTwo = useMemo(
    () => sortCapabilities(registry?.shapes.filter((item) => item.tier === 2) ?? []),
    [registry],
  );
  const allCapabilities = useMemo(() => [...tierOne, ...tierTwo], [tierOne, tierTwo]);
  const effectiveLength = length ?? 'medium';
  const silhouettes = useSilhouettes(allCapabilities, effectiveLength);
  const lengthMm = params?.lengths[effectiveLength].lengthMm ?? 18;

  const renderShapeGrid = (items: ShapeCapability[]) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((capability) => (
        <ShapeCard
          key={capability.id}
          capability={capability}
          silhouette={silhouettes[capability.id]}
          selected={shape === capability.id}
          lengthMm={lengthMm}
          onSelect={onShapeChange}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-medium text-gray-700">甲型</p>
        {loadFailed ? (
          <div role="alert" className="rounded-card border border-error/20 bg-error-soft px-3 py-2 text-xs text-error">
            甲型目录加载失败，请刷新后重试。
          </div>
        ) : (
          <>
            {renderShapeGrid(tierOne)}
            <div className="mt-2 overflow-hidden rounded-card border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setTierTwoOpen((open) => !open)}
                aria-expanded={tierTwoOpen}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <span>更多甲型（{tierTwo.length}）</span>
                <ChevronDown
                  size={15}
                  className={cx('transition-transform duration-fast', tierTwoOpen && 'rotate-180')}
                />
              </button>
              {tierTwoOpen && <div className="border-t border-gray-100 p-2">{renderShapeGrid(tierTwo)}</div>}
            </div>
          </>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-gray-700">长度</p>
        <div className="flex flex-wrap gap-2">
          {LENGTH_ORDER.map((item) => {
            const meta = params?.lengths[item];
            const selected = length === item;
            return (
              <button
                type="button"
                key={item}
                onClick={() => onLengthChange(item)}
                className={cx(
                  'flex h-9 items-center gap-1.5 rounded-button border px-4 text-sm',
                  'transition-colors duration-fast ease-out',
                  selected
                    ? 'border-primary bg-primary font-medium text-primary-foreground'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                )}
                aria-pressed={selected}
              >
                {meta?.name ?? item}
                {selected && meta && <span className="text-xs opacity-80 tnum">{meta.lengthMm}mm</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
