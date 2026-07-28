/**
 * 5×2 十指渲染器（DEV-PLAN §4.4 / §5.11 / Studio-PRD §12.4 · 七种预览状态）
 *
 * 唯一渲染路径（v1.4.1 起）：Back 手背 · NailSlot V2 —— 签收线稿 plate +
 * 界标仿射 matrix（back-v2.1.0），见 src/studio/render/BackPlatePreview。
 * Palm 掌心视图已按 MVP 收敛决策软删除（DEV-PLAN §5.11⑥）：
 * legacy anchor 渲染分支与 view 切换一并退役，资产归档不删除。
 * 长度切换：甲根固定、甲尖沿中轴伸缩（slotsForLength · length_rule 契约）。
 * - 异常：单指失败 → 灰甲型 + ⚠️ 降级（其余 9 指正常）；全部失败 → 刷新重试
 *   触发源为 Mock 场景注入面板（render.failAll / render.failFinger / render.timeout）
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Spinner, cx } from '@/design-system';
import type { FingerCode, FingerOverrides, NailLength, NailShape } from '@/lib/types';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import {
  PATTERN_BASE_LENGTH_MM,
  loadDecorations,
  loadPattern,
  loadSilhouette,
  type DecorationAsset,
  type SilhouetteAsset,
} from './nail-assets';
import { loadShapeParams, type ShapeParams } from './material-library';
import { registerPreviewSvg } from './export-png';
import { BackPlatePreview, loadBackPlateV2, slotsForLength, type BackPlateV2 } from '@/studio/render';
import type { NailLengthMm } from '@/studio/slots';

/** 十指中文标签（UI 展示用） */
export const FINGER_LABEL: Record<FingerCode, string> = {
  L1: '左·拇指', L2: '左·食指', L3: '左·中指', L4: '左·无名指', L5: '左·小指',
  R1: '右·拇指', R2: '右·食指', R3: '右·中指', R4: '右·无名指', R5: '右·小指',
};

type LoadStatus = 'loading' | 'ready' | 'error';

interface BaseAssets {
  /** NailSlot V2 签收线稿 + 界标仿射（back-v2.1.0） */
  backV2: BackPlateV2;
  silhouette: SilhouetteAsset;
  params: ShapeParams;
  decorations: DecorationAsset[];
}

export interface TenFingerPreviewProps {
  shape: NailShape;
  length: NailLength;
  templateId: string | null;
  baseColor: string;
  fingerOverrides?: FingerOverrides;
  selectedFinger?: FingerCode | null;
  onFingerClick?: (finger: FingerCode) => void;
  readOnly?: boolean;
  className?: string;
}

