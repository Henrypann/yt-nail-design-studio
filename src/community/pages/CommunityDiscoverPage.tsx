import { CommunityFeed } from '../components/CommunityFeed';

export default function CommunityDiscoverPage() {
  return (
    <div data-testid="community-discover-page" data-debug-id="community.discover">
      <CommunityFeed
        title="Discover"
        subtitle="官方 PGC 与认证创作者 Demo 混合灵感 · URL 筛选可分享"
      />
    </div>
  );
}
