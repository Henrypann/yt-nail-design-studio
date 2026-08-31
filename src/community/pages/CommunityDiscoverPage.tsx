import { CommunityFeed } from '../components/CommunityFeed';
import { CommunityHomeMerchandising } from '../components/CommunityHomeMerchandising';
import { useLocale } from '@/lib/i18n';

export default function CommunityDiscoverPage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-12" data-testid="community-discover-page" data-debug-id="community.discover">
      <CommunityHomeMerchandising />
      <CommunityFeed
        mode="discover"
        title={t('community.discoverTitle')}
        subtitle={t('community.discoverSubtitle')}
        titleAppearance="hero"
      />
    </div>
  );
}
