/**
 * 指甲设计资产共享 Hook（三视图共用：整体搭配 / 十指平铺 / 单指细节）
 *
 * 从 TenFingerPreview 抽取的加载逻辑，行为保持一致：
 * - 基础资产：silhouette + shape-params + decorations（可选 Back V2 plate/slots）
 * - 模板图案：淡出 150ms → 新渲染淡入 200ms；失败显式报错并允许重试
 * - Mock 场景注入：render.failAll / render.timeout / render.failFinger
 * 全部 fetch 走 nail-assets / material-library 的模块级缓存，多视图挂载不重复拉取。
 */

import { useEffect, useMemo, useState } from 'react';
import type { FingerCode, NailLength, NailShape } from '@/lib/types';
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
import { loadBackPlateV2, type BackPlateV2 } from '@/studio/render';

export type NailAssetsStatus = 'loading' | 'ready' | 'error';

export interface NailDesignAssets {
  status: NailAssetsStatus;
  /** 失败态 [刷新]：重新触发基础资产加载 */
  retry: () => void;
  /** NailSlot V2 签收线稿 + 界标仿射（needPlate 时加载） */
  backV2: BackPlateV2 | null;
  silhouette: SilhouetteAsset | null;
  params: ShapeParams | null;
  decorations: DecorationAsset[];
  /** 模板图案内部标记（已 id 唯一化），无模板 / 加载失败降级为 null */
  patternMarkup: string | null;
  /** 选中了模板但对应甲型图案缺失或加载失败；不得静默冒充纯色成功。 */
  patternError: string | null;
  retryPattern: () => void;
  patternVisible: boolean;
  patternFadeMs: number;
  failedFingers: Set<FingerCode>;
  lengthMm: number;
  widthMm: number;
  /** 图案/附件缩放：lengthMm / 18（图案按 medium 基准设计） */
  patternK: number;
}

export function useNailDesignAssets(
  shape: NailShape,
  length: NailLength,
  templateId: string | null,
  opts: { needPlate?: boolean } = {},
): NailDesignAssets {
  const needPlate = opts.needPlate ?? false;

  const mockFlags = useMockScenarios((s) => s.flags);
  const failFinger = useMockScenarios((s) => s.failFinger);
  const failAll = isScenarioOn(mockFlags, 'render.failAll');
  const timeoutOn = isScenarioOn(mockFlags, 'render.timeout');
  const failFingerOn = isScenarioOn(mockFlags, 'render.failFinger');

  interface BaseAssets {
    backV2: BackPlateV2 | null;
    silhouette: SilhouetteAsset;
    params: ShapeParams;
    decorations: DecorationAsset[];
  }

  const [status, setStatus] = useState<NailAssetsStatus>('loading');
  const [base, setBase] = useState<BaseAssets | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  /* ── 基础资产加载（改甲型/长度 → 重新渲染骨架） ── */
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
          needPlate ? loadBackPlateV2() : Promise.resolve(null),
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
  }, [shape, length, retryKey, failAll, timeoutOn, needPlate]);

  /* ── 应用模板（淡出 150ms → 新渲染淡入 200ms） ── */
  const [patternMarkup, setPatternMarkup] = useState<string | null>(null);
  /** 已渲染图案的 key：`${templateId}/${shape}`（图案按甲型独立适配，改甲型需重载） */
  const [patternKey, setPatternKey] = useState<string | null>(null);
  const [patternVisible, setPatternVisible] = useState(true);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [patternRetryKey, setPatternRetryKey] = useState(0);
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
              setPatternError(null);
            }
            return;
          }
          try {
            const p = await loadPattern(templateId, shape);
            if (cancelled) return;
            setPatternMarkup(p.innerMarkup);
            setPatternKey(nextKey);
            setPatternVisible(true);
            setPatternError(null);
          } catch {
            if (!cancelled) {
              setPatternMarkup(null);
              setPatternKey(nextKey);
              setPatternVisible(true);
              setPatternError(`模板 ${templateId} 缺少 ${shape} 图案资产或加载失败。`);
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
  }, [templateId, shape, status, patternRetryKey]);

  const lengthMm = base?.params.lengths[length].lengthMm ?? PATTERN_BASE_LENGTH_MM;
  const widthMm = base?.params.lengths[length].widthMm ?? 11;
  const patternK = lengthMm / PATTERN_BASE_LENGTH_MM;

  const failedFingers = useMemo(() => {
    const set = new Set<FingerCode>();
    if (failFingerOn) set.add(failFinger);
    return set;
  }, [failFingerOn, failFinger]);

  return {
    status,
    retry: () => setRetryKey((k) => k + 1),
    backV2: base?.backV2 ?? null,
    silhouette: base?.silhouette ?? null,
    params: base?.params ?? null,
    decorations: base?.decorations ?? [],
    patternMarkup,
    patternError,
    retryPattern: () => {
      setPatternKey(null);
      setPatternRetryKey((key) => key + 1);
    },
    patternVisible,
    patternFadeMs,
    failedFingers,
    lengthMm,
    widthMm,
    patternK,
  };
}
