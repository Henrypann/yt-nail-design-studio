/**
 * 十指平铺预览（模块 4 · PRD §13.6，简版 5×2 网格）
 * Back / Palm 双视图（Palm 反向仅作用显示层 xPalm = 1 - xModel，不写入历史）；
 * 单指失败降级（Mock）：该指灰甲型 + ⚠️，其余 9 指正常；
 * 整体失败（Mock）：错误态 + [刷新]。点击指位切换当前编辑指。
 */

import { useMemo, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { FINGER_CODES } from '@/lib/types';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { getSilhouette } from '../lib/material';
import { nailContentSvg, composeTiledSvg, downloadDataUrl, svgToPngDataUrl } from '../lib/render';
import { resolveFingerData } from '../lib/model';
import { useEditorStore } from '../store';

export function TiledPreview(props: { onClose: () => void }) {
  const { onClose } = props;
  const doc = useEditorStore((s) => s.doc);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const setCurrentFinger = useEditorStore((s) => s.setCurrentFinger);
  const flags = useMockScenarios((s) => s.flags);
  const failFinger = useMockScenarios((s) => s.failFinger);
  const toast = useToast();

  const [view, setView] = useState<'back' | 'palm'>('back');
  const [reloadTick, setReloadTick] = useState(0);
  const [exporting, setExporting] = useState(false);

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
          },
          sil,
        ),
      };
    });
  }, [doc, sil, failAll, degradeFinger, reloadTick]);

  if (!doc || !sil) return null;

  const exportPng = async () => {
    if (!doc) return;
    setExporting(true);
    try {
      const svg = composeTiledSvg(doc, { view, degradedFinger: degradeFinger, markBadges: true });
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
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-50/98 animate-fade-in">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">十指平铺预览</h2>
          <div className="flex rounded-button border border-gray-200 p-0.5">
            {(['back', 'palm'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cx(
                  'rounded-button px-2.5 py-1 text-xs transition-colors duration-fast',
                  view === v ? 'bg-primary-soft text-primary' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                {v === 'back' ? 'Back 手背' : 'Palm 掌心'}
              </button>
            ))}
          </div>
          {view === 'palm' && (
            <span className="text-[10px] text-gray-400">Palm 为显示层镜像，不影响业务数据</span>
          )}
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
              const isUnlocked = doc.fingerLocks[finger] !== undefined;
              return (
                <button
                  key={finger}
                  onClick={() => setCurrentFinger(finger)}
                  className={cx(
                    'flex flex-col items-center gap-1 rounded-card border bg-white p-2 transition-all duration-fast',
                    isCurrent
                      ? 'border-primary shadow-float'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-float',
                  )}
                >
                  {html === null ? (
                    <div className="flex h-44 w-24 flex-col items-center justify-center gap-1 rounded-panel bg-gray-100">
                      <span className="text-lg">⚠️</span>
                      <span className="text-[10px] text-gray-500">渲染失败</span>
                    </div>
                  ) : (
                    <svg
                      viewBox={sil.viewBox}
                      className="h-44 w-auto"
                      style={view === 'palm' ? { transform: 'scaleX(-1)' } : undefined}
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="font-medium tnum">{finger}</span>
                    {isMaster && <span title="主视觉指">💗</span>}
                    {isUnlocked && <span title="已解锁">🔓</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <footer className="flex h-10 shrink-0 items-center justify-center border-t border-gray-200 bg-white text-[11px] text-gray-400">
        点击指位切换当前编辑指（编辑作用于当前指；十指同步模式下改一指 = 十指同步）
      </footer>
    </div>
  );
}
