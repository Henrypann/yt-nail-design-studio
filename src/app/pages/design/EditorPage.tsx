/**
 * `/design/canvas` Studio Editor 页面（模块 4）
 *
 * 进入方式（PRD §13.1）：
 *  ① ?bridge=<designId>  —— Wizard 桥接：先完整展示不可逆警告（§15.3），确认后进入画布；
 *  ② ?blank=1            —— 空白新建：选甲型/长度 → 空白画布；
 *  ③ ?design=<designId>  —— 设计列表 [继续编辑] / 只读查看。
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, cx, EmptyState, Modal } from '@/design-system';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { BRIDGE_WARNING_LINES, BRIDGE_WARNING_TITLE } from '@/studio/bridge';
import {
  compatibilityLabel,
  compatibilityTitle,
  compatibilityToneClass,
  getShapeLengthCompatibility,
} from '@/studio/compatibility';
import { EditorShell, useEditorStore, createBlankEditorDesign } from '@/studio/editor';
import {
  isEditorShapeEnabled,
  LENGTHS,
  lengthName,
  shapeName,
  TIER_ONE_EDITOR_SHAPES,
} from '@/studio/editor/lib/material';
import type { NailLength, NailShape } from '@/lib/types';

type PageState =
  | { kind: 'loading' }
  | { kind: 'bridge-warning'; designId: string }
  | { kind: 'blank-picker' }
  | { kind: 'ready' }
  | { kind: 'missing' }
  | { kind: 'invalid'; unsupported?: boolean };

export default function EditorPage() {
  const { locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const load = useEditorStore((s) => s.load);
  const unload = useEditorStore((s) => s.unload);

  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [blankShape, setBlankShape] = useState<NailShape>('almond');
  const [blankLength, setBlankLength] = useState<NailLength>('medium');

  useEffect(() => {
    const bridgeId = params.get('bridge');
    const designId = params.get('design');
    const blank = params.get('blank');

    if (bridgeId) {
      // 桥接：不可逆警告完整展示后才可进入（数据转化已在 openBridge 内完成）
      setState({ kind: 'bridge-warning', designId: bridgeId });
      return;
    }
    if (blank === '1') {
      setState({ kind: 'blank-picker' });
      return;
    }
    if (designId) {
      const result = load(designId);
      setState(
        result === 'ok'
          ? { kind: 'ready' }
          : result === 'invalid' || result === 'unsupported'
            ? { kind: 'invalid', unsupported: result === 'unsupported' }
            : { kind: 'missing' },
      );
      return;
    }
    setState({ kind: 'missing' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => () => unload(), [unload]);

  const acknowledgeBridge = (designId: string) => {
    const result = load(designId);
    if (result === 'ok') {
      setParams({ design: designId }, { replace: true });
      setState({ kind: 'ready' });
    } else {
      setState({
        kind: result === 'invalid' || result === 'unsupported' ? 'invalid' : 'missing',
        ...(result === 'unsupported' ? { unsupported: true } : {}),
      });
    }
  };

  const createBlank = () => {
    const id = createBlankEditorDesign({ shape: blankShape, length: blankLength });
    load(id);
    setParams({ design: id }, { replace: true });
    setState({ kind: 'ready' });
  };

  if (state.kind === 'ready') return <EditorShell />;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">Studio Editor</h1>
        <p className="mt-0.5 text-xs text-gray-500">甲型轮廓内 2D 自由画布 · 十指编排 · 顾客展示</p>
      </header>

      {(state.kind === 'missing' || state.kind === 'loading') && (
        <EmptyState
          title={state.kind === 'loading' ? '正在加载画布…' : '没有找到对应的设计'}
          description={
            state.kind === 'missing'
              ? '设计可能已被删除，或尚未通过 Wizard / 空白画布创建。'
              : undefined
          }
          action={
            state.kind === 'missing' ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => navigate(Routes.designs)}>
                  返回设计列表
                </Button>
                <Button size="sm" onClick={() => setState({ kind: 'blank-picker' })}>
                  空白画布新建
                </Button>
              </div>
            ) : undefined
          }
          className="min-h-[320px]"
        />
      )}
      {state.kind === 'invalid' && (
        <EmptyState
          title={state.unsupported ? '设计来自更高版本' : '设计数据无法读取'}
          description={
            state.unsupported
              ? '当前版本不会覆盖这份设计。请使用创建它的新版 Studio 打开。'
              : '原始 Editor 数据已保留，没有被空白画布覆盖。请返回列表后恢复或复制备份。'
          }
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate(Routes.designs)}>
              返回设计列表
            </Button>
          }
          className="min-h-[320px]"
        />
      )}

      {/* ① 桥接不可逆警告（PRD §15.3：完整展示后才可进入） */}
      <Modal
        open={state.kind === 'bridge-warning'}
        onClose={() => navigate(Routes.designs)}
        title="打开自由画布"
        closeOnOverlay={false}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(Routes.designs)}>
              取消，返回列表
            </Button>
            <Button
              size="sm"
              onClick={() => state.kind === 'bridge-warning' && acknowledgeBridge(state.designId)}
            >
              我已了解，进入自由画布
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-gray-800">{BRIDGE_WARNING_TITLE}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {BRIDGE_WARNING_LINES.map((line) => (
                <li key={line} className="flex gap-1.5 text-sm text-gray-600">
                  <span className="text-gray-400">·</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>

      {/* ② 空白新建：选甲型/长度 */}
      <Modal
        open={state.kind === 'blank-picker'}
        onClose={() => navigate(Routes.designs)}
        title="空白画布新建"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(Routes.designs)}>
              取消
            </Button>
            <Button size="sm" onClick={createBlank}>
              创建空白画布
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-700">甲型</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TIER_ONE_EDITOR_SHAPES.map((capability) => {
                const enabled = isEditorShapeEnabled(capability);
                const selected = blankShape === capability.id;
                const compatibility = getShapeLengthCompatibility(capability.id, blankLength);
                const hint = compatibilityTitle(compatibility, locale);
                const badge = compatibilityLabel(compatibility, locale);
                return (
                  <button
                    key={capability.id}
                    disabled={!enabled}
                    onClick={() => setBlankShape(capability.id)}
                    title={enabled ? hint || shapeName(capability.id) : `${shapeName(capability.id)} · Pending geometry sign-off`}
                    data-shape-id={capability.id}
                    data-editor-enabled={enabled}
                    data-compatibility={enabled ? compatibility.severity : undefined}
                    className={cx(
                      'rounded-button border px-2 py-1.5 text-xs',
                      selected
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                      enabled && compatibilityToneClass(compatibility, selected),
                      !enabled && 'cursor-not-allowed bg-gray-50 opacity-45',
                    )}
                  >
                    <span>{shapeName(capability.id)}</span>
                    {enabled && !selected && badge && (
                      <span aria-hidden="true" className="ml-1 text-[9px] opacity-75">{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-700">长度</p>
            <div className="grid grid-cols-4 gap-1.5">
              {LENGTHS.map((l) => {
                const selected = blankLength === l;
                const compatibility = getShapeLengthCompatibility(blankShape, l);
                const hint = compatibilityTitle(compatibility, locale);
                const badge = compatibilityLabel(compatibility, locale);
                return (
                  <button
                    key={l}
                    onClick={() => setBlankLength(l)}
                    title={hint || undefined}
                    data-compatibility={compatibility.severity}
                    className={cx(
                      'rounded-button border px-2 py-1.5 text-xs',
                      selected
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                      compatibilityToneClass(compatibility, selected),
                    )}
                  >
                    {lengthName(l)}
                    {!selected && badge && <span aria-hidden="true" className="ml-1 text-[9px] opacity-75">{badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
