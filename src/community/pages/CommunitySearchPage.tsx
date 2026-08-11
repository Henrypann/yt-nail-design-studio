import { CommunityFeed } from '../components/CommunityFeed';

export default function CommunitySearchPage() {
  return (
    <div data-testid="community-search-page" data-debug-id="community.search">
      <CommunityFeed
        mode="search"
        title="Search"
        subtitle="搜索 Looks 与创作者 · 精选/趋势/最新 · 全部状态 URL 可分享"
      />
    </div>
  );
}
