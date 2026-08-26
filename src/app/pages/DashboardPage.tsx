import { Link } from 'react-router-dom';
import { Compass, Monitor, Palette, Users, ArrowRight } from 'lucide-react';
import { Card, cx } from '@/design-system';
import { designNewFresh, Routes } from '@/app/routes';
import { communityHref } from '@/community/lib/entry-link';
import { communityProductHref } from '@/app/product-navigation';
import { readOnboarding } from '@/platform/onboarding';
import { useRequireAuth } from '@/platform/session';
import { readAllDesigns } from '@/platform/designs';
import { CrossProductLink } from '@/app/CrossProductLink';
import { useCustomerStore } from '@/platform/customers';
import { readData, StorageKeys } from '@/lib/storage';
import { useLocale } from '@/lib/i18n';

interface GuideCard {
  key: string;
  icon: typeof Monitor;
  title: string;
  description: string;
  actionLabel: string;
  to: string;
  done: boolean;
}

/**
 * `/studio/customers/dashboard` 门店 Dashboard：硬件注册后开放。
 * 完成判定从实际数据派生：绑定设备 / 添加客户 / 创建设计后对应卡片自动消失。
 */
export default function DashboardPage() {
  const session = useRequireAuth();
  const { t } = useLocale();
  const customers = useCustomerStore((s) => s.customers);

  if (!session) return null; // useRequireAuth 触发跳转

  const onboarding = readOnboarding();
  const activeCustomers = customers.filter((c) => !c.deleted).length;
  const designCount = readAllDesigns().length;
  const deviceData = readData<unknown[]>(StorageKeys.devices);
  const deviceCount = Array.isArray(deviceData) ? deviceData.length : 0;

  const cards: GuideCard[] = [
    {
      key: 'device',
      icon: Monitor,
      title: t('dashboard.bindDeviceTitle'), description: t('dashboard.bindDeviceDescription'), actionLabel: t('dashboard.bindDeviceAction'),
      to: Routes.deviceBind,
      done: onboarding.hasDevice,
    },
    {
      key: 'customer',
      icon: Users,
      title: t('dashboard.addCustomerTitle'), description: t('dashboard.addCustomerDescription'), actionLabel: t('dashboard.addCustomerAction'),
      to: Routes.customerNew,
      done: onboarding.hasCustomer,
    },
    {
      key: 'design',
      icon: Palette,
      title: t('dashboard.createDesignTitle'), description: t('dashboard.createDesignDescription'), actionLabel: t('dashboard.createDesignAction'),
      to: designNewFresh(),
      done: onboarding.hasDesign,
    },
  ];
  const pendingCards = cards.filter((c) => !c.done);

  return (
    <div className="flex flex-col gap-6 animate-fade-in" data-debug-id="app.dashboard">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">
          {t('dashboard.welcome', { storeName: session.storeName })}
        </h1>
        <p className="mt-0.5 text-xs text-gray-500">{t('dashboard.today')}</p>
      </header>

      {/* 概览统计 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: t('dashboard.customers'), value: activeCustomers, to: Routes.customers },
          { label: t('dashboard.designs'), value: designCount, to: Routes.designs },
          { label: t('dashboard.devices'), value: deviceCount, to: Routes.devices },
        ].map((stat) => (
          <Link key={stat.label} to={stat.to}>
            <Card className="transition-shadow duration-base hover:shadow-float">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 tnum">{stat.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3" data-testid="dashboard-community-entry">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-panel bg-primary-soft text-primary">
            <Compass size={18} />
          </span>
          <div>
          <p className="text-sm font-medium text-gray-900">{t('dashboard.communityTitle')}</p>
            <p className="mt-0.5 text-xs text-gray-500">{t('dashboard.communityDescription')}</p>
          </div>
        </div>
        <CrossProductLink
          href={communityProductHref(communityHref({ entry: 'dashboard', returnTo: Routes.dashboard }))}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-fast hover:text-primary-hover"
        >
          {t('dashboard.communityCta')}
          <ArrowRight size={13} />
        </CrossProductLink>
      </Card>

      {/* 引导卡片：全部完成后整组消失 */}
      {pendingCards.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-gray-700">{t('dashboard.setupTitle')}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {pendingCards.map((card) => (
              <Card
                key={card.key}
                className="flex flex-col gap-3 transition-shadow duration-base hover:shadow-float"
              >
                <span
                  className={cx(
                    'flex h-9 w-9 items-center justify-center rounded-panel bg-primary-soft text-primary',
                  )}
                >
                  <card.icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{card.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{card.description}</p>
                </div>
                <Link
                  to={card.to}
                  className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-fast hover:text-primary-hover"
                >
                  {card.actionLabel}
                  <ArrowRight size={13} />
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
