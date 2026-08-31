import { ArrowRight, Compass, MonitorCog, Palette } from 'lucide-react';
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8" data-debug-id="studio.home">
      <section>
        <p className="text-caption font-semibold text-primary">{t('app.nailDesignStudio')}</p>
        <h1 className="mt-2 max-w-2xl text-h1 font-semibold tracking-tight text-ink">
          {t('home.heroTitle')}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-body">
          {t('home.heroDescription')}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to={designNewFresh()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Palette size={16} /> {t('design.new')}
          </Link>
          <Link
            to={Routes.designs}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-hairline bg-surface px-5 text-sm font-medium text-ink hover:bg-surface-soft"
          >
            {t('design.title')} · {designCount}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex min-h-44 flex-col justify-between gap-4 border-hairline">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-primary-soft text-primary">
              <Compass size={19} />
            </span>
            <h2 className="mt-3 text-h3 font-semibold text-ink">{t('home.communityTitle')}</h2>
            <p className="mt-1 text-sm leading-5 text-body">{t('home.communityDescription')}</p>
          </div>
          <CrossProductLink
            href={communityProductHref(communityHref({ entry: 'product_switcher', returnTo: Routes.studio }))}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
          >
            {t('home.communityCta')} <ArrowRight size={14} />
          </CrossProductLink>
        </Card>

        <Card className="flex min-h-44 flex-col justify-between gap-4 border-hairline" data-testid="studio-hardware-card">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-workspace text-ink">
              <MonitorCog size={19} />
            </span>
            <h2 className="mt-3 text-h3 font-semibold text-ink">
              {deviceCount > 0 ? t('home.deviceRegistered', { count: deviceCount }) : t('home.deviceRegister')}
            </h2>
            <p className="mt-1 text-sm leading-5 text-body">
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
