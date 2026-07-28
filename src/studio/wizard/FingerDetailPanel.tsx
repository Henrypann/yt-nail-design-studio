/**
 * 右栏常驻单指详情（视图 3 · 单指细节的紧凑形态，宽度 ≥240px）
 *
 * 任何视图里点击手指，这里同步更新；[放大查看] 切换到单指细节展开形态。
 * 未选中手指时展示引导占位。渲染与三视图共享 useNailDesignAssets + FingerNailContent。
 */

import { useMemo } from 'react';
import { Maximize2 } from 'lucide-react';
import { Spinner } from '@/design-system';
import type { FingerCode, FingerOverrides, NailLength, NailShape } from '@/lib/types';
import type { DecorationAsset } from '@/studio/preview/nail-assets';
import { useNailDesignAssets } from '@/studio/preview/use-nail-design-assets';
import { FingerNailContent } from '@/studio/render';
import { FINGER_LABEL } from '@/studio/preview/TenFingerPreview';

export interface FingerDetailPanelProps {
  shape: NailShape;
  length: NailLength;
  templateId: string | null;
  baseColor: string;
  fingerOverrides?: FingerOverrides;
  selectedFinger: FingerCode | null;
  /** [放大查看] → 切到单指细节展开形态 */
  onExpand?: () => void;
}

export function FingerDetailPanel({
  shape,
  length,
  templateId,
  baseColor,
  fingerOverrides,
  selectedFinger,
  onExpand,
}: FingerDetailPanelProps) {
  const assets = useNailDesignAssets(shape, length, templateId);
  const { status, silhouette, patternMarkup, patternVisible, patternFadeMs, failedFingers, patternK } = assets;

  const decorationById = useMemo(() => {
    const map = new Map<string, DecorationAsset>();
    assets.decorations.forEach((d) => map.set(d.id, d));
    return map;
  }, [assets.decorations]);

  const strokeScale = useMemo(() => {
    const w = Number(silhouette?.viewBox.split(/\s+/)[2] ?? 120);
    return 220 / w;
  }, [silhouette]);

  return (
    <section
      data-debug-id="studio.wizard.step2.finger-detail"
      className="flex shrink-0 flex-col gap-2 rounded-card border border-gray-200 bg-white p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">单指详情</p>
        {selectedFinger && onExpand && (
          <button
            onClick={onExpand}
            className="flex items-center gap-1 rounded-button px-1.5 py-0.5 text-[10px] text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700"
            title="切换到单指细节视图"
          >
            <Maximize2 size={11} />
            放大查看
          </button>
        )}
      </div>

      {!selectedFinger ? (
        <p className="py-6 text-center text-xs leading-relaxed text-gray-400">
          点击任意视图中的指甲，
          <br />
          这里会同步显示该指细节。
        </p>
      ) : status !== 'ready' || !silhouette ? (
        <div className="flex items-center justify-center py-6">
          <Spinner size={20} className="text-primary" />
        </div>
      ) : (
        <FingerDetailBody
          finger={selectedFinger}
          silhouetteD={silhouette.d}
          viewBox={silhouette.viewBox}
          baseColor={baseColor}
          override={fingerOverrides?.[selectedFinger]}
          patternMarkup={patternMarkup}
          patternK={patternK}
          patternVisible={patternVisible}
          patternFadeMs={patternFadeMs}
          failed={failedFingers.has(selectedFinger)}
          decorationById={decorationById}
          strokeScale={strokeScale}
        />
      )}
    </section>
  );
}

function FingerDetailBody({
  finger,
  silhouetteD,
  viewBox,
  baseColor,
  override,
  patternMarkup,
  patternK,
  patternVisible,
  patternFadeMs,
  failed,
  decorationById,
  strokeScale,
}: {
  finger: FingerCode;
  silhouetteD: string;
  viewBox: string;
  baseColor: string;
  override?: { baseColor?: string; decorationId?: string | null };
  patternMarkup: string | null;
  patternK: number;
  patternVisible: boolean;
  patternFadeMs: number;
  failed: boolean;
  decorationById: Map<string, DecorationAsset>;
  strokeScale: number;
}) {
  const color = override?.baseColor ?? baseColor;
  const decoration = override?.decorationId ? decorationById.get(override.decorationId) : undefined;
  const clipId = `detail-clip-${finger}`;
  return (
    <>
      <div className="relative flex justify-center">
        {failed && <span className="absolute left-1 top-1 z-10 text-sm">⚠️</span>}
        <svg viewBox={viewBox} className="h-auto w-[220px] max-w-full select-none">
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={silhouetteD} />
            </clipPath>
          </defs>
          <FingerNailContent
            finger={finger}
            silhouetteD={silhouetteD}
            clipId={clipId}
            baseColor={color}
            failed={failed}
            selected={false}
            patternMarkup={patternMarkup}
            patternK={patternK}
            patternVisible={patternVisible}
            patternFadeMs={patternFadeMs}
            decoration={decoration}
            strokeScale={strokeScale}
            readOnly
            fingerLabel={FINGER_LABEL[finger]}
          />
        </svg>
      </div>
      <div className="flex flex-col gap-1 text-[11px] text-gray-600">
        <p className="font-medium text-gray-900">
          {finger} · {FINGER_LABEL[finger]}
        </p>
        <p className="flex items-center gap-1.5">
          底色
          <span className="inline-block h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: color }} />
          <span className="tnum">{color}</span>
          {override?.baseColor && <span style={{ color: '#C2497A' }}>（单独定制）</span>}
        </p>
        <p>
          附件{decoration ? `：${decoration.name}` : '：无'}
          {override?.decorationId && <span style={{ color: '#C2497A' }}>（单独定制）</span>}
        </p>
      </div>
    </>
  );
}
