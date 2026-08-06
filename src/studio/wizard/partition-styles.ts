/**
 * Wizard style recommendation partitioning (PR-05).
 * Rule: at most 2 curated (primary) + 1 concept per shape.
 */

import type { StyleRecommendation } from './StyleRecommendModal';

export const MAX_CURATED = 2;
export const MAX_CONCEPT = 1;
export const MAX_RECOMMENDATIONS = MAX_CURATED + MAX_CONCEPT;

export interface PartitionedStyles {
  primary: StyleRecommendation[];
  concept: StyleRecommendation[];
}

/**
 * Partition style recommendations into curated (primary) and concept groups.
 * Returns at most 2 curated + 1 concept, sorted by priority.
 */
export function partitionStyles(all: StyleRecommendation[]): PartitionedStyles {
  const sorted = [...all].sort((a, b) => a.priority - b.priority);

  const curated = sorted.filter((s) => s.cover_status !== 'CONCEPT');
  const concepts = sorted.filter((s) => s.cover_status === 'CONCEPT');

  return {
    primary: curated.slice(0, MAX_CURATED),
    concept: concepts.slice(0, MAX_CONCEPT),
  };
}
