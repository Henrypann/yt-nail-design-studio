import { ArrowRight, Compass, MonitorCog, Palette, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { communityHref } from '@/community/lib/entry-link';
import { communityProductHref } from '@/app/product-navigation';
import { designNewFresh, Routes } from '@/app/routes';
import { readAllDesigns } from '@/platform/designs';
import { useDevicesStore } from '@/platform/devices/device-store';
import { useRequireAuth } from '@/platform/session';
import { CrossProductLink } from '@/app/CrossProductLink';

export default function StudioHomePage() {
  const session = useRequireAuth();
  const { t } = useLocale();
  const deviceCount = useDevicesStore((state) => state.devices.length);
  const designCount = readAllDesigns().length;
  if (!session) return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" data-debug-id="studio.home">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-gray-950 via-gray-900 to-fuchsia-950 px-5 py-7 text-white shadow-float sm:px-8 sm:py-10">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200">
            <Sparkles size={14} /> {t('app.nailDesignStudio')}
          </p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-4xl">{t('home.heroTitle')}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-300">
            {t('home.heroDescription')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={designNewFresh()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-fuchsia-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-400"
            >
              <Palette size={16} /> {t('design.new')} <ArrowRight size={15} />
            </Link>
            <Link
              to={Routes.designs}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-white/20 bg-white/10 px-5 text-sm font-medium text-white hover:bg-white/15"
            >
              {t('design.title')} · {designCount}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex min-h-44 flex-col justify-between gap-4">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-primary-soft text-primary">
              <Compass size={19} />
            </span>
            <h2 className="mt-3 text-base font-semibold text-gray-900">{t('home.communityTitle')}</h2>
            <p className="mt-1 text-sm leading-5 text-gray-500">{t('home.communityDescription')}</p>
          </div>
          <CrossProductLink
            href={communityProductHref(communityHref({ entry: 'product_switcher', returnTo: Routes.studio }))}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
          >
            {t('home.communityCta')} <ArrowRight size={14} />
          </CrossProductLink>
        </Card>

        <Card className="flex min-h-44 flex-col justify-between gap-4" data-testid="studio-hardware-card">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-amber-50 text-amber-700">
              <MonitorCog size={19} />
            </span>
            <h2 className="mt-3 text-base font-semibold text-gray-900">
              {deviceCount > 0 ? t('home.deviceRegistered', { count: deviceCount }) : t('home.deviceRegister')}
            </h2>
            <p className="mt-1 text-sm leading-5 text-gray-500">
              {deviceCount > 0
                ? t('home.devicesReady')
                : t('home.devicesPending')}
            </p>
          </div>
          <Link
            to={deviceCount > 0 ? Routes.devices : Routes.deviceBind}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
          >
            {deviceCount > 0 ? t('home.manageDevices') : t('home.registerHardware')} <ArrowRight size={14} />
          </Link>
        </Card>
      </section>
    </div>
  );
}
