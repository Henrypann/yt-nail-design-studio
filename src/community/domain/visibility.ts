import type { CommunityContentV1, CommunityPublisherV1 } from './types';

/** Demo Community fixtures are visible only in explicit non-public QA modes. */
export function allowsCommunityDemoContent(mode: string): boolean {
  return mode === 'development' || mode === 'integration' || mode === 'test';
}

export function visibleCommunityPublishers(
  publishers: CommunityPublisherV1[],
  mode: string,
): CommunityPublisherV1[] {
  if (allowsCommunityDemoContent(mode)) return publishers;
  return publishers.filter(
    (publisher) => !publisher.demo && publisher.verification !== 'DEMO_VERIFIED_CREATOR',
  );
}

export function visibleCommunityContents(
  contents: CommunityContentV1[],
  mode: string,
): CommunityContentV1[] {
  if (allowsCommunityDemoContent(mode)) return contents;
  return contents.filter((content) => !content.demo && content.publisherType === 'OFFICIAL');
}