export function TenFingerPreview({
  shape,
  length,
  templateId,
  baseColor,
  fingerOverrides,
  selectedFinger = null,
  onFingerClick,
  readOnly = false,
  className,
}: TenFingerPreviewProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const mockFlags = useMockScenarios((s) => s.flags);
  const failFinger = useMockScenarios((s) => s.failFinger);
  const failAll = isScenarioOn(mockFlags, 'render.failAll');
  const timeoutOn = isScenarioOn(mockFlags, 'render.timeout');
  const failFingerOn = isScenarioOn(mockFlags, 'render.failFinger');

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [base, setBase] = useState<BaseAssets | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  /* ── 状态 1/5：基础资产加载（改甲型/长度 → 重新渲染骨架） ── */
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setBase(null);
    (async () => {
      try {
        if (failAll) throw new Error('预览渲染失败（MOCK）');
        if (timeoutOn) {
          // Mock：渲染 > 8s 未完成 → 全部失败
          await new Promise((r) => window.setTimeout(r, 8000));
          throw new Error('预览加载超时（MOCK）');
        }
        const [backV2, silhouette, params, decorations] = await Promise.all([
          loadBackPlateV2(),
          loadSilhouette(shape, length),
          loadShapeParams(),
          loadDecorations(),
        ]);
        if (cancelled) return;
        setBase({ backV2, silhouette, params, decorations });
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shape, length, retryKey, failAll, timeoutOn]);

  /* ── 状态 3：应用模板（淡出 150ms → 新渲染淡入 200ms） ── */
  const [patternMarkup, setPatternMarkup] = useState<string | null>(null);
  /** 已渲染图案的 key：`${templateId}/${shape}`（图案按甲型独立适配，改甲型需重载） */
  const [patternKey, setPatternKey] = useState<string | null>(null);
  const [patternVisible, setPatternVisible] = useState(true);
  const patternFadeMs = patternVisible ? 200 : 150;

  useEffect(() => {
    if (status !== 'ready') return;
    const nextKey = templateId ? `${templateId}/${shape}` : null;
    if (nextKey === patternKey) return;
    let cancelled = false;
    const first = patternKey === null;
    setPatternVisible(false);
    const timer = window.setTimeout(
      () => {
        (async () => {
          if (!templateId) {
            if (!cancelled) {
              setPatternMarkup(null);
              setPatternKey(null);
              setPatternVisible(true);
            }
            return;
          }
          try {
            const p = await loadPattern(templateId, shape);
            if (cancelled) return;
            setPatternMarkup(p.innerMarkup);
            setPatternKey(nextKey);
            setPatternVisible(true);
          } catch {
            // 图案加载失败：降级为纯底色（不清空已选模板，Mock 面板可注入整体失败）
            if (!cancelled) {
              setPatternMarkup(null);
              setPatternKey(nextKey);
              setPatternVisible(true);
            }
          }
        })();
      },
      first ? 0 : 150,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, shape, status]);

  /* ── 注册 svg 供导出 PNG / 缩略图 ── */
  useEffect(() => {
    registerPreviewSvg(svgRef.current);
    return () => registerPreviewSvg(null);
  }, [status]);

  const lengthMm = base?.params.lengths[length].lengthMm ?? PATTERN_BASE_LENGTH_MM;
  const widthMm = base?.params.lengths[length].widthMm ?? 11;
  const patternK = lengthMm / PATTERN_BASE_LENGTH_MM;

  const decorationById = useMemo(() => {
    const map = new Map<string, DecorationAsset>();
    base?.decorations.forEach((d) => map.set(d.id, d));
    return map;
  }, [base]);

  const failedFingers = useMemo(() => {
    const set = new Set<FingerCode>();
    if (failFingerOn) set.add(failFinger);
    return set;
  }, [failFingerOn, failFinger]);

  return (
    <div className={cx('relative overflow-hidden rounded-card border border-gray-200 bg-white', className)}>
      {/* 状态 7：全部失败 */}
      {status === 'error' && (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3">
          <p className="text-sm text-gray-700">预览加载失败。请刷新页面重试。</p>
          <Button size="sm" variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            <RefreshCw size={13} />
            刷新
          </Button>
        </div>
      )}

      {status !== 'error' && (
        <div className="relative">
          {status === 'loading' && (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-canvas">
              <Spinner size={28} className="text-primary" />
              <p className="text-xs text-gray-500">正在生成十指预览…</p>
            </div>
          )}

          {/* NailSlot V2 标定线稿渲染路径（Back 手背，唯一视图） */}
          {status === 'ready' && base && (
            <BackPlatePreview
              plate={base.backV2}
              slots={slotsForLength(base.backV2, lengthMm as NailLengthMm)}
              silhouetteD={base.silhouette.d}
              widthMm={widthMm}
              lengthMm={lengthMm}
              baseColor={baseColor}
              fingerOverrides={fingerOverrides}
              patternMarkup={patternMarkup}
              patternK={patternK}
              patternVisible={patternVisible}
              patternFadeMs={patternFadeMs}
              decorationById={decorationById}
              failedFingers={failedFingers}
              selectedFinger={selectedFinger}
              onFingerClick={onFingerClick}
              readOnly={readOnly}
              rawId={rawId}
              svgRef={svgRef}
              fingerLabel={(fc) => FINGER_LABEL[fc]}
            />
          )}
        </div>
      )}
    </div>
  );
}
