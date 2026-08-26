import { CommunityFeed } from '../components/CommunityFeed';
import { useLocale } from '@/lib/i18n';

export default function CommunityCreatorsPage() {
  const { t } = useLocale();
  return (
    <div data-testid="community-creators-page" data-debug-id="community.creators">
      <CommunityFeed
        mode="discover"
        title={t('community.creatorsTitle')}
        subtitle={t('community.creatorsSubtitle')}
        lockedSource="creators"
      />
    </div>
  );
}
