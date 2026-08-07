/**
 * Small V6-only production shell.
 *
 * PR-04 owns the runtime boundary, not final canvas interaction parity. This
 * shell therefore renders an honest structural preview and never imports a
 * component backed by the legacy writable store.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Redo2, Save, ShieldAlert, Undo2 } from 'lucide-react';
import { Button, cx, Modal, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { FINGER_CODES } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { confirmDesign } from '@/lib/state-machine';
import { readData, StorageKeys } from '@/lib/storage';
import { getSilhouette, LENGTHS, lengthName, SHAPES, shapeName } from '../lib/material';
import { getDesign, upsertDesign } from '../lib/repo-v6';
import { useEditorV6Store } from '../store-v6';
import { EditorToolRail, type EditorToolSection } from './EditorToolRail';
import { LayerPanelV6 } from './LayerPanelV6';

const SAVE_LABEL = {
  saved: ['已保存', 'Saved'],
  dirty: ['有未保存更改', 'Unsaved changes'],
  saving: ['正在保存…', 'Saving…'],
  error: ['保存失败，可重试', 'Save failed — retry'],
} as const;

const BASE_COLORS = ['#FBF5F0', '#EFC2C8', '#C94C65', '#7A2748', '#1F2630', '#C9A227'];

export function EditorShellV6() {
  const navigate = useNavigate();
  const { text } = useLocale();
  const toast = useToast();
  const doc = useEditorV6Store((state) => state.doc);
  const status = useEditorV6Store((state) => state.status);
  const readOnly = useEditorV6Store((state) => state.readOnly);
  const currentFinger = useEditorV6Store((state) => state.currentFinger);
  const saveState = useEditorV6Store((state) => state.saveState);
  const historyCount = useEditorV6Store((state) => state.history.length);
  const futureCount = useEditorV6Store((state) => state.future.length);
  const setCurrentFinger = useEditorV6Store((state) => state.setCurrentFinger);
  const setTitle = useEditorV6Store((state) => state.setTitle);
  const setGeometry = useEditorV6Store((state) => state.setGeometry);
  const setTopFinish = useEditorV6Store((state) => state.setTopFinish);
  const setBaseColor = useEditorV6Store((state) => state.setBaseSurfaceColorOnCurrent);
  const setTool = useEditorV6Store((state) => state.setTool);
  const undo = useEditorV6Store((state) => state.undo);
  const redo = useEditorV6Store((state) => state.redo);
  const save = useEditorV6Store((state) => state.save);
  const load = useEditorV6Store((state) => state.load);
  const [titleDraft, setTitleDraft] = useState(doc?.title ?? '');
  const [activeToolSection, setActiveToolSection] = useState<EditorToolSection>('looks');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => setTitleDraft(doc?.title ?? ''), [doc?.designId, doc?.title]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const currentSaveState = useEditorV6Store.getState().saveState;
      if (currentSaveState === 'dirty' || currentSaveState === 'error') event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editingText = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (editingText || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const preview = useMemo(() => {
    if (!doc) return null;
    const nail = doc.nails[currentFinger];
    const shape = nail.geometryOverride?.shape ?? doc.defaultGeometry.shape;
    const length = nail.geometryOverride?.length ?? doc.defaultGeometry.length;
    const baseLayer = nail.layers.find((layer) => layer.typeId === 'builtin.base_surface');
    const baseColor = baseLayer?.surface?.baseColor ?? '#FBF5F0';
    const visibleElementCount = nail.layers
      .filter((layer) => layer.visible)
      .reduce((count, layer) => count + layer.elements.filter((element) => element.visible).length, 0);
    return { nail, shape, length, baseColor, visibleElementCount, silhouette: getSilhouette(shape, length) };
  }, [currentFinger, doc]);

  if (!doc || !preview) return null;

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!readOnly && next && next !== doc.title) setTitle(next);
    else setTitleDraft(doc.title);
  };

  const selectToolSection = (section: EditorToolSection) => {
    setActiveToolSection(section);
    setDrawerOpen(true);
    if (section === 'draw') setTool('brush');
    if (section === 'components') setTool('attachment');
  };

  const confirmCurrentDesign = async () => {
    const saveResult = await save();
    if (saveResult !== 'saved') {
      toast.error(text('保存失败，设计未确认。', 'Save failed; the design was not confirmed.'));
      return;
    }
    const design = getDesign(doc.designId);
    if (!design) {
      toast.error(text('设计摘要缺失，未更改确认状态。', 'Design summary is missing; confirmation was not changed.'));
      return;
    }
    const session = readData<{ userName?: string }>(StorageKeys.session);
    try {
      upsertDesign(confirmDesign(design, session?.userName ?? text('美甲师', 'Nail artist')));
      const reloadResult = load(doc.designId);
      if (reloadResult !== 'ok') throw new Error('confirmed design reload failed');
      setConfirmOpen(false);
      toast.success(text('已确认并冻结为只读。', 'Confirmed and frozen as read-only.'));
    } catch {
      toast.error(text('确认状态写入失败，文档仍保留。', 'Confirmation update failed; the document is preserved.'));
    }
  };

  return (
    <section
      className="flex min-h-[620px] flex-col overflow-hidden rounded-card border border-gray-200 bg-white lg:h-[calc(100vh-8.5rem)]"
      data-debug-id="studio.editor.shell-v6"
      data-editor-schema="6"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(Routes.designs)}>
          <ArrowLeft size={14} /> {text('设计列表', 'Designs')}
        </Button>
        <input
          value={titleDraft}
          disabled={readOnly}
          aria-label={text('设计名称', 'Design title')}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setTitleDraft(doc.title);
              event.currentTarget.blur();
            }
          }}
          className="min-w-[160px] flex-1 rounded-button border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-gray-900 hover:border-gray-200 focus:border-primary focus:outline-none disabled:text-gray-600"
        />
        <span
          className={cx(
            'text-[11px]',
            saveState === 'error' ? 'text-error' : saveState === 'dirty' ? 'text-warning' : 'text-gray-500',
          )}
          role="status"
        >
          {text(SAVE_LABEL[saveState][0], SAVE_LABEL[saveState][1])}
        </span>
        <Button size="sm" variant="ghost" disabled={readOnly || historyCount === 0} onClick={undo} title={text('撤销', 'Undo')}>
          <Undo2 size={14} />
        </Button>
        <Button size="sm" variant="ghost" disabled={readOnly || futureCount === 0} onClick={redo} title={text('重做', 'Redo')}>
          <Redo2 size={14} />
        </Button>
        <Button
          size="sm"
          variant={saveState === 'error' ? 'primary' : 'secondary'}
          disabled={readOnly || saveState === 'saving'}
          loading={saveState === 'saving'}
          onClick={() => void save()}
        >
          <Save size={14} /> {saveState === 'error' ? text('重试保存', 'Retry save') : text('保存', 'Save')}
        </Button>
        {status === 'draft' && !readOnly && (
          <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 size={14} /> {text('顾客已确认', 'Customer approved')}
          </Button>
        )}
      </header>

      {readOnly && (
        <div className="flex items-center gap-2 border-b border-info/20 bg-info-soft px-4 py-2 text-xs text-info">
          <ShieldAlert size={14} />
          {status === 'confirmed'
            ? text('顾客已确认，当前版本冻结为只读。', 'Customer confirmed; this version is read-only.')
            : text('当前版本已冻结为只读。', 'This version is read-only.')}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="grid grid-cols-4 border-b border-gray-200 bg-white p-1 lg:hidden" aria-label={text('移动端 Editor 工具', 'Mobile editor tools')}>
          {([
            ['looks', text('款式', 'Looks')],
            ['draw', text('绘制', 'Draw')],
            ['components', text('组件', 'Parts')],
            ['import', text('导入', 'Import')],
          ] as const).map(([section, label]) => (
            <button
              key={section}
              type="button"
              aria-pressed={activeToolSection === section && drawerOpen}
              onClick={() => activeToolSection === section ? setDrawerOpen((open) => !open) : selectToolSection(section)}
              className={cx(
                'rounded-button px-2 py-2 text-xs',
                activeToolSection === section && drawerOpen ? 'bg-primary-soft text-primary' : 'text-gray-600',
              )}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="hidden lg:block">
          <EditorToolRail
            active={activeToolSection}
            drawerOpen={drawerOpen}
            onSelect={selectToolSection}
            onToggleDrawer={() => setDrawerOpen((open) => !open)}
          />
        </div>

        {drawerOpen && (
          <aside className="w-full shrink-0 border-b border-gray-200 bg-gray-50 p-3 lg:w-56 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold text-gray-700">
              {activeToolSection === 'looks'
                ? text('甲面底色', 'Nail base color')
                : text('结构化工具', 'Structured tools')}
            </p>
            {activeToolSection === 'looks' ? (
              <div className="mt-3 grid grid-cols-6 gap-2 lg:grid-cols-3">
                {BASE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={readOnly}
                    aria-label={`${text('设置底色', 'Set base color')} ${color}`}
                    onClick={() => setBaseColor(color)}
                    className={cx(
                      'h-8 rounded-full border border-gray-300 shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
                      preview.baseColor === color && 'ring-2 ring-primary ring-offset-2',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-gray-500">
                {text(
                  'PR-04 仅开放 V6 数据与保存链路；画笔直操控、导入和高级组件将在 PR-07 验收后开放。',
                  'PR-04 exposes the V6 data and save path. Direct drawing, imports and advanced parts remain gated for PR-07.',
                )}
              </p>
            )}
          </aside>
        )}

        <main className="flex min-h-[360px] min-w-0 flex-1 flex-col items-center justify-center overflow-auto bg-[#f7f4f2] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-600">
            <span className="font-medium">{currentFinger}</span>
            <span>{shapeName(preview.shape)} · {lengthName(preview.length)}</span>
            <span>{text('结构预览', 'Structure preview')}</span>
          </div>
          <div className="flex h-[330px] w-full max-w-[300px] items-center justify-center rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-sm">
            {preview.silhouette ? (
              <svg viewBox={preview.silhouette.viewBox} className="h-full max-h-[285px] w-full" role="img" aria-label={text('当前甲面预览', 'Current nail preview')}>
                <path d={preview.silhouette.pathD} fill={preview.baseColor} stroke="#9f8b83" strokeWidth="1.2" />
              </svg>
            ) : (
              <div className="h-64 w-32 rounded-[55%_55%_35%_35%] border border-gray-300" style={{ backgroundColor: preview.baseColor }} />
            )}
          </div>
          <p className="mt-3 text-center text-[11px] text-gray-500">
            {text(
              `V6 结构预览 · ${preview.nail.layers.length} 个图层 · ${preview.visibleElementCount} 个可见元素`,
              `V6 structure preview · ${preview.nail.layers.length} layers · ${preview.visibleElementCount} visible elements`,
            )}
          </p>
        </main>

        <aside className="w-full shrink-0 overflow-auto border-t border-gray-200 bg-white lg:w-72 lg:border-l lg:border-t-0">
          <div className="border-b border-gray-200 p-3">
            <h2 className="text-xs font-semibold text-gray-700">{text('设计属性', 'Design properties')}</h2>
            <label className="mt-3 block text-[11px] text-gray-500">
              {text('甲型', 'Shape')}
              <select
                value={doc.defaultGeometry.shape}
                disabled={readOnly}
                onChange={(event) => setGeometry(event.target.value as typeof doc.defaultGeometry.shape, doc.defaultGeometry.length)}
                className="mt-1 w-full rounded-button border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100"
              >
                {SHAPES.map((shape) => <option key={shape} value={shape}>{shapeName(shape)}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-[11px] text-gray-500">
              {text('长度', 'Length')}
              <select
                value={doc.defaultGeometry.length}
                disabled={readOnly}
                onChange={(event) => setGeometry(doc.defaultGeometry.shape, event.target.value as typeof doc.defaultGeometry.length)}
                className="mt-1 w-full rounded-button border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100"
              >
                {LENGTHS.map((length) => <option key={length} value={length}>{lengthName(length)}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-[11px] text-gray-500">
              {text('封层', 'Top finish')}
              <select
                value={doc.appearance.topFinish}
                disabled={readOnly}
                onChange={(event) => setTopFinish(event.target.value as 'gloss' | 'matte')}
                className="mt-1 w-full rounded-button border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100"
              >
                <option value="gloss">{text('亮面', 'Gloss')}</option>
                <option value="matte">{text('哑光', 'Matte')}</option>
              </select>
            </label>
          </div>
          <LayerPanelV6 />
        </aside>
      </div>

      <footer className="overflow-x-auto border-t border-gray-200 bg-white px-3 py-2">
        <div className="flex min-w-max items-center justify-center gap-1">
          {FINGER_CODES.map((finger) => (
            <button
              key={finger}
              type="button"
              aria-pressed={currentFinger === finger}
              onClick={() => setCurrentFinger(finger)}
              className={cx(
                'h-8 min-w-10 rounded-button border px-2 text-xs',
                currentFinger === finger
                  ? 'border-primary bg-primary-soft font-semibold text-primary'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {finger}
            </button>
          ))}
        </div>
      </footer>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={text('标记顾客已确认？', 'Mark as customer approved?')}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>{text('取消', 'Cancel')}</Button>
            <Button size="sm" onClick={() => void confirmCurrentDesign()}>{text('保存并冻结', 'Save and freeze')}</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {text(
            'Studio 会先完成 V6 保存；仅保存成功后才写入确认状态并冻结当前版本。后续修改请从设计列表创建新版本。',
            'Studio saves the V6 document first. Only a successful save can confirm and freeze this version; create a new version for later edits.',
          )}
        </p>
      </Modal>
    </section>
  );
}
