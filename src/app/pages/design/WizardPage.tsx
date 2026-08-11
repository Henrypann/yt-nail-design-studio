/**
 * `/design/new` Studio Wizard（Studio-PRD §十二 · 默认入口）
 *
 * 流程：客户选择器（无客户上下文时）→ STEP 1 门禁 → STEP 2 三栏画布。
 * 顶栏：← 返回（未保存拦截弹窗）│ 客户 │ 甲型·长度 [修改] │ 💾已保存 ↔ ●未保存 [保存]。
 * 进入方式：/design/new（弹客户选择器）| /design/new?customerId=xxx（客户上下文直达 STEP 1）。
 * PR-02：`?communityIntent=` 消费 Community StudioImportIntent。
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Compass, Save } from 'lucide-react';
import { Badge, Button, Modal, useToast, cx } from '@/design-system';
import { Routes } from '@/app/routes';
import { communityHref } from '@/community/lib/entry-link';
import {
  peekStudioImportIntentRaw,
  sanitizeReturnTo,
  type StudioImportIntentV1,
} from '@/community/domain/studio-import-intent';
import { StepOne } from '@/studio/wizard/StepOne';
import { StepTwo } from '@/studio/wizard/StepTwo';
import { CustomerPickerModal } from '@/studio/wizard/CustomerPickerModal';
import { findCustomer } from '@/studio/wizard/customer-repository';
import { findDesign } from '@/studio/wizard/design-repository';
import { setWizardNotifier, useWizardStore } from '@/studio/wizard/wizard-store';
import {
  chooseWizardRestoreDraft,
  clearWizardDraft,
  readWizardDraft,
  writeWizardDraft,
} from '@/studio/wizard/wizard-draft';
import {
  cancelCommunityImportIntent,
  consumeCommunityImportIntent,
  detectCommunityIntentConflict,
  type CommunityIntentConflictKind,
} from '@/studio/wizard/consume-community-intent';
import { hasEditorDoc } from '@/studio/editor/lib/repo-v6';
import { loadShapeParams } from '@/studio/preview/material-library';
import {
  consumeVersionedUseIntentV2,
  versionedIntentPortV2,
} from '@/integration/community-studio/versioned-use-runtime';

type IntentConflictUi = {
  intentId: string;
  contentId: string;
  returnTo?: string;
  kind: CommunityIntentConflictKind;
  applicationLevel?: StudioImportIntentV1['applicationLevel'];
};

type VersionedIntentUi = {
  intentId: string;
  lookId: string;
  designVersionId: string;
  returnTo: string;
};

function validationToastMessage(reason?: string): string {
  switch (reason) {
    case 'expired':
      return '试用意图已过期，请从 Community 重新试用。';
    case 'missing':
      return '试用意图不存在或已被清除。';
    case 'invalid':
      return '试用意图数据无效，已安全清除。';
    case 'asset_mismatch':
      return 'Community 资产已更新，请重新试用。';
    case 'content_mismatch':
      return 'Community 内容已变更，请重新试用。';
    case 'not_published':
      return '该 Community 内容已撤回，无法继续试用。';
    case 'publisher_mismatch':
      return 'Community 内容发布者已变更，请重新试用。';
    case 'application_level_mismatch':
      return 'Community 内容应用等级已变更，请重新确认后试用。';
    case 'inspiration_only':
      return '该内容已改为灵感参考，不可试用到 Studio。';
    case 'invalid_return':
      return '试用返回路径非法，已中止导入。';
    default:
      return '试用意图校验失败，请从 Community 重新试用。';
  }
}

export default function WizardPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const s = useWizardStore();
  const [exitOpen, setExitOpen] = useState(false);
  const [summaryLabel, setSummaryLabel] = useState('');
  const [intentConflict, setIntentConflict] = useState<IntentConflictUi | null>(null);
  const [intentPending, setIntentPending] = useState(false);
  const [versionedIntent, setVersionedIntent] = useState<VersionedIntentUi | null>(null);
  const [versionedIntentPending, setVersionedIntentPending] = useState(false);
  const [wizardReady, setWizardReady] = useState(false);
  const initializedRef = useRef(false);
  /** 已处理的 intentId，避免同一次落地重复消费；换新 intent 可再次进入。 */
  const intentHandledRef = useRef<string | null>(null);
  const versionedIntentHandledRef = useRef<string | null>(null);

  /* Toast 桥注入 */
  useEffect(() => {
    setWizardNotifier({ success: toast.success, error: toast.error });
    return () => setWizardNotifier(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * 恢复顺序：显式 designId > 活动草稿 > 空白会话。
   * Community Intent 与 customerId 必须等待这一步，避免静默覆盖。
   */
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const fresh = searchParams.get('fresh') === '1';
    const explicitId = fresh ? null : searchParams.get('designId');
    if (fresh) {
      clearWizardDraft();
      useWizardStore.getState().resetForNewDesign();
    }
    const explicitDesign = explicitId ? findDesign(explicitId) : null;
    const draft = chooseWizardRestoreDraft({
      explicitDesignId: explicitId,
      explicitDesign,
      activeDraft: explicitId || fresh ? null : readWizardDraft(),
    });
    if (draft) {
      useWizardStore.getState().restoreDraft(
        draft,
        draft.customerId ? findCustomer(draft.customerId) : null,
      );
    }
    if (fresh) {
      const next = new URLSearchParams(searchParams);
      next.delete('fresh');
      setSearchParams(next, { replace: true });
    }
    setWizardReady(true);
    // URL 初始化只执行一次；后续 query 更改由 intent/customer effects 处理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 完整/不完整 Step 1 状态都同步为活动草稿；纯 UI 瞬态由 serializer 排除。 */
  useEffect(() => {
    if (!wizardReady) return;
    const persist = () => {
      try {
        writeWizardDraft(useWizardStore.getState());
      } catch {
        // localStorage 不可用不得阻断当前编辑会话。
      }
    };
    persist();
    return useWizardStore.subscribe(persist);
  }, [wizardReady]);

  /* SPA 内再次点击“新建设计”时组件不会卸载，fresh intent 仍须消费。 */
  useEffect(() => {
    if (!wizardReady || searchParams.get('fresh') !== '1') return;
    clearWizardDraft();
    useWizardStore.getState().resetForNewDesign();
    const customerId = searchParams.get('customerId');
    const customer = customerId ? findCustomer(customerId) : null;
    if (customer) useWizardStore.getState().setCustomer(customer);
    const next = new URLSearchParams(searchParams);
    next.delete('fresh');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, wizardReady]);

  /* 客户上下文直达（客户详情/列表 [新建设计] 携带 customerId） */
  useEffect(() => {
    if (!wizardReady) return;
    const customerId = searchParams.get('customerId');
    if (!customerId || useWizardStore.getState().customer) return;
    const found = findCustomer(customerId);
    if (found) useWizardStore.getState().setCustomer(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, wizardReady]);

  const stripIntentParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('communityIntent');
    setSearchParams(next, { replace: true });
  };

  const stripVersionedIntentParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('versionedIntent');
    setSearchParams(next, { replace: true });
  };

  const recoverFromIntent = (intent?: Pick<StudioImportIntentV1, 'returnTo' | 'contentId'> | null) => {
    const fallback = intent?.contentId
      ? Routes.communityLook(intent.contentId)
      : Routes.community;
    const target = sanitizeReturnTo(intent?.returnTo, fallback);
    setIntentConflict(null);
    stripIntentParam();
    navigate(target, { replace: true });
  };

  /* Community StudioImportIntent 消费（草稿冲突须显式选择） */
  useEffect(() => {
    if (!wizardReady) return;
    if (searchParams.get('versionedIntent')) return;
    const intentId = searchParams.get('communityIntent');
    if (!intentId) {
      intentHandledRef.current = null;
      return;
    }
    if (intentHandledRef.current === intentId) return;
    intentHandledRef.current = intentId;

    void (async () => {
      setIntentPending(true);
      try {
        const kind = detectCommunityIntentConflict();
        if (kind === 'none') {
          const applied = await consumeCommunityImportIntent(intentId, 'current');
          if (applied.ok) {
            if (applied.intent.applicationLevel === 'APPROXIMATE') {
              toast.info('已导入近似应用方案，效果可能与 Community 预览有差异。');
            }
            stripIntentParam();
            return;
          }
          if (applied.reason === 'validation') {
            toast.warning(validationToastMessage(applied.validationReason));
            recoverFromIntent(
              applied.recovery?.contentId
                ? {
                    contentId: applied.recovery.contentId,
                    returnTo: applied.recovery.returnTo,
                  }
                : null,
            );
            return;
          }
          if (applied.reason === 'template_missing') {
            toast.warning('对应的 Studio 素材不可用，请从 Community 重新选择。');
            recoverFromIntent(
              applied.recovery?.contentId
                ? {
                    contentId: applied.recovery.contentId,
                    returnTo: applied.recovery.returnTo,
                  }
                : null,
            );
            return;
          }
          if (applied.reason === 'load_failed') {
            toast.error('加载 Studio 素材失败，请稍后重试或取消。');
            const raw = peekStudioImportIntentRaw(intentId);
            if (raw) {
              setIntentConflict({
                intentId,
                contentId: raw.contentId,
                returnTo: raw.returnTo,
                kind: detectCommunityIntentConflict(),
                applicationLevel: raw.applicationLevel,
              });
            } else {
              stripIntentParam();
            }
            return;
          }
          if (applied.reason === 'frozen' || applied.reason === 'editor_doc') {
            const raw = peekStudioImportIntentRaw(intentId) ?? applied.intent;
            if (raw) {
              setIntentConflict({
                intentId,
                contentId: raw.contentId,
                returnTo: raw.returnTo,
                kind: applied.reason,
                applicationLevel: raw.applicationLevel,
              });
            } else {
              toast.info('当前设计不可直接覆盖，请新建设计后再试用。');
              stripIntentParam();
            }
            return;
          }
          toast.info('当前设计不可直接覆盖，请新建设计后再试用。');
          stripIntentParam();
          return;
        }

        const raw = peekStudioImportIntentRaw(intentId);
        if (!raw) {
          toast.warning('试用意图已过期或不存在。');
          stripIntentParam();
          return;
        }
        // 冲突态仅暂存元数据；真正 apply 前会再次 validate
        setIntentConflict({
          intentId,
          contentId: raw.contentId,
          returnTo: raw.returnTo,
          kind,
          applicationLevel: raw.applicationLevel,
        });
      } catch {
        toast.error('读取 Community 试用意图失败。');
        stripIntentParam();
      } finally {
        setIntentPending(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, wizardReady]);

  /* Canonical Look → exact DesignVersion intent. This path never mutates the
   * Wizard store: current/cancel preserve it; new creates an independent V7. */
  useEffect(() => {
    if (!wizardReady) return;
    const intentId = searchParams.get('versionedIntent');
    if (!intentId) {
      setVersionedIntent(null);
      versionedIntentHandledRef.current = null;
      return;
    }
    if (versionedIntentHandledRef.current === intentId) return;
    versionedIntentHandledRef.current = intentId;
    try {
      const intent = versionedIntentPortV2.peek(intentId);
      if (!intent) {
        toast.warning('版本化定制意图已过期或无效，请从 Community 重新开始。');
        stripVersionedIntentParam();
        return;
      }
      setVersionedIntent({
        intentId: intent.intentId,
        lookId: intent.lookId,
        designVersionId: intent.designVersionId,
        returnTo: intent.returnTo,
      });
      setIntentConflict(null);
      useWizardStore.getState().closePicker();
    } catch {
      toast.error('无法读取版本化定制意图，当前草稿未被修改。');
      stripVersionedIntentParam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, wizardReady]);

  const resolveIntent = (choice: 'current' | 'new' | 'cancel') => {
    if (!intentConflict || intentPending) return;
    const ui = intentConflict;

    if (choice === 'cancel') {
      cancelCommunityImportIntent(ui.intentId);
      setIntentConflict(null);
      stripIntentParam();
      navigate(
        sanitizeReturnTo(ui.returnTo, Routes.communityLook(ui.contentId)),
        { replace: true },
      );
      return;
    }

    if (choice === 'current' && (ui.kind === 'frozen' || ui.kind === 'editor_doc')) {
      toast.info(
        ui.kind === 'frozen'
          ? '设计已冻结，无法在当前草稿试用。请选择新建设计。'
          : '已存在自由画布文档，Community 不会覆盖。请选择新建设计。',
      );
      return;
    }

    void (async () => {
      setIntentPending(true);
      try {
        const applied = await consumeCommunityImportIntent(ui.intentId, choice);
        if (applied.ok) {
          if (applied.intent.applicationLevel === 'APPROXIMATE') {
            toast.info('已导入近似应用方案，效果可能与 Community 预览有差异。');
          }
          setIntentConflict(null);
          stripIntentParam();
          return;
        }
        if (applied.reason === 'validation') {
          toast.warning(validationToastMessage(applied.validationReason));
          recoverFromIntent(
            applied.recovery?.contentId
              ? {
                  contentId: applied.recovery.contentId,
                  returnTo: applied.recovery.returnTo ?? ui.returnTo,
                }
              : { contentId: ui.contentId, returnTo: ui.returnTo },
          );
          return;
        }
        if (applied.reason === 'template_missing') {
          toast.warning('对应的 Studio 素材不可用，请从 Community 重新选择。');
          recoverFromIntent(
            applied.recovery?.contentId
              ? {
                  contentId: applied.recovery.contentId,
                  returnTo: applied.recovery.returnTo ?? ui.returnTo,
                }
              : { contentId: ui.contentId, returnTo: ui.returnTo },
          );
          return;
        }
        if (applied.reason === 'load_failed') {
          toast.error('加载 Studio 素材失败，请稍后重试或取消。');
          return;
        }
        if (applied.reason === 'frozen' || applied.reason === 'editor_doc') {
          toast.info(
            applied.reason === 'frozen'
              ? '设计已冻结，无法在当前草稿试用。请选择新建设计。'
              : '已存在自由画布文档，Community 不会覆盖。请选择新建设计。',
          );
          setIntentConflict((prev) =>
            prev ? { ...prev, kind: applied.reason as CommunityIntentConflictKind } : prev,
          );
          return;
        }
        toast.info('无法应用到当前设计，请选择新建设计。');
      } catch {
        toast.error('应用 Community 方案失败，请稍后重试或取消。');
      } finally {
        setIntentPending(false);
      }
    })();
  };

  const resolveVersionedIntent = (choice: 'current' | 'new' | 'cancel') => {
    if (!versionedIntent || versionedIntentPending) return;
    const current = versionedIntent;
    void (async () => {
      setVersionedIntentPending(true);
      try {
        const result = await consumeVersionedUseIntentV2(current.intentId, choice);
        if (!result.ok) {
          toast[result.retryable ? 'error' : 'warning'](
            result.retryable
              ? 'Studio 暂时无法创建定制副本，版本化意图已保留，可重试或取消。'
              : '来源版本已失效或权限已变化，请返回 Community 重新选择。',
          );
          if (!result.retryable) {
            setVersionedIntent(null);
            stripVersionedIntentParam();
          }
          return;
        }
        setVersionedIntent(null);
        stripVersionedIntentParam();
        if (!result.created) {
          if (result.mode === 'cancel') navigate(result.returnTo, { replace: true });
          else {
            toast.info('已保留当前设计；Community 来源没有覆盖现有草稿。');
            if (!useWizardStore.getState().customer) useWizardStore.getState().openPicker();
          }
          return;
        }
        toast.success('已创建独立的 Editor V7 Remix；来源后续变化不会改写此设计。');
        navigate(`${Routes.designCanvas}?design=${encodeURIComponent(result.doc.designId)}`, { replace: true });
      } catch {
        toast.error('创建版本化定制副本失败，当前设计与意图均已保留。');
      } finally {
        setVersionedIntentPending(false);
      }
    })();
  };

  /* 顶栏甲型·长度摘要 */
  useEffect(() => {
    if (!s.appliedShape || !s.appliedLength) {
      setSummaryLabel('');
      return;
    }
    loadShapeParams()
      .then((p) =>
        setSummaryLabel(
          `${p.shapes[s.appliedShape!]?.name_en ?? s.appliedShape!} · ${p.lengths[s.appliedLength!].name}（${p.lengths[s.appliedLength!].lengthMm}mm）`,
        ),
      )
      .catch(() => undefined);
  }, [s.appliedShape, s.appliedLength]);

  /* 浏览器关闭/刷新拦截 */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useWizardStore.getState().saveState === 'dirty') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const dirty = s.saveState === 'dirty' || s.saveState === 'error';

  const handleBack = () => {
    if (dirty) setExitOpen(true);
    else navigate(Routes.designs);
  };

  return (
    <div
      className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-4 lg:h-[calc(100vh-8.5rem)] lg:min-h-0"
      data-debug-id="studio.wizard.page"
      data-design-id={s.designId}
      data-wizard-status={s.status}
      data-wizard-ready={wizardReady ? 'true' : 'false'}
    >
      {/* 顶栏 */}
      <header className="flex flex-wrap items-center gap-2 rounded-card border border-gray-200 bg-white px-3 py-2.5 sm:gap-3 sm:px-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 rounded-button px-2 py-1 text-xs text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
        >
          <ArrowLeft size={14} />
          返回
        </button>
        <span className="h-4 w-px bg-gray-200" />
        <span className="min-w-0 truncate text-sm font-medium text-gray-900">
          {s.customer ? `👤 ${s.customer.name}` : '未选择客户'}
        </span>
        {summaryLabel && (
          <>
            <span className="h-4 w-px bg-gray-200" />
            <span className="min-w-0 truncate text-xs text-gray-600">{summaryLabel}</span>
            {s.step === 2 &&
              s.status === 'draft' &&
              !s.editingShapeLength &&
              (hasEditorDoc(s.designId) ? (
                /* PRD §15：已桥接自由画布后，Wizard 侧 [修改] 失效 */
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  title="已转入自由画布编辑，甲型/长度不可再在 Wizard 中修改"
                >
                  修改
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={s.startEditShapeLength}>
                  修改
                </Button>
              ))}
          </>
        )}
        {s.status === 'confirmed' && <Badge variant="blue">已确认 · 只读</Badge>}

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
          <Button
            size="sm"
            variant="ghost"
            data-testid="wizard-community-entry"
            title="进入 Community"
            aria-label="进入 Community"
            onClick={() =>
              navigate(
                communityHref({
                  entry: 'wizard',
                  returnTo: Routes.designNew,
                  shape: s.appliedShape ?? undefined,
                  length: s.appliedLength ?? undefined,
                }),
              )
            }
          >
            <Compass size={13} />
            Community
          </Button>
          {/* 保存状态：💾 已保存 ↔ ● 未保存 */}
          <span
            className={cx(
              'flex items-center gap-1 text-xs',
              s.saveState === 'saved' && 'text-gray-400',
              s.saveState === 'dirty' && 'text-warning',
              s.saveState === 'saving' && 'text-gray-400',
              s.saveState === 'error' && 'text-error',
            )}
          >
            {s.saveState === 'saved' && '💾 已保存'}
            {s.saveState === 'dirty' && '● 未保存'}
            {s.saveState === 'saving' && '保存中…'}
            {s.saveState === 'error' && '保存失败'}
          </span>
          {s.saveState === 'error' ? (
            <Button size="sm" variant="secondary" onClick={() => void s.retrySave()}>
              重试保存
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={s.step !== 2 || s.status !== 'draft'}
              loading={s.saveState === 'saving'}
              onClick={async () => {
                const ok = await s.saveNow({ manual: true });
                // 确认仪式显性化：保存成功后引导「转给客人看看？」（每会话一次）
                if (ok && useWizardStore.getState().status === 'draft') {
                  let nudged = false;
                  try {
                    nudged = window.sessionStorage.getItem('ui.wizard-present-nudged') === '1';
                  } catch {
                    nudged = false;
                  }
                  if (!nudged) s.setPresentNudge(true);
                }
              }}
            >
              <Save size={13} />
              保存
            </Button>
          )}
        </div>
      </header>

      {/* 主区 */}
      <div className="min-h-0 flex-1 lg:overflow-hidden">
        {s.step === 1 ? <StepOne /> : <StepTwo />}
      </div>

      {/* 客户选择器 */}
      <CustomerPickerModal
        open={s.pickerOpen}
        onConfirm={s.setCustomer}
        onDismiss={() => (s.customer ? s.closePicker() : navigate(Routes.designs))}
      />

      {/* 关闭/后退拦截 */}
      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="保存当前设计？"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExitOpen(false)}>
              取消
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setExitOpen(false);
                navigate(Routes.designs);
              }}
            >
              放弃更改
            </Button>
            <Button
              onClick={async () => {
                const ok = await s.saveNow();
                if (ok) {
                  setExitOpen(false);
                  navigate(Routes.designs);
                }
              }}
            >
              保存并退出
            </Button>
          </>
        }
      >
        当前设计有未保存的修改。保存后可在「我的设计」中继续编辑。
      </Modal>

      {/* Community 试用意图 · 草稿冲突 */}
      <Modal
        open={intentConflict !== null}
        onClose={() => resolveIntent('cancel')}
        title="如何应用 Community 方案？"
        footer={
          <>
            <Button
              variant="ghost"
              className="min-h-11"
              data-testid="community-intent-cancel"
              disabled={intentPending}
              onClick={() => resolveIntent('cancel')}
            >
              取消
            </Button>
            <Button
              variant="secondary"
              className="min-h-11"
              data-testid="community-intent-new"
              disabled={intentPending}
              onClick={() => resolveIntent('new')}
            >
              新建设计
            </Button>
            <Button
              className="min-h-11"
              data-testid="community-intent-current"
              disabled={
                intentPending ||
                intentConflict?.kind === 'frozen' ||
                intentConflict?.kind === 'editor_doc'
              }
              onClick={() => resolveIntent('current')}
            >
              在当前草稿试用
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600" data-testid="community-intent-conflict">
          {intentConflict?.kind === 'frozen' &&
            '当前设计已冻结（只读）。Community 不会覆盖冻结设计，请选择新建设计或取消。'}
          {intentConflict?.kind === 'editor_doc' &&
            '当前设计已有自由画布（Editor）文档。Community 不会静默覆盖，请选择新建设计或取消。'}
          {intentConflict?.kind === 'wizard_draft' &&
            '检测到未完成的 Wizard 草稿。请选择在当前草稿试用、新建设计，或取消本次导入。'}
        </p>
      </Modal>

      {/* COMM-V7.1-04：canonical Look / DesignVersion 冲突裁决。 */}
      <Modal
        open={versionedIntent !== null}
        onClose={() => resolveVersionedIntent('cancel')}
        title="使用这个版本创建 Studio 定制？"
        footer={
          <>
            <Button
              variant="ghost"
              className="min-h-11"
              data-testid="versioned-intent-cancel"
              disabled={versionedIntentPending}
              onClick={() => resolveVersionedIntent('cancel')}
            >
              取消并返回 Community
            </Button>
            <Button
              variant="secondary"
              className="min-h-11"
              data-testid="versioned-intent-current"
              disabled={versionedIntentPending}
              onClick={() => resolveVersionedIntent('current')}
            >
              保留当前设计
            </Button>
            <Button
              className="min-h-11"
              data-testid="versioned-intent-new"
              loading={versionedIntentPending}
              onClick={() => resolveVersionedIntent('new')}
            >
              新建 V7 Remix
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-gray-600" data-testid="versioned-intent-conflict">
          <p>当前 Wizard 草稿和已有 Editor 文档都不会被覆盖。</p>
          <p>
            新建会固定来源版本 <strong>{versionedIntent?.designVersionId}</strong>，复制为独立的
            EditorDocV7。导入后可自由编辑，不与 Community 双向联动。
          </p>
          <p className="text-xs text-gray-500">预览通过不等于可制造，也不会生成设备或生产任务。</p>
        </div>
      </Modal>
    </div>
  );
}
