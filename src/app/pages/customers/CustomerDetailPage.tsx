import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Palette, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal } from '@/design-system';
import { useToast } from '@/design-system';
import { designNewFresh, Routes } from '@/app/routes';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/state-machine';
import {
  NOTES_MAX,
  PRIVACY_POLICY_VERSION,
  updateCustomerAndSync,
  softDeleteCustomerAndSync,
  useCustomerStore,
} from '@/platform/customers';
import { listCustomerDesigns, SHAPE_LABEL } from '@/platform/designs';
import { useRequireAuth } from '@/platform/session';
import { getFingerTwin, summarizeTwin } from '@/platform/twin';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16);
}

const TWIN_ICON = { valid: '👍', low: '⚠️', none: '—' } as const;

/** 内联编辑字段：失焦保存（PRD §5.4），校验失败回退并 Toast */
function InlineField(props: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  onSave: (value: string) => string | null; // 返回错误文案；null = 成功
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(props.value);
  const [focused, setFocused] = useState(false);

  const commit = () => {
    setFocused(false);
    if (draft === props.value) return;
    const error = props.onSave(draft);
    if (error) {
      toast.error(error);
      setDraft(props.value); // 回退
      return;
    }
    toast.success('已保存。');
  };

  const className =
    'w-full rounded-button border bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-fast focus:outline-none ' +
    (focused ? 'border-primary' : 'border-transparent hover:border-gray-300');

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{props.label}</label>
      {props.multiline ? (
        <textarea
          className={className + ' min-h-[64px]'}
          value={draft}
          placeholder={props.placeholder}
          maxLength={props.maxLength ? props.maxLength + 50 : undefined}
          onFocus={() => setFocused(true)}
          onBlur={commit}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : (
        <input
          className={className}
          value={draft}
          placeholder={props.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={commit}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      )}
      {props.multiline && props.maxLength && (
        <p className="text-right text-nano text-gray-400 tnum">
          {draft.length}/{props.maxLength}
        </p>
      )}
    </div>
  );
}

/**
 * `/customers/:id` 客户详情（PRD §5.4 / §5.5）：
 * 内联编辑失焦保存、Twin 十指三态可视化（MOCK）、历史设计（读设计数据，新标签打开）、
 * [新建设计] 携带 customerId 进 Wizard、软删除二次确认。
 */
export default function CustomerDetailPage() {
  const session = useRequireAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const customers = useCustomerStore((s) => s.customers);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!session) return null;

  const customer = customers.find((c) => c.id === id && !c.deleted);

  if (!customer) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <Button variant="ghost" size="sm" className="self-start" onClick={() => navigate(Routes.customers)}>
          <ArrowLeft size={14} />
          返回客户列表
        </Button>
        <EmptyState
          title="客户不存在或已被删除"
          description="该客户档案可能已被删除。历史设计稿会保留在我的设计中。"
          action={
            <Button size="sm" onClick={() => navigate(Routes.customers)}>
              返回客户列表
            </Button>
          }
          className="min-h-[280px]"
        />
      </div>
    );
  }

  const fingers = getFingerTwin(customer);
  const summary = summarizeTwin(fingers);
  const designs = listCustomerDesigns(customer.id);
  const leftHand = fingers.filter((f) => f.finger.startsWith('L'));
  const rightHand = fingers.filter((f) => f.finger.startsWith('R'));

  const save = (patch: Parameters<typeof updateCustomerAndSync>[1]): string | null => {
    const result = updateCustomerAndSync(customer.id, patch);
    return result.ok ? null : result.error;
  };

  const handleDelete = () => {
    softDeleteCustomerAndSync(customer.id);
    setDeleteOpen(false);
    toast.success(`客户「${customer.name}」已删除。历史设计稿已保留。`);
    navigate(Routes.customers, { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 animate-fade-in" data-debug-id="app.customers.detail">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(Routes.customers)}>
          <ArrowLeft size={14} />
          返回客户列表
        </Button>
        <Button
          size="sm"
          onClick={() => navigate(designNewFresh(customer.id))}
        >
          <Palette size={14} />
          新建设计
        </Button>
      </div>

      {/* 基本资料：内联编辑 */}
      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-900">基本资料</h2>
        <InlineField
          key={`name-${customer.updatedAt}`}
          label="姓名"
          value={customer.name}
          onSave={(v) => save({ name: v })}
        />
        <InlineField
          key={`email-${customer.updatedAt}`}
          label="邮箱"
          value={customer.email ?? ''}
          placeholder="选填，同一门店内唯一"
          onSave={(v) => save({ email: v })}
        />
        <InlineField
          key={`allergy-${customer.updatedAt}`}
          label="过敏/安全备注"
          value={customer.allergyNotes ?? ''}
          placeholder="选填"
          multiline
          maxLength={NOTES_MAX}
          onSave={(v) => save({ allergyNotes: v })}
        />
        <InlineField
          key={`pref-${customer.updatedAt}`}
          label="偏好备注"
          value={customer.preferenceNotes ?? ''}
          placeholder="选填"
          multiline
          maxLength={NOTES_MAX}
          onSave={(v) => save({ preferenceNotes: v })}
        />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <p>加入日期：<span className="text-gray-700 tnum">{formatDate(customer.createdAt)}</span></p>
          <p>最近到店：<span className="text-gray-700 tnum">{formatDate(customer.lastVisitAt)}</span></p>
          <p>
            隐私政策：
            <span className="text-gray-700">
              已同意（{formatDateTime(customer.privacyConsentAt)} · {PRIVACY_POLICY_VERSION}）
            </span>
          </p>
          <p>
            Nail Twin 同意：
            <span className="text-gray-700">{customer.twinConsent ? '已同意' : '未同意'}</span>
          </p>
        </div>
      </Card>

      {/* Twin 十指可视化（MOCK） */}
      <Card padding="lg" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Nail Twin 十指状态</h2>
          <Badge variant="warning">MOCK</Badge>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          {[
            { label: '左手', list: leftHand },
            { label: '右手', list: rightHand },
          ].map((hand) => (
            <div key={hand.label} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs text-gray-500">{hand.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {hand.list.map((f) => (
                  <span
                    key={f.finger}
                    title={
                      f.state === 'valid'
                        ? `已扫描 · 有效 · ${f.scannedAt}`
                        : f.state === 'low'
                          ? `已扫描 · 低置信度 · 建议重新扫描 · ${f.scannedAt}`
                          : '未扫描'
                    }
                    className="inline-flex items-center gap-1 rounded-button border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                  >
                    <span className="tnum">{f.finger}</span>
                    <span>{TWIN_ICON[f.state]}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-gray-400">
          👍 已扫描 · 有效　⚠️ 已扫描 · 低置信度，建议重新扫描　— 未扫描　·　
          有效 {summary.valid} / 低置信度 {summary.low} / 未扫描 {summary.none}
        </p>
      </Card>

      {/* 历史设计 */}
      <Card padding="lg" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900">历史设计</h2>
        {designs.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">还没有设计稿</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {designs.map((d) => (
              <li key={d.id}>
                <Link
                  to={Routes.designs}
                  target="_blank"
                  className="flex items-center gap-3 py-2.5 transition-colors duration-fast hover:bg-gray-50"
                >
                  {d.thumbnailDataUrl ? (
                    <img
                      src={d.thumbnailDataUrl}
                      alt=""
                      className="h-10 w-10 rounded-button border border-gray-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-button bg-primary-soft text-primary">
                      <Palette size={16} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800">
                      {d.title ?? `${SHAPE_LABEL[d.shape]} · ${d.length}`}
                    </p>
                    <p className="text-xs text-gray-400 tnum">{formatDateTime(d.createdAt)}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 危险区：软删除 */}
      <Card padding="lg" className="flex items-center justify-between border-error/20">
        <div>
          <p className="text-sm font-medium text-gray-900">删除客户</p>
          <p className="mt-0.5 text-xs text-gray-500">
            客户档案将从列表移除；历史设计稿保留。此操作不可撤销。
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={13} />
          删除客户
        </Button>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`删除客户「${customer.name}」？`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              确认删除
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>客户档案不再出现在客户列表中</li>
          <li>历史设计稿将保留，不删除</li>
          <li>不可撤销</li>
        </ul>
      </Modal>
    </div>
  );
}
