import { CommunityFeed } from '../components/CommunityFeed';
import { CommunityHomeMerchandising } from '../components/CommunityHomeMerchandising';

export default function CommunityDiscoverPage() {
  return (
    <div className="space-y-4" data-testid="community-discover-page" data-debug-id="community.discover">
      <CommunityHomeMerchandising />
      <CommunityFeed
        mode="discover"
        title="Nail Lover Community"
        subtitle="发现美甲灵感、收藏 Nail Board，并将喜欢的方案带入 Nail Design Studio"
      />
    </div>
  );
}
