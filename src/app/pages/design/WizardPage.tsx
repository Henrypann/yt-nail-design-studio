/**
 * `/studio/design/new` Studio Wizard（Studio-PRD §十二 · 默认入口）
 *
 * 流程：客户选择器（无客户上下文时）→ STEP 1 门禁 → STEP 2 三栏画布。
 * 顶栏：← 返回（未保存拦截弹窗）│ 客户 │ 甲型·长度 [修改] │ 💾已保存 ↔ ●未保存 [保存]。
 * 进入方式：/studio/design/new（弹客户选择器）| /studio/design/new?customerId=xxx（客户上下文直达 STEP 1）。
 * PR-02：`?communityIntent=` 消费 Community StudioImportIntent。
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Badge, Button, Modal, useToast, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { Routes } from '@/app/routes';
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
  readWizardRecoveryDraft,
  wizardRecoveryDraftToLegacyProjection,
  writeWizardRecoveryDraftV2,
} from '@/studio/wizard/wizard-draft';
import {
  cancelCommunityImportIntent,
  consumeCommunityImportIntent,
  detectCommunityIntentConflict,
  type CommunityIntentConflictKind,
} from '@/studio/wizard/consume-community-intent';
import { hasEditorDoc } from '@/studio/editor/lib/repo-v6';
import { loadShapeParams } from '@/studio/preview/material-library';
import { getLookReadModelById } from '@/community/data/look-repository';
import { deriveFrenchUsePreflightV1, type FrenchUsePreflightV1 } from '@/integration/community-studio/french-use-context-v1';

type IntentConflictUi = {
  intentId: string;
  contentId: string;
  returnTo?: string;
  kind: CommunityIntentConflictKind;
  applicationLevel?: StudioImportIntentV1['applicationLevel'];
};

function validationToastMessage(reason: string | undefined, t: ReturnType<typeof useLocale>['t']): string {
  switch (reason) {
    case 'expired':
      return t('wizard.intentExpired');
    case 'missing':
      return t('wizard.intentMissing');
    case 'invalid':
      return t('wizard.intentInvalid');
    case 'asset_mismatch':
      return t('wizard.intentAssetMismatch');
    case 'content_mismatch':
      return t('wizard.intentContentMismatch');
    case 'not_published':
      return t('wizard.intentNotPublished');
    case 'publisher_mismatch':
      return t('wizard.intentPublisherMismatch');
    case 'application_level_mismatch':
      return t('wizard.intentApplicationMismatch');
    case 'inspiration_only':
      return t('wizard.intentInspirationOnly');
    case 'invalid_return':
      return t('wizard.intentInvalidReturn');
    default:
      return t('wizard.intentValidationFailed');
  }
}

export default function WizardPage() {
  const { t } = useLocale();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const s = useWizardStore();
  const [exitOpen, setExitOpen] = useState(false);
  const [summaryLabel, setSummaryLabel] = useState('');
  const [intentConflict, setIntentConflict] = useState<IntentConflictUi | null>(null);
  const [intentPending, setIntentPending] = useState(false);
  const [wizardReady, setWizardReady] = useState(false);
  const [legacyFrenchPreflight, setLegacyFrenchPreflight] = useState<FrenchUsePreflightV1 | null>(null);
  const initializedRef = useRef(false);
  /** 已处理的 intentId，避免同一次落地重复消费；换新 intent 可再次进入。 */
  const intentHandledRef = useRef<string | null>(null);
  const recoveryBlockedRef = useRef(false);

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
    const recovery = explicitId || fresh ? null : readWizardRecoveryDraft();
    if (recovery && !recovery.ok && recovery.code !== 'missing') {
      recoveryBlockedRef.current = true;
      toast.warning(t('wizard.draftRecoveryFailed'));
    } else if (recovery?.ok) {
      recoveryBlockedRef.current = false;
    }
    const draft = chooseWizardRestoreDraft({
      explicitDesignId: explicitId,
      explicitDesign,
      activeDraft: recovery?.ok ? wizardRecoveryDraftToLegacyProjection(recovery.draft) : null,
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
        if (recoveryBlockedRef.current) return;
        writeWizardRecoveryDraftV2(useWizardStore.getState());
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
    recoveryBlockedRef.current = false;
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
              toast.info(t('wizard.approximateImported'));
            }
            stripIntentParam();
            return;
          }
          if (applied.reason === 'validation') {
            toast.warning(validationToastMessage(applied.validationReason, t));
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
            toast.warning(t('wizard.templateUnavailable'));
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
          if (applied.reason === 'asset_mismatch') {
            toast.warning(t('wizard.assetChanged'));
            recoverFromIntent(
              applied.recovery?.contentId
                ? { contentId: applied.recovery.contentId, returnTo: applied.recovery.returnTo }
                : null,
            );
            return;
          }
          if (applied.reason === 'load_failed') {
            toast.error(t('wizard.assetLoadFailed'));
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
              toast.info(t('wizard.designCannotOverwrite'));
              stripIntentParam();
            }
            return;
          }
          toast.info(t('wizard.designCannotOverwrite'));
          stripIntentParam();
          return;
        }

        const raw = peekStudioImportIntentRaw(intentId);
        if (!raw) {
          toast.warning(t('wizard.intentExpiredShort'));
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
        toast.error(t('wizard.readIntentFailed'));
        stripIntentParam();
      } finally {
        setIntentPending(false);
      }
    })();
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
          ? t('wizard.frozenChoice')
          : t('wizard.editorChoice'),
      );
      return;
    }

    void (async () => {
      setIntentPending(true);
      try {
        const applied = await consumeCommunityImportIntent(ui.intentId, choice);
        if (applied.ok) {
          if (applied.intent.applicationLevel === 'APPROXIMATE') {
            toast.info(t('wizard.approximateImported'));
          }
          setIntentConflict(null);
          stripIntentParam();
          return;
        }
        if (applied.reason === 'validation') {
          toast.warning(validationToastMessage(applied.validationReason, t));
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
          toast.warning(t('wizard.templateMissing'));
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
        if (applied.reason === 'asset_mismatch') {
          toast.warning(t('wizard.assetChanged'));
          recoverFromIntent(
            applied.recovery?.contentId
              ? { contentId: applied.recovery.contentId, returnTo: applied.recovery.returnTo ?? ui.returnTo }
              : { contentId: ui.contentId, returnTo: ui.returnTo },
          );
          return;
        }
        if (applied.reason === 'load_failed') {
          toast.error(t('wizard.assetLoadFailed'));
          return;
        }
        if (applied.reason === 'frozen' || applied.reason === 'editor_doc') {
          toast.info(
            applied.reason === 'frozen'
              ? t('wizard.frozenChoice')
              : t('wizard.editorChoice'),
          );
          setIntentConflict((prev) =>
            prev ? { ...prev, kind: applied.reason as CommunityIntentConflictKind } : prev,
          );
          return;
        }
        toast.info(t('wizard.applyFailed'));
      } catch {
        toast.error(t('wizard.applyError'));
      } finally {
        setIntentPending(false);
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

  useEffect(() => {
    const contentId = s.communitySourceRef?.contentId;
    if (!contentId) {
      setLegacyFrenchPreflight(null);
      return undefined;
    }
    let cancelled = false;
    void getLookReadModelById(contentId).then((look) => {
      if (!cancelled) setLegacyFrenchPreflight(deriveFrenchUsePreflightV1(look?.discovery ?? null));
    }).catch(() => {
      if (!cancelled) setLegacyFrenchPreflight({ status: 'DISCOVERY_UNAVAILABLE' });
    });
    return () => { cancelled = true; };
  }, [s.communitySourceRef?.contentId]);

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
          {t('wizard.back')}
        </button>
        <span className="h-4 w-px bg-gray-200" />
        <span className="min-w-0 truncate text-sm font-medium text-gray-900">
          {s.customer ? `👤 ${s.customer.name}` : t('wizard.noCustomer')}
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
                  title={t('wizard.editBlockedTitle')}
                >
                  {t('wizard.edit')}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={s.startEditShapeLength}>
                  {t('wizard.edit')}
                </Button>
              ))}
          </>
        )}
        {s.status === 'confirmed' && <Badge variant="gray">{t('wizard.legacyReadonly')}</Badge>}
        {s.communitySourceRef && (
          <div
            className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-panel border border-amber-200 bg-amber-50 px-2 py-1 text-nano text-amber-800"
            data-testid="wizard-legacy-source"
            title={t('wizard.conflictSource')}
          >
            <strong>{t('wizard.legacyApproximate')}</strong>
            <span>{t('wizard.source')} {s.communitySourceRef.contentId}</span>
            <span>{t('wizard.template')} {s.communitySourceRef.sourceTemplateId}</span>
            <span>{t('wizard.asset')} {s.communitySourceRef.assetVersion}</span>
            <span>{t('wizard.capability')} {s.communitySourceRef.applicationLevel}</span>
          </div>
        )}
        {s.communitySourceRef && legacyFrenchPreflight?.status === 'FRENCH_DECLARED' && (
          <div
            className="max-w-full rounded-panel border border-fuchsia-200 bg-fuchsia-50 px-2 py-1 text-nano leading-4 text-fuchsia-900"
            data-testid="wizard-french-technique-hint"
          >
            {t('wizard.legacyFrench')}
          </div>
        )}
        {s.communitySourceRef && legacyFrenchPreflight?.status === 'DISCOVERY_UNAVAILABLE' && (
          <div
            className="max-w-full rounded-panel border border-amber-200 bg-amber-50 px-2 py-1 text-nano leading-4 text-amber-800"
            data-testid="wizard-french-technique-unavailable"
          >
            {t('wizard.legacyFrenchUnavailable')}
          </div>
        )}

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
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
            {s.saveState === 'saved' && t('wizard.saved')}
            {s.saveState === 'dirty' && t('wizard.unsaved')}
            {s.saveState === 'saving' && t('wizard.saving')}
            {s.saveState === 'error' && t('wizard.saveFailed')}
          </span>
          {s.saveState === 'error' ? (
            <Button size="sm" variant="secondary" onClick={() => void s.retrySave()}>
              {t('wizard.retrySave')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={s.step !== 2 || s.status !== 'draft'}
              loading={s.saveState === 'saving'}
              onClick={async () => {
                await s.saveNow({ manual: true });
              }}
            >
              <Save size={13} />
              {t('wizard.save')}
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
        onContinueWithoutCustomer={s.closePicker}
        onDismiss={() => (s.customer ? s.closePicker() : navigate(Routes.designs))}
      />

      {/* 关闭/后退拦截 */}
      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title={t('wizard.confirmExit')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setExitOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setExitOpen(false);
                navigate(Routes.designs);
              }}
            >
              {t('wizard.discard')}
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
              {t('wizard.saveExit')}
            </Button>
          </>
        }
      >
        {t('wizard.unsavedNotice')}
      </Modal>

      {/* Community 试用意图 · 草稿冲突 */}
      <Modal
        open={intentConflict !== null}
        onClose={() => resolveIntent('cancel')}
        title={t('wizard.applyCommunityTitle')}
        footer={
          <>
            <Button
              variant="ghost"
              className="min-h-11"
              data-testid="community-intent-cancel"
              disabled={intentPending}
              onClick={() => resolveIntent('cancel')}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="secondary"
              className="min-h-11"
              data-testid="community-intent-new"
              disabled={intentPending}
              onClick={() => resolveIntent('new')}
            >
              {t('wizard.createNew')}
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
              {t('wizard.applyCurrent')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600" data-testid="community-intent-conflict">
          {intentConflict?.kind === 'frozen' &&
            t('wizard.conflictFrozen')}
          {intentConflict?.kind === 'editor_doc' &&
            t('wizard.conflictEditor')}
          {intentConflict?.kind === 'wizard_draft' &&
            t('wizard.conflictDraft')}
        </p>
      </Modal>

    </div>
  );
}
