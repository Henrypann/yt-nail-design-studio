import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Modal, Tabs } from '@/design-system';
import { useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import {
  createCustomerAndSync,
  hasDuplicateName,
  NOTES_MAX,
  validateEmailOptional,
  validateName,
  validateNotes,
} from '@/platform/customers';
import { useRequireAuth } from '@/platform/session';

type Mode = 'full' | 'quick';

interface FormState {
  name: string;
  email: string;
  allergyNotes: string;
  preferenceNotes: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = { name: '', email: '', allergyNotes: '', preferenceNotes: '' };

/**
 * `/customers/new` 新建客户（PRD §5.3）：
 * 完整建档（姓名/邮箱/过敏/偏好 + 提交时隐私弹窗）与快速建档（仅姓名 + 隐私同意）。
 * 隐私弹窗：必读同意必选（默认未勾选）+ Nail Twin 同意可选。
 * 同名客户 → 警告弹窗「门店内已有同名客户。确认创建吗？」。
 */
export default function CustomerNewPage() {
  const session = useRequireAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('full');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false); // 必选，默认未勾选
  const [twinConsent, setTwinConsent] = useState(false); // 可选
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  // 快速建档：隐私同意直接内联勾选
  const [quickPrivacyConsent, setQuickPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!session) return null;

  const setField = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /** 校验当前表单；quick 模式仅校验姓名 */
  const validate = (forMode: Mode): boolean => {
    const next: FormErrors = {};
    const nameErr = validateName(form.name);
    if (nameErr) next.name = nameErr;
    if (forMode === 'full') {
      const emailErr = validateEmailOptional(form.email);
      if (emailErr) next.email = emailErr;
      const allergyErr = validateNotes(form.allergyNotes);
      if (allergyErr) next.allergyNotes = allergyErr;
      const prefErr = validateNotes(form.preferenceNotes);
      if (prefErr) next.preferenceNotes = prefErr;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const doCreate = (consents: { privacyConsent: boolean; twinConsent: boolean }) => {
    setSubmitting(true);
    const result = createCustomerAndSync({
      name: form.name,
      email: mode === 'full' ? form.email : undefined,
      allergyNotes: mode === 'full' ? form.allergyNotes : undefined,
      preferenceNotes: mode === 'full' ? form.preferenceNotes : undefined,
      privacyConsent: consents.privacyConsent,
      twinConsent: consents.twinConsent,
    });
    setSubmitting(false);
    if (!result.ok) {
      setErrors((e) => ({ ...e, [result.field]: result.error }));
      setPrivacyOpen(false);
      setDuplicateOpen(false);
      toast.error(result.error);
      return;
    }
    toast.success(`客户「${result.customer.name}」已创建。`);
    navigate(Routes.customerDetail(result.customer.id), { replace: true });
  };

  /** 完整建档提交：先查重名 → 弹隐私同意窗 */
  const handleFullSubmit = () => {
    if (!validate('full')) return;
    if (hasDuplicateName(form.name)) {
      setDuplicateOpen(true);
      return;
    }
    setPrivacyConsent(false);
    setTwinConsent(false);
    setPrivacyOpen(true);
  };

  /** 快速建档提交：姓名 + 已勾选的内联隐私同意 */
  const handleQuickSubmit = () => {
    if (!validate('quick')) return;
    if (!quickPrivacyConsent) {
      toast.warning('请先勾选「客户已阅读并同意隐私政策」。');
      return;
    }
    if (hasDuplicateName(form.name)) {
      setDuplicateOpen(true);
      return;
    }
    doCreate({ privacyConsent: true, twinConsent: false });
  };

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4 animate-fade-in" data-debug-id="app.customers.new">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">新建客户</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          完整建档记录偏好与过敏信息；快速建档仅需姓名，其余可后补。
        </p>
      </header>

      <Tabs
        items={[
          { key: 'full', label: '完整建档' },
          { key: 'quick', label: '快速建档' },
        ]}
        activeKey={mode}
        onChange={(key) => {
          setMode(key as Mode);
          setErrors({});
        }}
      />

      <Card padding="lg" className="flex flex-col gap-4">
        <Input
          label="姓名 *"
          placeholder="2–60 个字符"
          value={form.name}
          error={errors.name}
          autoFocus
          onChange={(e) => setField('name', e.target.value)}
        />

        {mode === 'full' && (
          <>
            <Input
              label="邮箱"
              type="email"
              placeholder="选填，同一门店内唯一"
              value={form.email}
              error={errors.email}
              onChange={(e) => setField('email', e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">过敏/安全备注</label>
              <textarea
                className="min-h-[72px] rounded-button border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-fast hover:border-gray-400 focus:border-primary focus:outline-none"
                placeholder="选填，如：对丙酮过敏"
                value={form.allergyNotes}
                maxLength={NOTES_MAX + 50}
                onChange={(e) => setField('allergyNotes', e.target.value)}
              />
              <p className="flex justify-between text-xs">
                <span className="text-error">{errors.allergyNotes}</span>
                <span className="ml-auto text-gray-400 tnum">
                  {form.allergyNotes.length}/{NOTES_MAX}
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">偏好备注</label>
              <textarea
                className="min-h-[72px] rounded-button border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-fast hover:border-gray-400 focus:border-primary focus:outline-none"
                placeholder="选填，如：偏爱短甲、不喜欢亮片"
                value={form.preferenceNotes}
                maxLength={NOTES_MAX + 50}
                onChange={(e) => setField('preferenceNotes', e.target.value)}
              />
              <p className="flex justify-between text-xs">
                <span className="text-error">{errors.preferenceNotes}</span>
                <span className="ml-auto text-gray-400 tnum">
                  {form.preferenceNotes.length}/{NOTES_MAX}
                </span>
              </p>
            </div>
          </>
        )}

        {mode === 'quick' && (
          <label className="flex cursor-pointer items-start gap-2 rounded-panel border border-gray-200 bg-gray-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={quickPrivacyConsent}
              onChange={(e) => setQuickPrivacyConsent(e.target.checked)}
              className="mt-0.5 accent-[#C2497A]"
            />
            <span className="text-xs text-gray-700">
              客户已阅读并同意隐私政策 <span className="text-error">*</span>
            </span>
          </label>
        )}
      </Card>

      {/* 吸底操作条：13 寸笔电短视口下提交按钮始终可见可点 */}
      <div className="sticky bottom-0 z-10 -mx-1 border-t border-gray-200 bg-white/95 px-1 py-3 backdrop-blur-sm">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate(Routes.customers)}>
            取消
          </Button>
          <Button
            onClick={mode === 'full' ? handleFullSubmit : handleQuickSubmit}
            loading={submitting}
          >
            {mode === 'full' ? '提交' : '创建客户'}
          </Button>
        </div>
      </div>

      {/* 同名警告弹窗 */}
      <Modal
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        title="同名客户提醒"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicateOpen(false)}>
              返回修改
            </Button>
            <Button
              onClick={() => {
                setDuplicateOpen(false);
                if (mode === 'full') {
                  setPrivacyConsent(false);
                  setTwinConsent(false);
                  setPrivacyOpen(true);
                } else {
                  doCreate({ privacyConsent: true, twinConsent: false });
                }
              }}
            >
              仍要创建
            </Button>
          </>
        }
      >
        <p>门店内已有同名客户「{form.name.trim()}」。确认创建吗？</p>
      </Modal>

      {/* 隐私政策同意弹窗（完整建档提交时） */}
      <Modal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title="客户隐私同意"
        closeOnOverlay={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrivacyOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!privacyConsent}
              loading={submitting}
              onClick={() => doCreate({ privacyConsent, twinConsent })}
            >
              确认并创建
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-gray-500">
            创建客户档案前，请确认已取得客户本人的以下同意：
          </p>
          <label className="flex cursor-pointer items-start gap-2 rounded-panel border border-gray-200 px-3 py-2.5 transition-colors duration-fast hover:bg-gray-50">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-0.5 accent-[#C2497A]"
            />
            <span className="text-xs text-gray-800">
              客户已阅读并同意隐私政策 <span className="text-error">*（必选）</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-panel border border-gray-200 px-3 py-2.5 transition-colors duration-fast hover:bg-gray-50">
            <input
              type="checkbox"
              checked={twinConsent}
              onChange={(e) => setTwinConsent(e.target.checked)}
              className="mt-0.5 accent-[#C2497A]"
            />
            <span className="text-xs text-gray-800">
              客户同意保存 Nail Twin 扫描数据（可选，未同意则不保存 Twin 数据）
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
