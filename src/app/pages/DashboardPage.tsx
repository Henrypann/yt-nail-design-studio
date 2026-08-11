import { Link } from 'react-router-dom';
import { Compass, Monitor, Palette, Users, ArrowRight } from 'lucide-react';
import { Card, cx } from '@/design-system';
import { designNewFresh, Routes } from '@/app/routes';
import { communityHref } from '@/community/lib/entry-link';
import { readOnboarding } from '@/platform/onboarding';
import { useRequireAuth } from '@/platform/session';
import { readAllDesigns } from '@/platform/designs';
import { useCustomerStore } from '@/platform/customers';
import { readData, StorageKeys } from '@/lib/storage';

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
 * `/` Dashboard：欢迎语 + 三张引导卡（PRD §2.3）。
 * 完成判定从实际数据派生：绑定设备 / 添加客户 / 创建设计后对应卡片自动消失。
 */
export default function DashboardPage() {
  const session = useRequireAuth();
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
      title: '绑定第一台设备',
      description: '连接扫描仪或打印机，开始数字化工作流。',
      actionLabel: '去绑定设备',
      to: Routes.deviceBind,
      done: onboarding.hasDevice,
    },
    {
      key: 'customer',
      icon: Users,
      title: '添加第一位客户',
      description: '建立客户档案，记录偏好与过敏信息。',
      actionLabel: '新建客户',
      to: Routes.customerNew,
      done: onboarding.hasCustomer,
    },
    {
      key: 'design',
      icon: Palette,
      title: '创建第一个设计',
      description: '选模板、调参数，十分钟出一套十指设计。',
      actionLabel: '创建设计',
      to: designNewFresh(),
      done: onboarding.hasDesign,
    },
  ];
  const pendingCards = cards.filter((c) => !c.done);

  return (
    <div className="flex flex-col gap-6 animate-fade-in" data-debug-id="app.dashboard">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">
          欢迎回来，{session.storeName}
        </h1>
        <p className="mt-0.5 text-xs text-gray-500">今天也是做出好看指甲的一天。</p>
      </header>

      {/* 概览统计 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: '客户', value: activeCustomers, to: Routes.customers },
          { label: '设计稿', value: designCount, to: Routes.designs },
          { label: '设备', value: deviceCount, to: Routes.devices },
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
            <p className="text-sm font-medium text-gray-900">浏览 Community</p>
            <p className="mt-0.5 text-xs text-gray-500">独立灵感域 · 不依赖当前 Wizard 选择</p>
          </div>
        </div>
        <Link
          to={communityHref({ entry: 'dashboard', returnTo: Routes.dashboard })}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-fast hover:text-primary-hover"
        >
          进入社区
          <ArrowRight size={13} />
        </Link>
      </Card>

      {/* 引导卡片：全部完成后整组消失 */}
      {pendingCards.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-gray-700">开始你的第一次配置</h2>
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
