import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { Badge, Button, EmptyState, Input, SkeletonRows } from '@/design-system';
import { useToast } from '@/design-system';
import { designNewFresh, Routes } from '@/app/routes';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import {
  searchCustomers,
  sortForList,
  useCustomerStore,
} from '@/platform/customers';
import { favoriteShape, SHAPE_LABEL } from '@/platform/designs';
import { useRequireAuth } from '@/platform/session';
import { twinListLabel } from '@/platform/twin';
import { useLocale } from '@/lib/i18n';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

/** 空状态插画占位（资产管线插画到位后替换，DEV-PLAN §4.7） */
function CustomersIllustration() {
  return <Users size={48} strokeWidth={1.2} />;
}

/**
 * `/customers` 客户列表（PRD §5.2）：
 * 搜索（姓名/邮箱）、最近到店倒序、Twin 状态列（MOCK）、整行点击进详情、
 * 行内 [新建设计] 携带 customerId 进 Wizard、空状态 + 引导。
 */
export default function CustomerListPage() {
  const session = useRequireAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLocale();
  const flags = useMockScenarios((s) => s.flags);
  const customers = useCustomerStore((s) => s.customers);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const networkFailToastShown = useRef(false);

  // 首次加载骨架屏（PRD §6.1：3-5 行占位条）
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, []);

  // Mock 注入：网络请求失败 → Toast Error
  useEffect(() => {
    if (isScenarioOn(flags, 'load.networkFail') && !networkFailToastShown.current) {
      networkFailToastShown.current = true;
      toast.error(t('customer.networkFailed'));
    }
    if (!isScenarioOn(flags, 'load.networkFail')) {
      networkFailToastShown.current = false;
    }
  }, [flags, toast]);

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers]);
  const visible = useMemo(
    () => searchCustomers(sortForList(activeCustomers), query),
    [activeCustomers, query],
  );

  if (!session) return null;

  // Mock 注入：列表加载超时 → 「加载超时」+ [刷新]
  const loadTimeout = isScenarioOn(flags, 'load.timeout');

  return (
    <div className="flex flex-col gap-4 animate-fade-in" data-debug-id="app.customers.list">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{t('customer.listTitle')}</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {t('customer.listSummary', { count: activeCustomers.length })}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate(Routes.customerNew)}>
          <Plus size={14} />
          {t('customer.newCustomer')}
        </Button>
      </header>

      <div className="relative max-w-[320px]">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder={t('customer.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
          aria-label={t('customer.searchLabel')}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : loadTimeout ? (
        <EmptyState
          title={t('customer.loadTimeoutTitle')}
          description={t('customer.loadTimeoutDescription')}
          action={
            <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
              {t('customer.refresh')}
            </Button>
          }
          className="min-h-[240px]"
        />
      ) : activeCustomers.length === 0 ? (
        <EmptyState
          illustration={<CustomersIllustration />}
          title={t('customer.emptyTitle')}
          action={
            <Button size="sm" onClick={() => navigate(Routes.customerNew)}>
              {t('customer.newCustomer')}
            </Button>
          }
          className="min-h-[320px]"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('customer.noMatchTitle')}
          description={t('customer.noMatchDescription')}
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate(Routes.customerNew)}>
              {t('customer.newCustomer')}
            </Button>
          }
          className="min-h-[240px]"
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium">{t('customer.name')}</th>
                <th className="px-4 py-2.5 font-medium">{t('customer.email')}</th>
                <th className="px-4 py-2.5 font-medium">{t('customer.favoriteShape')}</th>
                <th className="px-4 py-2.5 font-medium">{t('customer.lastVisit')}</th>
                <th className="px-4 py-2.5 font-medium">
                  {t('customer.twinStatus')} <Badge variant="warning" className="ml-1 text-nano">{t('customer.mock')}</Badge>
                </th>
                <th className="px-4 py-2.5 font-medium text-right">{t('customer.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => {
                const shape = favoriteShape(customer.id);
                return (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(Routes.customerDetail(customer.id))}
                    className="cursor-pointer border-b border-gray-100 transition-colors duration-fast last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{customer.name}</td>
                    <td className="px-4 py-3 text-gray-600">{customer.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {shape ? SHAPE_LABEL[shape] : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 tnum">
                      {formatDate(customer.lastVisitAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{twinListLabel(customer)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(designNewFresh(customer.id));
                        }}
                      >
                        {t('customer.newDesign')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadTimeout && activeCustomers.length > 0 && (
        <p className="text-xs text-gray-400">
          {t('customer.createHint')} <Link to={Routes.customerNew} className="text-primary hover:underline">{t('customer.newCustomer')}</Link>
        </p>
      )}
    </div>
  );
}
