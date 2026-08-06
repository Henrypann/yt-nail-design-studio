/**
 * EditorShellV6 — V6-native editor workspace (PR-07).
 * Uses useEditorV6Store instead of the legacy v3 store.
 * Layout: TopBar + ToolRail + ContextDrawer + Canvas + Inspector + FingerStrip.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/design-system';
import { Routes } from '@/app/routes';
import { useEditorV6Store } from '../store-v6';
import { NailCanvas } from './NailCanvas';
import { EditorTopBar } from './EditorTopBar';
import { TiledPreview } from './TiledPreview';
import { RiskScreen } from './RiskScreen';
import { EditorToolRail, type EditorToolSection } from './EditorToolRail';
import { EditorContextDrawer } from './EditorContextDrawer';
import { EditorInspector, type InspectorTab } from './EditorInspector';
import { FingerStrip } from './FingerStrip';

const ONBOARDING_KEY = 'nail-studio:editor-onboarding-complete:v1';

export function EditorShellV6() {
  const navigate = useNavigate();
  const doc = useEditorV6Store((s) => s.doc);
  const readOnly = useEditorV6Store((s) => s.readOnly);
  const status = useEditorV6Store((s) => s.status);
  const undo = useEditorV6Store((s) => s.undo);
  const redo = useEditorV6Store((s) => s.redo);
  const setTool = useEditorV6Store((s) => s.setTool);

  const [tiledOpen, setTiledOpen] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [activeToolSection, setActiveToolSection] = useState<EditorToolSection>('looks');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('design');
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => window.localStorage.getItem(ONBOARDING_KEY) !== '1',
  );

  const finishOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_KEY, '1');
    setOnboardingOpen(false);
  };

  const reopenGuide = () => {
    setActiveToolSection('looks');
    setDrawerOpen(true);
    setOnboardingOpen(true);
  };

  /* Keyboard shortcuts: ⌘Z / ⌘⇧Z / B / E */
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

  /* Unsaved changes interceptor */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useEditorV6Store.getState().saveState;
      if (s === 'dirty' || s === 'error') e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  if (!doc) return null;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-card border border-gray-200 bg-white" data-debug-id="studio.editor.shell-v6">
      <EditorTopBar
        onOpenTiled={() => setTiledOpen(true)}
        onOpenPresentation={() => setPresentationOpen(true)}
        onOpenHelp={reopenGuide}
        onFirstOutcome={finishOnboarding}
      />

      {/* Read-only freeze banner */}
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
        <EditorToolRail
          active={activeToolSection}
          drawerOpen={drawerOpen}
          onSelect={(section) => {
            if (activeToolSection === section) setDrawerOpen(true);
            else {
              setActiveToolSection(section);
              setDrawerOpen(true);
            }
          }}
          onToggleDrawer={() => setDrawerOpen((open) => !open)}
        />
        {drawerOpen && (
          <EditorContextDrawer
            active={activeToolSection}
            onboardingOpen={onboardingOpen}
            onClose={() => setDrawerOpen(false)}
            onOpenInspector={setInspectorTab}
            onFinishOnboarding={finishOnboarding}
          />
        )}
        <div className="min-w-0 flex-1">
          <NailCanvas />
        </div>
        <EditorInspector
          tab={inspectorTab}
          onTabChange={setInspectorTab}
          onOpenRisk={() => setRiskOpen(true)}
        />
      </div>
      <FingerStrip />

      {tiledOpen && <TiledPreview onClose={() => setTiledOpen(false)} />}
      {presentationOpen && (
        <TiledPreview presentation onClose={() => setPresentationOpen(false)} />
      )}
      <RiskScreen open={riskOpen} onClose={() => setRiskOpen(false)} />
    </div>
  );
}
