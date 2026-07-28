/**
 * `/design/new` Studio Wizard（Studio-PRD §十二 · 默认入口）
 *
 * 流程：客户选择器（无客户上下文时）→ STEP 1 门禁 → STEP 2 三栏画布。
 * 顶栏：← 返回（未保存拦截弹窗）│ 客户 │ 甲型·长度 [修改] │ 💾已保存 ↔ ●未保存 [保存]。
 * 进入方式：/design/new（弹客户选择器）| /design/new?customerId=xxx（客户上下文直达 STEP 1）。
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Badge, Button, Modal, useToast, cx } from '@/design-system';
import { Routes } from '@/app/routes';
import { StepOne } from '@/studio/wizard/StepOne';
import { StepTwo } from '@/studio/wizard/StepTwo';
import { CustomerPickerModal } from '@/studio/wizard/CustomerPickerModal';
import { findCustomer } from '@/studio/wizard/customer-repository';
import { setWizardNotifier, useWizardStore } from '@/studio/wizard/wizard-store';
import { getEditorDoc } from '@/studio/editor';
import { loadShapeParams } from '@/studio/preview/material-library';

export default function WizardPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const s = useWizardStore();
  const [exitOpen, setExitOpen] = useState(false);
  const [summaryLabel, setSummaryLabel] = useState('');

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

  /* 顶栏甲型·长度摘要 */
  useEffect(() => {
    if (!s.appliedShape || !s.appliedLength) {
      setSummaryLabel('');
      return;
    }
    loadShapeParams()
      .then((p) =>
        setSummaryLabel(
          `${p.shapes[s.appliedShape!]?.name ?? s.appliedShape!} · ${p.lengths[s.appliedLength!].name}（${p.lengths[s.appliedLength!].lengthMm}mm）`,
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
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4" data-debug-id="studio.wizard.page">
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
              (getEditorDoc(s.designId) ? (
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
              onClick={() => void s.saveNow({ manual: true })}
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
    </div>
  );
}
