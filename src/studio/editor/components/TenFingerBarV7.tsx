import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { Copy, Link2, MoreHorizontal, Unlink, X } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import { useEditorV7Store } from '../store-v7';
import {
  resolveEditorV7FingerScope,
  type EditorV7FingerScopeKind,
} from '../v7/ten-finger-operations';
import { isExactEditorGeometryV7 } from '../v7/geometry-registry';
import {
  deriveFingerContentStateV7,
  EDITOR_FINGER_ROWS_V7,
  FINGER_CONTENT_STATE_LABEL_V7,
  fingerDisplayNameV7,
} from '../v7/finger-identity';

const SCOPE_LABEL: Record<EditorV7FingerScopeKind, string> = {
  current: '当前指',
  selected: '已选指',
  mirror: '对侧镜像',
  all: '全部十指',
};

type PendingAction = 'copy' | 'sync' | 'detach' | null;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function TenFingerBarV7() {
  const toast = useToast();
  const doc = useEditorV7Store((state) => state.doc);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const fingerScope = useEditorV7Store((state) => state.fingerScope);
  const selectedFingers = useEditorV7Store((state) => state.selectedFingers);
  const setCurrentFinger = useEditorV7Store((state) => state.setCurrentFinger);
  const setFingerScope = useEditorV7Store((state) => state.setFingerScope);
  const toggleSelectedFinger = useEditorV7Store((state) => state.toggleSelectedFinger);
  const copyFingerScope = useEditorV7Store((state) => state.copyFingerScope);
  const syncFingerScope = useEditorV7Store((state) => state.syncFingerScope);
  const detachFingerScope = useEditorV7Store((state) => state.detachFingerScope);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectionStatus, setSelectionStatus] = useState<string | null>(null);
  const actionsTriggerRef = useRef<HTMLButtonElement>(null);
  const actionsDialogRef = useRef<HTMLDivElement>(null);
  const confirmationDialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setSelectionStatus(null);
  }, [fingerScope]);

  const restoreActionFocus = () => {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    queueMicrotask(() => {
      if (target?.isConnected && target.offsetParent !== null) target.focus();
      else actionsTriggerRef.current?.focus();
    });
  };
  const closeActions = () => {
    setActionsOpen(false);
    queueMicrotask(() => actionsTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!actionsOpen && !pendingAction) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pendingAction) {
        setPendingAction(null);
        restoreActionFocus();
      } else {
        closeActions();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [actionsOpen, pendingAction]);

  useEffect(() => {
    if (!actionsOpen) return;
    actionsDialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [actionsOpen]);

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>, ref: RefObject<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const scopeTargets = useMemo(() => {
    const resolved = resolveEditorV7FingerScope({
      kind: fingerScope,
      currentFinger,
      selectedFingers: fingerScope === 'selected' ? selectedFingers : undefined,
    });
    return resolved.ok ? resolved.targets.map((target) => target.finger) : [];
  }, [currentFinger, fingerScope, selectedFingers]);
  const writeTargets = scopeTargets.filter((finger) => finger !== currentFinger);
  const disabled = readOnly || switching;
  const spatialScope = [...new Set([currentFinger, ...writeTargets])];
  const unavailableGeometry = spatialScope.filter((finger) => (
    !doc || !isExactEditorGeometryV7(doc.nails[finger].geometryRef, finger)
  ));
  const canMaterialize = !disabled && writeTargets.length > 0 && unavailableGeometry.length === 0;
  const syncCohort = new Set([currentFinger, ...scopeTargets]);
  const linkedOutsideScope = FINGER_CODES.filter((finger) => (
    doc?.nails[finger].compositionProvenance?.syncState === 'linked' && !syncCohort.has(finger)
  ));
  const linkedInScope = scopeTargets.filter((finger) => doc?.nails[finger].compositionProvenance?.syncState === 'linked');
  const canSync = canMaterialize && fingerScope !== 'mirror' && linkedOutsideScope.length === 0;
  const canDetach = !disabled && linkedInScope.length > 0;
  const currentContentState = doc ? deriveFingerContentStateV7(doc.nails[currentFinger]) : 'blank';

  const switchCurrentFinger = (finger: FingerCode) => {
    if (finger === currentFinger) {
      setSelectionStatus(null);
      setCurrentFinger(finger);
      return;
    }
    const outcome = setCurrentFinger(finger);
    if (!outcome) return;
    setSelectionStatus(outcome.exact
      ? `已切换至 ${finger}，并保持相同工艺步骤位置。`
      : `${finger} 缺少当前同序号工艺步骤，已显示背景层；未创建新步骤。`);
  };

  const chooseFinger = (finger: FingerCode) => {
    if (fingerScope === 'selected') {
      toggleSelectedFinger(finger);
      setSelectionStatus(null);
    } else switchCurrentFinger(finger);
  };

  const moveFingerFocus = (event: ReactKeyboardEvent<HTMLButtonElement>, finger: FingerCode) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = FINGER_CODES.indexOf(finger);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? FINGER_CODES.length - 1
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + FINGER_CODES.length) % FINGER_CODES.length
          : (currentIndex + 1) % FINGER_CODES.length;
    const nextFinger = FINGER_CODES[nextIndex];
    const button = event.currentTarget.closest('[aria-label="选择手指"]')
      ?.querySelector<HTMLButtonElement>(`button[data-finger="${nextFinger}"]`);
    button?.focus();
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (fingerScope !== 'selected') switchCurrentFinger(nextFinger);
  };

  const report = (result: ReturnType<typeof copyFingerScope>, success: string) => {
    if (result.ok) toast.success(success);
    else toast.error(result.message);
  };

  const openConfirmation = (action: Exclude<PendingAction, null>, event: ReactMouseEvent<HTMLButtonElement>) => {
    returnFocusRef.current = event.currentTarget;
    setActionsOpen(false);
    setPendingAction(action);
  };

  const runPendingAction = () => {
    if (pendingAction === 'copy') report(copyFingerScope(), `已复制到 ${writeTargets.length} 根指甲；目标保持独立。`);
    if (pendingAction === 'sync') report(syncFingerScope(), `已同步当前快照到 ${writeTargets.length} 根指甲。`);
    if (pendingAction === 'detach') report(detachFingerScope(), `已解除 ${linkedInScope.join('、')} 的快照同步；设计内容未改变。`);
    setPendingAction(null);
    restoreActionFocus();
  };

  const actionControls = (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="v7-cross-finger-actions">
      <Button className="min-h-11" size="sm" variant="secondary" disabled={!canMaterialize} title={unavailableGeometry.length ? `以下指位缺少已签收 2D 甲型轮廓：${unavailableGeometry.join('、')}` : undefined} onClick={(event) => openConfirmation('copy', event)}>
        <Copy size={14} />复制一次
      </Button>
      <Button
        className="min-h-11"
        size="sm"
        variant="secondary"
        disabled={!canSync}
        title={fingerScope === 'mirror'
          ? '镜像只支持一次性复制，不建立持续同步关系'
          : unavailableGeometry.length > 0
            ? `以下指位缺少已签收 2D 甲型轮廓：${unavailableGeometry.join('、')}`
          : linkedOutsideScope.length > 0
            ? `范围外仍有同步成员：${linkedOutsideScope.join('、')}；请先解除或选择全部十指`
            : undefined}
        onClick={(event) => openConfirmation('sync', event)}
      >
        <Link2 size={14} />同步当前快照
      </Button>
      <Button className="min-h-11" size="sm" variant="ghost" disabled={!canDetach} onClick={(event) => openConfirmation('detach', event)}>
        <Unlink size={14} />解除同步
      </Button>
    </div>
  );

  if (!doc) return null;

  return (
    <footer className="relative border-t border-gray-200 bg-white px-2 py-2 sm:px-3" aria-label="十指编辑与跨指操作" data-testid="v7-ten-finger-bar">
      {unavailableGeometry.length > 0 && <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-nano text-amber-900" role="status" data-testid="v7-cross-finger-geometry-gate">跨指复制与同步已停用：{unavailableGeometry.join('、')} 缺少已签收 2D 甲型轮廓。解除同步仍可使用。</p>}
      <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 overflow-x-auto pb-0.5 max-sm:overflow-x-hidden" aria-label="选择手指" data-testid="v7-finger-locator">
          <div className="flex min-w-max items-start gap-3 max-sm:min-w-0 max-sm:flex-col max-sm:gap-1">
            {EDITOR_FINGER_ROWS_V7.map((row) => (
              <section key={row.id} className="flex items-center gap-1 max-sm:w-full" aria-label={`${row.label}五指`} data-hand={row.id}>
                <span className="mr-0.5 text-nano font-semibold text-gray-400 [writing-mode:vertical-rl] max-sm:w-7 max-sm:[writing-mode:horizontal-tb]">{row.label}</span>
                {row.fingers.map((identity) => {
                  const finger = identity.finger;
                  const current = currentFinger === finger;
                  const selected = selectedFingers.includes(finger);
                  const syncState = doc.nails[finger].compositionProvenance?.syncState;
                  const contentState = deriveFingerContentStateV7(doc.nails[finger]);
                  return (
                    <button
                      key={finger}
                      type="button"
                      aria-label={`${fingerDisplayNameV7(finger)} ${finger}，${FINGER_CONTENT_STATE_LABEL_V7[contentState]}`}
                      aria-current={current ? 'true' : undefined}
                      aria-pressed={fingerScope === 'selected' ? selected : current}
                      data-finger={finger}
                      data-current={current}
                      data-selected={selected}
                      data-sync-state={syncState ?? 'none'}
                      data-content-state={contentState}
                      onClick={() => chooseFinger(finger)}
                      onKeyDown={(event) => moveFingerFocus(event, finger)}
                      className={cx(
                        'relative flex min-h-[58px] min-w-[50px] flex-col items-center justify-end rounded-xl border px-1 pb-1 pt-1 text-nano focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 max-sm:min-h-11 max-sm:min-w-11 max-sm:flex-1 max-sm:flex-row max-sm:justify-center max-sm:gap-1 max-sm:px-0.5',
                        current ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                        fingerScope === 'selected' && selected && 'ring-2 ring-primary/35 ring-offset-1',
                      )}
                    >
                      <span
                        className={cx(
                          'mb-0.5 block rounded-t-full rounded-b-[5px] border max-sm:mb-0',
                          contentState === 'designed' ? 'border-primary/50 bg-primary/25' : contentState === 'inactive' ? 'border-amber-400 bg-amber-50' : 'border-dashed border-gray-300 bg-white',
                          current && 'ring-2 ring-primary/25',
                        )}
                        style={{ width: `${18 * identity.previewWidth}px`, height: `${23 * identity.previewHeight}px` }}
                        aria-hidden="true"
                      />
                      <span className="leading-3 max-sm:hidden">{identity.name}</span>
                      <span className="text-nano font-normal leading-3 text-gray-400">{finger}</span>
                      {syncState && (
                        <span className={cx('absolute right-0.5 top-0.5 rounded px-0.5 text-nano font-semibold leading-3', syncState === 'linked' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')}>
                          {syncState === 'linked' ? '同' : '独'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0 overflow-x-auto" role="group" aria-label="跨指范围">
            <div className="flex min-w-max gap-1 rounded-xl bg-gray-100 p-1">
              {(Object.keys(SCOPE_LABEL) as EditorV7FingerScopeKind[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  aria-pressed={fingerScope === scope}
                  onClick={() => setFingerScope(scope)}
                  className={cx(
                    'min-h-11 rounded-lg px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    fingerScope === scope ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                  )}
                >
                  {SCOPE_LABEL[scope]}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden lg:block">{actionControls}</div>
          <Button ref={actionsTriggerRef} className="min-h-11 min-w-11 lg:hidden" size="sm" variant="secondary" onClick={() => setActionsOpen(true)} aria-label="打开跨指操作">
            <MoreHorizontal size={16} />
          </Button>
        </div>
      </div>

      <p className="mt-1.5 truncate text-nano text-gray-500" role="status">
        正在编辑：<strong className="font-semibold text-gray-800">{fingerDisplayNameV7(currentFinger)}（{currentFinger}）</strong> · {FINGER_CONTENT_STATE_LABEL_V7[currentContentState]} · 范围 {SCOPE_LABEL[fingerScope]} · {writeTargets.length > 0 ? `将覆盖 ${writeTargets.join('、')}` : '当前没有可写目标'}
        {fingerScope === 'mirror' ? ' · 布局镜像，文字与素材本体保持正向' : ''}
      </p>
      <p className="mt-0.5 text-nano text-gray-400" aria-hidden="true">粉色边框 = 当前指 · 粉色实心 = 有设计 · 虚线 = 空白 · 黄色 = 内容已隐藏</p>
      {selectionStatus && <p className="mt-1 break-words text-nano leading-4 text-amber-700" role="status" aria-atomic="true" data-testid="v7-finger-selection-status">{selectionStatus}</p>}
      {doc.compositionMeta && <p className="mt-0.5 text-nano text-gray-400">状态：同 = 已同步当前快照；独 = 已解除同步、可单独编辑</p>}
      {fingerScope !== 'mirror' && linkedOutsideScope.length > 0 && (
        <p className="mt-0.5 text-nano text-amber-700">范围外仍有同步成员 {linkedOutsideScope.join('、')}；为避免暗改，需先解除它们或选择全部十指。</p>
      )}

      {actionsOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-gray-950/20" aria-label="关闭跨指操作" onClick={closeActions} />
          <div ref={actionsDialogRef} role="dialog" aria-modal="true" aria-label="跨指操作" onKeyDown={(event) => trapFocus(event, actionsDialogRef)} className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-gray-200 bg-white p-4 shadow-modal lg:hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-gray-900">跨指操作</p><p className="text-xs text-gray-500">来源 {currentFinger} · {SCOPE_LABEL[fingerScope]}</p></div>
              <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-gray-100" onClick={closeActions} aria-label="关闭"><X size={18} /></button>
            </div>
            {fingerScope === 'mirror' && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">对侧镜像是一次性布局复制，不建立快照同步；文字与素材本体保持正向。</p>}
            {actionControls}
          </div>
        </>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-950/30 p-0 sm:items-center sm:p-4" role="presentation">
          <div ref={confirmationDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="v7-scope-confirm-title" onKeyDown={(event) => trapFocus(event, confirmationDialogRef)} className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-modal sm:rounded-2xl">
            <h2 id="v7-scope-confirm-title" className="text-base font-semibold text-gray-900">
              {pendingAction === 'copy' ? '确认覆盖并复制？' : pendingAction === 'sync' ? '确认同步当前快照？' : '确认解除同步？'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {pendingAction === 'detach'
                ? `将解除 ${linkedInScope.join('、')} 的快照同步关系。设计内容、甲型和图层都不会改变。`
                : `将使用 ${currentFinger} 的当前设计覆盖 ${writeTargets.join('、')}。目标甲型不会改变；每根指甲仍保存独立图层和独立 ID。`}
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {pendingAction === 'copy'
                ? '这是一次性复制，之后修改任一指甲都不会影响其他指甲。'
                : pendingAction === 'sync'
                  ? '同步表示显式快照成员关系，不是实时联动；后续单指编辑会自动解除该指同步。'
                  : '解除后，该范围不会再被视为当前快照成员；需要时可再次显式同步。'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button className="min-h-11" autoFocus variant="ghost" onClick={() => { setPendingAction(null); restoreActionFocus(); }}>取消</Button>
              <Button className="min-h-11" onClick={runPendingAction}>确认执行</Button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
