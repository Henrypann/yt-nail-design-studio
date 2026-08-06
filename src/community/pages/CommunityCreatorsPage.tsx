import { CommunityFeed } from '../components/CommunityFeed';

export default function CommunityCreatorsPage() {
  return (
    <div data-testid="community-creators-page" data-debug-id="community.creators">
      <CommunityFeed
        title="认证创作者"
        subtitle="认证创作者 · Demo · 默认灵感参考，不展示假互动数据"
        lockedSource="creators"
      />
    </div>
  );
}
