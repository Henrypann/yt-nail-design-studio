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
import { getContentById } from '@/community/data/content-repository';
import {
  getStudioImportIntent,
  sanitizeReturnTo,
  validateStudioImportIntent,
  type StudioImportIntentV1,
} from '@/community/domain/studio-import-intent';
import { StepOne } from '@/studio/wizard/StepOne';
import { StepTwo } from '@/studio/wizard/StepTwo';
import { CustomerPickerModal } from '@/studio/wizard/CustomerPickerModal';
import { findCustomer } from '@/studio/wizard/customer-repository';
import { setWizardNotifier, useWizardStore } from '@/studio/wizard/wizard-store';
import {
  applyCommunityImportIntent,
  cancelCommunityImportIntent,
  detectCommunityIntentConflict,
  type CommunityIntentConflictKind,
} from '@/studio/wizard/consume-community-intent';
import { hasEditorDoc } from '@/studio/editor';
import { loadShapeParams } from '@/studio/preview/material-library';

export default function WizardPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const s = useWizardStore();
  const [exitOpen, setExitOpen] = useState(false);
  const [summaryLabel, setSummaryLabel] = useState('');
  const [intentConflict, setIntentConflict] = useState<{
    intent: StudioImportIntentV1;
    kind: CommunityIntentConflictKind;
  } | null>(null);
  /** 已处理的 intentId，避免同一次落地重复消费；换新 intent 可再次进入。 */
  const intentHandledRef = useRef<string | null>(null);

  /* Toast 桥注入 */
  useEffect(() => {
    setWizardNotifier({ success: toast.success, error: toast.error });
    return () => setWizardNotifier(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 客户上下文直达（客户详情/列表 [新建设计] 携带 customerId） */
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (!customerId || s.customer) return;
    const found = findCustomer(customerId);
    if (found) s.setCustomer(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* Community StudioImportIntent 消费（草稿冲突须显式选择） */
  useEffect(() => {
    const intentId = searchParams.get('communityIntent');
    if (!intentId) {
      intentHandledRef.current = null;
      return;
    }
    if (intentHandledRef.current === intentId) return;
    intentHandledRef.current = intentId;

    const stripIntentParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('communityIntent');
      setSearchParams(next, { replace: true });
    };

    const recover = (intent?: StudioImportIntentV1 | null) => {
      const target = sanitizeReturnTo(intent?.returnTo, Routes.community);
      stripIntentParam();
      navigate(target, { replace: true });
    };

    void (async () => {
      try {
        const raw = getStudioImportIntent(intentId);
        if (!raw) {
          toast.warning('试用意图已过期或不存在。');
          stripIntentParam();
          return;
        }
        const content = await getContentById(raw.contentId);
        const validated = validateStudioImportIntent(intentId, content);
        if (!validated.ok) {
          toast.warning('试用意图校验失败，请从 Community 重新试用。');
          recover(raw);
          return;
        }
        const kind = detectCommunityIntentConflict();
        if (kind === 'none') {
          const applied = await applyCommunityImportIntent(validated.intent, 'current');
          if (!applied.ok) {
            toast.info('当前设计不可直接覆盖，请新建设计后再试用。');
          } else if (validated.intent.applicationLevel === 'APPROXIMATE') {
            toast.info('已导入近似应用方案，效果可能与 Community 预览有差异。');
          }
          stripIntentParam();
          return;
        }
        setIntentConflict({ intent: validated.intent, kind });
      } catch {
        toast.error('读取 Community 试用意图失败。');
        stripIntentParam();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const resolveIntent = (choice: 'current' | 'new' | 'cancel') => {
    if (!intentConflict) return;
    const { intent, kind } = intentConflict;
    const strip = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('communityIntent');
      setSearchParams(next, { replace: true });
      setIntentConflict(null);
    };
    if (choice === 'cancel') {
      cancelCommunityImportIntent(intent.intentId);
      strip();
      navigate(sanitizeReturnTo(intent.returnTo, Routes.communityContent(intent.contentId)));
      return;
    }
    if (choice === 'current' && (kind === 'frozen' || kind === 'editor_doc')) {
      toast.info(
        kind === 'frozen'
          ? '设计已冻结，无法在当前草稿试用。请选择新建设计。'
          : '已存在自由画布文档，Community 不会覆盖。请选择新建设计。',
      );
      return;
    }
    void (async () => {
      const applied = await applyCommunityImportIntent(intent, choice === 'new' ? 'new' : 'current');
      if (!applied.ok) {
        toast.info('无法应用到当前设计，请选择新建设计。');
        return;
      }
      if (intent.applicationLevel === 'APPROXIMATE') {
        toast.info('已导入近似应用方案，效果可能与 Community 预览有差异。');
      }
      strip();
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
      className="flex h-[calc(100vh-8.5rem)] flex-col gap-4"
      data-debug-id="studio.wizard.page"
      data-design-id={s.designId}
      data-wizard-status={s.status}
    >
      {/* 顶栏 */}
      <header className="flex items-center gap-3 rounded-card border border-gray-200 bg-white px-4 py-2.5">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 rounded-button px-2 py-1 text-xs text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
        >
          <ArrowLeft size={14} />
          返回
        </button>
        <span className="h-4 w-px bg-gray-200" />
        <span className="truncate text-sm font-medium text-gray-900">
          {s.customer ? `👤 ${s.customer.name}` : '未选择客户'}
        </span>
        {summaryLabel && (
          <>
            <span className="h-4 w-px bg-gray-200" />
            <span className="text-xs text-gray-600">{summaryLabel}</span>
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

        <div className="ml-auto flex items-center gap-2">
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
      <div className="min-h-0 flex-1">
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
              data-testid="community-intent-cancel"
              onClick={() => resolveIntent('cancel')}
            >
              取消
            </Button>
            <Button
              variant="secondary"
              data-testid="community-intent-new"
              onClick={() => resolveIntent('new')}
            >
              新建设计
            </Button>
            <Button
              data-testid="community-intent-current"
              disabled={intentConflict?.kind === 'frozen' || intentConflict?.kind === 'editor_doc'}
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
    </div>
  );
}
