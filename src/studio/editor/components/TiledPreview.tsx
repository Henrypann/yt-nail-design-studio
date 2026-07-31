/**
 * 十指平铺预览（模块 4 · PRD §13.6，简版 5×2 网格）
 * Back 单视图（Palm 镜像切换器 UI 入口已按 MVP 收敛决策移除，镜像代码路径保留）；
 * 单指失败降级（Mock）：该指灰甲型 + ⚠️，其余 9 指正常；
 * 整体失败（Mock）：错误态 + [刷新]。点击指位切换当前编辑指。
 */

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { FINGER_CODES } from '@/lib/types';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { fingerDisplayRatio, fingerDisplayScale } from '@/studio/finger-display';
import { getSilhouette, lengthName, shapeName } from '../lib/material';
import { nailContentSvg, composeTiledSvg, downloadDataUrl, svgToPngDataUrl } from '../lib/render';
import { resolveFingerData, isFingerUnlocked } from '../lib/model';
import { useEditorStore } from '../store';

export function TiledPreview(props: { onClose: () => void; presentation?: boolean }) {
  const { onClose, presentation = false } = props;
  const doc = useEditorStore((s) => s.doc);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const setCurrentFinger = useEditorStore((s) => s.setCurrentFinger);
  const flags = useMockScenarios((s) => s.flags);
  const failFinger = useMockScenarios((s) => s.failFinger);
  const toast = useToast();

  /* Back 单视图（Palm 镜像切换器 UI 入口已移除；镜像渲染路径保留在源文件中） */
  const view = 'back' as const;
  const [reloadTick, setReloadTick] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const failAll = isScenarioOn(flags, 'render.failAll');
  const degradeFinger = isScenarioOn(flags, 'render.failFinger') ? failFinger : null;

  const sil = doc ? getSilhouette(doc.shape, doc.length) : null;

  const cells = useMemo(() => {
    if (!doc || !sil || failAll) return [];
    void reloadTick;
    return FINGER_CODES.map((finger) => {
      if (degradeFinger === finger) return { finger, html: null };
      return {
        finger,
        html: nailContentSvg(
          {
            shape: doc.shape,
            length: doc.length,
            data: resolveFingerData(doc, finger),
            uid: `pv-${finger}`,
            appearance: doc.appearance,
            recipe: doc.recipe,
            finger,
          },
          sil,
        ),
      };
    });
  }, [doc, sil, failAll, degradeFinger, reloadTick]);

  if (!doc || !sil) return null;

  const unlockedCount = FINGER_CODES.filter((f) => isFingerUnlocked(doc, f)).length;
  const syncMode = unlockedCount === 0;
  const hasBrush = FINGER_CODES.some((f) =>
    resolveFingerData(doc, f).pattern.some((el) => el.kind === 'brush' || el.kind === 'french_edge'),
  );

  const exportPng = async () => {
    if (!doc) return;
    setExporting(true);
    try {
      const svg = composeTiledSvg(doc, { view, degradedFinger: degradeFinger, markBadges: !presentation });
      if (!svg) throw new Error('compose failed');
      const png = await svgToPngDataUrl(svg, 1500, 880);
      downloadDataUrl(png, `十指平铺预览_${doc.shape}_${view}.png`);
      toast.success('十指平铺 PNG 已导出');
    } catch {
      toast.error('导出失败。请重试。');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-gray-50/98 animate-fade-in"
      data-debug-id="studio.editor.preview"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {presentation ? '顾客确认展示' : '十指平铺预览'}
          </h2>
          <span className="text-[10px] text-gray-400">
            {presentation ? '全屏只读 · Esc 退出' : 'Back 手背'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" loading={exporting} onClick={exportPng}>
            <Download size={13} />
            导出 PNG
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={14} />
            返回单甲
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center overflow-auto p-6">
        {failAll ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-10 py-12">
            <p className="text-sm font-medium text-gray-800">预览渲染失败</p>
            <p className="text-xs text-gray-500">渲染服务异常或超时（MOCK 场景注入）。</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setReloadTick((t) => t + 1);
                toast.info('已重新请求渲染');
              }}
            >
              <RefreshCw size={13} />
              刷新
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {cells.map(({ finger, html }) => {
              const isCurrent = currentFinger === finger;
              const isMaster = doc.masterFinger === finger;
              const isUnlocked = isFingerUnlocked(doc, finger);
              const displayScale = fingerDisplayScale(finger);
              const displayRatio = fingerDisplayRatio(finger);
              const hasStroke = resolveFingerData(doc, finger).pattern.some(
                (el) => el.kind === 'brush' || el.kind === 'french_edge',
              );
              return (
                <button
                  key={finger}
                  disabled={presentation}
                  data-finger-code={finger}
                  data-finger-display-scale={displayScale}
                  onClick={() => {
                    if (presentation) return;
                    setCurrentFinger(finger);
                    onClose();
                  }}
                  className={cx(
                    'flex flex-col items-center gap-1 rounded-card border bg-white p-2 transition-all duration-fast',
                    isCurrent && !presentation
                      ? 'border-primary shadow-float ring-2 ring-primary/30'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-float',
                  )}
                >
                  <div className="flex h-44 w-28 shrink-0 items-center justify-center" aria-hidden="true">
                    {html === null ? (
                      <div
                        className="flex flex-col items-center justify-center gap-1 rounded-panel bg-gray-100"
                        style={{ height: `${176 * displayRatio}px`, width: `${96 * displayRatio}px` }}
                      >
                        <span className="text-lg">⚠️</span>
                        <span className="text-[10px] text-gray-500">渲染失败</span>
                      </div>
                    ) : (
                      <svg
                        viewBox={sil.viewBox}
                        className="w-auto"
                        style={{ height: `${176 * displayRatio}px` }}
                        data-finger-nail
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    )}
                  </div>
                  <span className="flex flex-wrap items-center justify-center gap-1 text-[10px] text-gray-500">
                    <span className="font-medium tnum">{finger}</span>
                    {!presentation && isMaster && <span title="主视觉指">💗</span>}
                    {!presentation && (isUnlocked ? (
                      <span title="已解锁独立编辑">🔓</span>
                    ) : syncMode ? (
                      <span title="十指同步">🔗</span>
                    ) : null)}
                    {!presentation && hasStroke && <span title="含手绘">✏️</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <footer className="flex h-10 shrink-0 flex-col items-center justify-center gap-0.5 border-t border-gray-200 bg-white px-4 text-[11px] text-gray-500">
        <span>
          {presentation
            ? `${shapeName(doc.shape)} · ${lengthName(doc.length)} · ${doc.lengthPreset}`
            : `点击指位切换编辑指并返回单甲画布${hasBrush ? ' · 导出 PNG 含手绘/法式' : ''}`}
        </span>
        <span className="text-[10px] text-gray-400">
          {presentation
            ? `设计号 ${doc.designId}`
            : syncMode
            ? '● 十指同步模式'
            : `○ 逐指解锁（${unlockedCount} 指独立）`}
          {!presentation && ` · 当前 ${currentFinger}`}
        </span>
      </footer>
    </div>
  );
}
