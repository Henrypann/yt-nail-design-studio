import { CommunityFeed } from '../components/CommunityFeed';

export default function CommunityDiscoverPage() {
  return (
    <div data-testid="community-discover-page" data-debug-id="community.discover">
      <CommunityFeed
        mode="discover"
        title="Nail Lover Community"
        subtitle="发现美甲灵感、收藏 Nail Board，并将喜欢的方案带入 Nail Design Studio"
      />
    </div>
  );
}
