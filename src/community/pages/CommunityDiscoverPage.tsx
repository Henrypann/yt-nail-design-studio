import { CommunityFeed } from '../components/CommunityFeed';

export default function CommunityDiscoverPage() {
  return (
    <div data-testid="community-discover-page" data-debug-id="community.discover">
      <CommunityFeed
        mode="discover"
        title="Discover"
        subtitle="官方 PGC 与认证创作者 Demo 混合灵感 · 搜索/排序/筛选 URL 可分享"
      />
    </div>
  );
}
