import { CommunityFeed } from '../components/CommunityFeed';

export default function CommunityOfficialPage() {
  return (
    <div data-testid="community-official-page" data-debug-id="community.official">
      <CommunityFeed
        title="官方灵感库"
        subtitle="平台策展高保真方案 · 非用户 UGC · 制造状态见证据徽章"
        lockedSource="official"
        showOfficialProgress
      />
    </div>
  );
}
