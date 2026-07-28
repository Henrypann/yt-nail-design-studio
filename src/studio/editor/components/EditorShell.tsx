/**
 * Editor 三栏壳（模块 4 · PRD §13.2）
 * 顶栏 + 左工具栏 + 中 2D 画布 + 右面板（图层 / 十指编排 / 检查）。
 * 只读态（confirmed/submitted）：画布冻结，顶栏替换操作入口。
 * 快捷键：⌘Z 撤销 / ⌘⇧Z 重做 / B 画笔 / E 橡皮。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ScanSearch } from 'lucide-react';
import { Button } from '@/design-system';
import { Routes } from '@/app/routes';
import { NailCanvas } from './NailCanvas';
import { ToolPanel } from './ToolPanel';
import { LayerPanel } from './LayerPanel';
import { FingerPanel } from './FingerPanel';
import { EditorTopBar } from './EditorTopBar';
import { TiledPreview } from './TiledPreview';
import { RiskScreen } from './RiskScreen';
import { useEditorStore } from '../store';

export function EditorShell() {
  const navigate = useNavigate();
  const doc = useEditorStore((s) => s.doc);
  const readOnly = useEditorStore((s) => s.readOnly);
  const status = useEditorStore((s) => s.status);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setTool = useEditorStore((s) => s.setTool);

  const [tiledOpen, setTiledOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);

  /* 快捷键：⌘Z / ⌘⇧Z / B / E */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (inInput || e.metaKey || e.ctrlKey) return;
      if (e.key.toLowerCase() === 'b') setTool('brush');
      if (e.key.toLowerCase() === 'e') setTool('eraser');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, setTool]);

  /* 页面卸载前拦截（未保存） */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useEditorStore.getState().saveState;
      if (s === 'dirty' || s === 'error') e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  if (!doc) return null;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-card border border-gray-200 bg-white" data-debug-id="studio.editor.shell">
      <EditorTopBar onOpenTiled={() => setTiledOpen(true)} />

      {/* 只读冻结横幅（confirmed / submitted） */}
      {readOnly && (
        <div className="flex shrink-0 items-center justify-between border-b border-info/20 bg-info-soft px-4 py-2">
          <p className="flex items-center gap-2 text-xs text-info">
            <ShieldAlert size={14} />
            设计已{status === 'confirmed' ? '被标记「顾客已确认」' : '提交生产'}，冻结为只读。
            如需修改，请返回设计列表「基于已确认设计创建新版本」。
          </p>
          <Button size="sm" variant="secondary" onClick={() => navigate(Routes.designs)}>
            返回设计列表
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <ToolPanel />
        <div className="min-w-0 flex-1">
          <NailCanvas />
        </div>
        <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-gray-200 bg-gray-50 p-3">
          <LayerPanel />
          <FingerPanel />

          {/* 检查区：P0 风险筛查（Mock）。固定半椭球假 3D 检查入口已移除（源文件 Nail3DCheck.tsx 保留） */}
          <section className="rounded-panel border border-gray-200 bg-white p-3">
            <h3 className="mb-2 text-xs font-semibold text-gray-800">检查</h3>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setRiskOpen(true)}>
                <ScanSearch size={13} />
                P0 风险筛查 · MOCK
              </Button>
            </div>
          </section>
        </aside>
      </div>

      {tiledOpen && <TiledPreview onClose={() => setTiledOpen(false)} />}
      <RiskScreen open={riskOpen} onClose={() => setRiskOpen(false)} />
    </div>
  );
}
