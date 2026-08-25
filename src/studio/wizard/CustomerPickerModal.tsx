/**
 * 客户选择器弹窗（Studio-PRD §12.2）
 *
 * 从 Studio Dashboard / 客户页进入 /studio/design/new 且无客户上下文时显示。
 * 状态：骨架屏 5 行 / 搜索无结果 / 空列表 / [快速建档] 内嵌（仅姓名 + 隐私勾选）/ 确认选择。
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Button, EmptyState, Input, Modal, SkeletonRows, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { Customer } from '@/lib/types';
import { listCustomers, quickCreateCustomer } from './customer-repository';
import { countDesignsByCustomer } from './design-repository';

/** Twin 摘要（三态，Mock 数据标 MOCK） */
export function twinSummary(c: Customer, t?: ReturnType<typeof useLocale>['t']): { text: string; tone: 'success' | 'warning' | 'gray' } {
  const localizedText = (zh: string, en: string) => t ? (t('app.language.en') === 'EN' ? en : zh) : zh;
  switch (c.twinStatus) {
    case 'MOCK_VALID':
      return { text: localizedText('全部👍 MOCK', 'All 👍 MOCK'), tone: 'success' };
    case 'MOCK_LOW_CONFIDENCE':
      return { text: localizedText('部分未扫 MOCK', 'Partially unscanned MOCK'), tone: 'warning' };
    case 'NO_DATA':
      return { text: localizedText('全部— MOCK', 'All — MOCK'), tone: 'gray' };
  }
}

interface CustomerPickerModalProps {
  open: boolean;
  onConfirm: (customer: Customer) => void;
  /** 无硬件/客户资料时使用标准尺寸继续设计，不创建客户记录。 */
  onContinueWithoutCustomer?: () => void;
  /** 未选择客户时关闭弹窗（返回上一页） */
  onDismiss?: () => void;
}

export function CustomerPickerModal({ open, onConfirm, onContinueWithoutCustomer, onDismiss }: CustomerPickerModalProps) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [consent, setConsent] = useState(false);
  const [nameError, setNameError] = useState('');

  /* 列表加载（Mock 延迟 → 骨架屏 5 行） */
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedId(null);
    setCreating(false);
    const timer = window.setTimeout(() => {
      setCustomers(listCustomers());
      setLoading(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q),
    );
  }, [customers, query]);

  const handleQuickCreate = () => {
    const name = newName.trim();
    if (name.length < 2) {
      setNameError(t('wizard.nameTooShort'));
      return;
    }
    if (!consent) {
      setNameError(t('wizard.privacyRequired'));
      return;
    }
    const customer = quickCreateCustomer({ name, privacyConsentAt: new Date().toISOString() });
    setCustomers(listCustomers());
    setSelectedId(customer.id);
    setCreating(false);
    setNewName('');
    setConsent(false);
    setNameError('');
  };

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  return (
    <Modal
      open={open}
      onClose={() => {
        /* 已选中 → 确认进入；未选中 → 退出 Wizard */
        if (selected) onConfirm(selected);
        else onDismiss?.();
      }}
      title={t('wizard.selectCustomer')}
      closeOnOverlay={false}
      footer={
        <>
          {onContinueWithoutCustomer && (
            <Button variant="ghost" onClick={onContinueWithoutCustomer}>
              {t('wizard.continueStandardSize')}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setCreating((v) => !v);
              setNameError('');
            }}
          >
            <UserPlus size={14} />
            {t('wizard.quickCreateCustomer')}
          </Button>
          <Button disabled={!selected} onClick={() => selected && onConfirm(selected)}>
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('wizard.searchCustomer')}
            className="h-9 w-full rounded-button border border-gray-300 bg-white pl-8 pr-3 text-sm transition-colors duration-fast hover:border-gray-400 focus:border-primary focus:outline-none"
          />
        </div>

        {loading ? (
          <SkeletonRows rows={5} />
        ) : creating ? (
          /* 快速建档内嵌：仅姓名 + 隐私勾选（PRD §5.3 复用） */
          <div className="flex flex-col gap-3 rounded-panel border border-gray-200 bg-gray-50 p-4">
            <Input
              label={t('wizard.customerName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('wizard.customerNamePlaceholder')}
              error={nameError || undefined}
              autoFocus
            />
            <label className="flex cursor-pointer items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              {t('wizard.privacyConsent')}
            </label>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                {t('common.back')}
              </Button>
              <Button size="sm" onClick={handleQuickCreate}>
                {t('wizard.createAndSelect')}
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          customers.length === 0 ? (
            <EmptyState
              title={t('wizard.noCustomers')}
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  <UserPlus size={14} />
                  {t('customer.newCustomer')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={t('wizard.noMatchingCustomers')}
              action={
                <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
                  <UserPlus size={14} />
                  {t('customer.newCustomer')}
                </Button>
              }
            />
          )
        ) : (
          <ul className="max-h-[320px] divide-y divide-gray-100 overflow-y-auto rounded-panel border border-gray-200">
            {filtered.map((c) => {
              const twin = twinSummary(c, t);
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={cx(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-fast',
                      active ? 'bg-primary-soft' : 'hover:bg-gray-50',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-4 w-4 items-center justify-center rounded-full border',
                        active ? 'border-primary bg-primary text-white' : 'border-gray-300',
                      )}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{c.name}</span>
                      {c.email && <span className="block truncate text-xs text-gray-500">{c.email}</span>}
                    </span>
                    <span
                      className={cx(
                        'shrink-0 text-xs',
                        twin.tone === 'success' && 'text-success',
                        twin.tone === 'warning' && 'text-warning',
                        twin.tone === 'gray' && 'text-gray-400',
                      )}
                    >
                      {twin.text}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 tnum">
                      {t('wizard.designCount', { count: countDesignsByCustomer(c.id) })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
