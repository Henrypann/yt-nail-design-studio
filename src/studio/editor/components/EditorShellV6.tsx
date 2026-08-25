/**
 * Small V6-only production shell.
 *
 * PR-04 owns the runtime boundary, not final canvas interaction parity. This
 * shell therefore renders an honest structural preview and never imports a
 * component backed by the legacy writable store.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Gem, ImagePlus, Paintbrush, Redo2, Save, ShieldAlert, Undo2 } from 'lucide-react';
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
import { V6NailCanvas } from './V6NailCanvas';
import { V6ElementInspector } from './V6ElementInspector';
import { V6OutputPanel } from './V6OutputPanel';
import { generateEditorId } from '../v6/id';
import type { EditorElementV6 } from '../v6/model';

const SAVE_LABEL = { saved: 'editorV7.shell.save.saved', dirty: 'editorV7.shell.save.dirty', saving: 'editorV7.shell.save.saving', error: 'editorV7.shell.save.error' } as const;

const BASE_COLORS = ['#FBF5F0', '#EFC2C8', '#C94C65', '#7A2748', '#1F2630', '#C9A227'];

export function EditorShellV6() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const toast = useToast();
  const doc = useEditorV6Store((state) => state.doc);
  const status = useEditorV6Store((state) => state.status);
  const readOnly = useEditorV6Store((state) => state.readOnly);
  const currentFinger = useEditorV6Store((state) => state.currentFinger);
  const saveState = useEditorV6Store((state) => state.saveState);
  const viewMode = useEditorV6Store((state) => state.viewMode);
  const historyCount = useEditorV6Store((state) => state.history.length);
  const futureCount = useEditorV6Store((state) => state.future.length);
  const setCurrentFinger = useEditorV6Store((state) => state.setCurrentFinger);
  const setTitle = useEditorV6Store((state) => state.setTitle);
  const setGeometry = useEditorV6Store((state) => state.setGeometry);
  const setTopFinish = useEditorV6Store((state) => state.setTopFinish);
  const setBaseColor = useEditorV6Store((state) => state.setBaseSurfaceColorOnCurrent);
  const setTool = useEditorV6Store((state) => state.setTool);
  const addElement = useEditorV6Store((state) => state.addElementToLayerOnCurrent);
  const nudgeSelectedElement = useEditorV6Store((state) => state.nudgeSelectedElement);
  const removeElement = useEditorV6Store((state) => state.removeElementFromCurrentLayer);
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
      if (editingText) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      const state = useEditorV6Store.getState();
      if (state.readOnly || !state.selectedElementId) return;
      const step = event.shiftKey ? 10 : 2;
      if (event.key === 'ArrowLeft') { event.preventDefault(); nudgeSelectedElement(-step, 0); }
      if (event.key === 'ArrowRight') { event.preventDefault(); nudgeSelectedElement(step, 0); }
      if (event.key === 'ArrowUp') { event.preventDefault(); nudgeSelectedElement(0, -step); }
      if (event.key === 'ArrowDown') { event.preventDefault(); nudgeSelectedElement(0, step); }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        removeElement(state.selectedElementId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nudgeSelectedElement, redo, removeElement, undo]);

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

  const addPresetElement = (
    typeId: string,
    layerName: string,
    element: { domain: EditorElementV6['domain']; kind: string; [key: string]: unknown },
  ) => {
    const next = {
      ...element,
      id: generateEditorId(`el_${element.kind}`),
      visible: true,
      locked: false,
      order: 0,
    } as EditorElementV6;
    addElement(typeId, layerName, next);
  };

  const importImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      addPresetElement('builtin.art_2d', t('app.2dArt'), {
        domain: 'pattern', kind: 'image', name: file.name, dataUrl: reader.result,
        transform: { x: 0, y: -82, scale: 1, rotation: 0 },
      });
    };
    reader.readAsDataURL(file);
  };

  const confirmCurrentDesign = async () => {
    const saveResult = await save();
    if (saveResult !== 'saved') {
      toast.error(t('app.saveFailedDesignWasNotConfirmed'));
      return;
    }
    const design = getDesign(doc.designId);
    if (!design) {
      toast.error(t('app.designSummaryMissingConfirmationWasNotChanged'));
      return;
    }
    const session = readData<{ userName?: string }>(StorageKeys.session);
    try {
      upsertDesign(confirmDesign(design, session?.userName ?? t('app.nailArtist')));
      const reloadResult = load(doc.designId);
      if (reloadResult !== 'ok') throw new Error('confirmed design reload failed');
      setConfirmOpen(false);
      toast.success(t('app.confirmedFrozenAsReadOnly'));
    } catch {
      toast.error(t('app.confirmationUpdateFailedDocumentPreserved'));
    }
  };

  return (
    <section
      className="flex min-h-[calc(100vh-8rem)] flex-col overflow-visible rounded-card border border-gray-200 bg-white lg:h-[calc(100vh-8.5rem)] lg:min-h-[620px] lg:overflow-hidden"
      data-debug-id="studio.editor.shell-v6"
      data-editor-schema="6"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-2 py-2 sm:px-3">
        <Button size="sm" variant="ghost" onClick={() => navigate(Routes.designs)}>
          <ArrowLeft size={14} /> {t('app.designs')}
        </Button>
        <input
          value={titleDraft}
          disabled={readOnly}
          aria-label={t('app.designTitle')}
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
            'text-nano',
            saveState === 'error' ? 'text-error' : saveState === 'dirty' ? 'text-warning' : 'text-gray-500',
          )}
          role="status"
        >
          {t(SAVE_LABEL[saveState])}
        </span>
        <Button size="sm" variant="ghost" disabled={readOnly || historyCount === 0} onClick={undo} title={t('app.undo')}>
          <Undo2 size={14} />
        </Button>
        <Button size="sm" variant="ghost" disabled={readOnly || futureCount === 0} onClick={redo} title={t('app.redo')}>
          <Redo2 size={14} />
        </Button>
        <Button
          size="sm"
          variant={saveState === 'error' ? 'primary' : 'secondary'}
          disabled={readOnly || saveState === 'saving'}
          loading={saveState === 'saving'}
          onClick={() => void save()}
        >
          <Save size={14} /> {saveState === 'error' ? t('app.retrySave') : t('app.save')}
        </Button>
        {status === 'draft' && !readOnly && (
          <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 size={14} /> {t('app.customerApproved')}
          </Button>
        )}
      </header>

      {readOnly && (
        <div className="flex items-center gap-2 border-b border-info/20 bg-info-soft px-4 py-2 text-xs text-info">
          <ShieldAlert size={14} />
          {status === 'confirmed'
            ? t('app.customerConfirmedVersionReadOnly')
            : t('app.versionReadOnly')}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="grid grid-cols-4 border-b border-gray-200 bg-white p-1 lg:hidden" aria-label={t('app.mobileEditorTools')}>
          {([
            ['looks', t('app.looks')],
            ['draw', t('app.draw')],
            ['components', t('app.parts')],
            ['import', t('app.import2')],
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
          <aside className="max-h-52 w-full shrink-0 overflow-auto border-b border-gray-200 bg-gray-50 p-3 lg:max-h-none lg:w-56 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold text-gray-700">
              {activeToolSection === 'looks'
                ? t('app.nailBaseColor')
                : t('app.structuredTools')}
            </p>
            {activeToolSection === 'looks' ? (
              <div className="mt-3 grid grid-cols-6 gap-2 lg:grid-cols-3">
                {BASE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={readOnly}
                    aria-label={`${t('app.setBaseColor')} ${color}`}
                    onClick={() => setBaseColor(color)}
                    className={cx(
                      'h-8 rounded-full border border-gray-300 shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
                      preview.baseColor === color && 'ring-2 ring-primary ring-offset-2',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            ) : activeToolSection === 'draw' ? (
              <div className="mt-3 space-y-2">
                <Button size="sm" variant="ghost" className="w-full" disabled={readOnly} onClick={() => addPresetElement('builtin.draw', t('app.draw2'), { domain: 'pattern', kind: 'brush', name: t('app.movableStroke'), points: [{ x: -24, y: 0 }, { x: 0, y: -10 }, { x: 24, y: 0 }], color: '#F04E7E', size: 7, opacity: 1, transform: { x: 0, y: -82, scale: 1, rotation: 0 } })}><Paintbrush size={14} /> {t('app.addStroke')}</Button>
                <Button size="sm" variant="ghost" className="w-full" disabled={readOnly} onClick={() => addPresetElement('builtin.art_2d', t('app.2dArt'), { domain: 'pattern', kind: 'french_edge', name: t('app.frenchEdge'), strokeColor: '#FFFFFF', strokeWidth: 8, transform: { x: 0, y: -122, scale: 1, rotation: 0 } })}>{t('app.addFrenchEdge')}</Button>
                <p className="text-nano leading-4 text-gray-500">{t('app.dragCanvasUseArrowKeysPreciseMovement')}</p>
              </div>
            ) : activeToolSection === 'components' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => addPresetElement('builtin.attachment', t('app.attachments'), { domain: 'attachment', kind: 'attachment', name: t('app.gem'), decorationId: 'heart', heightMm: 0.15, transform: { x: 0, y: -82, scale: 1, rotation: 0 } })}><Gem size={14} /> {t('app.gem')}</Button>
                <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => addPresetElement('builtin.relief', t('app.relief'), { domain: 'relief', kind: 'custom_relief', name: t('app.relief2'), heightMm: 0.18, transform: { x: 0, y: -82, scale: 1, rotation: 0 } })}>{t('app.relief2')}</Button>
              </div>
            ) : (
              <label className="mt-3 flex cursor-pointer flex-col items-center rounded-button border border-dashed border-gray-300 bg-white px-3 py-5 text-center text-xs text-gray-600 hover:border-primary">
                <ImagePlus size={20} className="mb-2" />
                {t('app.importPngJpg')}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={readOnly} onChange={(event) => importImage(event.target.files?.[0])} />
              </label>
            )}
          </aside>
        )}

        <main className="flex min-h-[440px] min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#f7f4f2] p-3 sm:p-4 lg:min-h-0">
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-600">
            <span className="font-medium">{currentFinger}</span>
            <span>{shapeName(preview.shape)} · {lengthName(preview.length)}</span>
            <span>{viewMode === 'overview' ? t('app.customerTenFingerPreview') : t('app.interactiveV6Canvas')}</span>
          </div>
          <div className={cx('flex w-full items-center justify-center rounded-[28px] border border-white/80 bg-white/70 p-3 shadow-sm', viewMode === 'overview' ? 'h-[390px] max-w-5xl' : 'h-[360px] max-w-[360px]')}>
            <V6NailCanvas />
          </div>
          <p className="mt-3 text-center text-nano text-gray-500">
            {t('app.v6CanonicalDocumentPreviewNailLayersLengthLayersPreviewVisibleelementcountVisibleElements', { preview_nail_layers_length: preview.nail.layers.length, preview_visibleElementCount: preview.visibleElementCount })}
          </p>
        </main>

        <aside className="max-h-[460px] w-full shrink-0 overflow-auto border-t border-gray-200 bg-white lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          <div className="border-b border-gray-200 p-3">
            <h2 className="text-xs font-semibold text-gray-700">{t('app.designProperties')}</h2>
            <label className="mt-3 block text-nano text-gray-500">
              {t('app.shape')}
              <select
                value={doc.defaultGeometry.shape}
                disabled={readOnly}
                onChange={(event) => setGeometry(event.target.value as typeof doc.defaultGeometry.shape, doc.defaultGeometry.length)}
                className="mt-1 w-full rounded-button border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100"
              >
                {SHAPES.map((shape) => <option key={shape} value={shape}>{shapeName(shape)}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-nano text-gray-500">
              {t('app.length')}
              <select
                value={doc.defaultGeometry.length}
                disabled={readOnly}
                onChange={(event) => setGeometry(doc.defaultGeometry.shape, event.target.value as typeof doc.defaultGeometry.length)}
                className="mt-1 w-full rounded-button border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100"
              >
                {LENGTHS.map((length) => <option key={length} value={length}>{lengthName(length)}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-nano text-gray-500">
              {t('app.topFinish')}
              <select
                value={doc.appearance.topFinish}
                disabled={readOnly}
                onChange={(event) => setTopFinish(event.target.value as 'gloss' | 'matte')}
                className="mt-1 w-full rounded-button border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100"
              >
                <option value="gloss">{t('app.gloss')}</option>
                <option value="matte">{t('app.matte')}</option>
              </select>
            </label>
          </div>
          <LayerPanelV6 />
          <V6ElementInspector />
          <V6OutputPanel />
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
        title={t('app.markAsCustomerApproved')}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>{t('app.cancel')}</Button>
            <Button size="sm" onClick={() => void confirmCurrentDesign()}>{t('app.saveFreeze')}</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('app.studioSavesV6DocumentFirstOnlySuccessfulSaveCanConfirmFreezeVersionCreateNewVersionLaterEdits')}
        </p>
      </Modal>
    </section>
  );
}
