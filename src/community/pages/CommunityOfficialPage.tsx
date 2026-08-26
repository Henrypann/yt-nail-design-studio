import { CommunityFeed } from '../components/CommunityFeed';
import { useLocale } from '@/lib/i18n';

export default function CommunityOfficialPage() {
  const { t } = useLocale();
  return (
    <div data-testid="community-official-page" data-debug-id="community.official">
      <CommunityFeed
        mode="discover"
        title={t('community.officialTitle')}
        subtitle={t('community.officialSubtitle')}
        lockedSource="official"
        showOfficialProgress
      />
    </div>
  );
}
