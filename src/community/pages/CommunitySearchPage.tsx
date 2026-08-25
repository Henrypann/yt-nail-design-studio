import { CommunityFeed } from '../components/CommunityFeed';
import { useLocale } from '@/lib/i18n';

export default function CommunitySearchPage() {
  const { t } = useLocale();
  return (
    <div data-testid="community-search-page" data-debug-id="community.search">
      <CommunityFeed
        mode="search"
        title={t('community.searchTitle')}
        subtitle={t('community.searchSubtitle')}
      />
    </div>
  );
}
