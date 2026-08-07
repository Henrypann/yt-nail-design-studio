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

/** Small request gate used by the modal to reject out-of-order async results. */
export function createRecommendationRequestGate() {
  let current = 0;
  return {
    begin(): number {
      current += 1;
      return current;
    },
    isCurrent(token: number): boolean {
      return token === current;
    },
    invalidate(token: number): void {
      if (token === current) current += 1;
    },
  };
}

/**
 * Partition style recommendations into curated (primary) and concept groups.
 * Returns at most 2 curated + 1 concept, sorted by priority.
 */
export function partitionStyles(all: StyleRecommendation[]): PartitionedStyles {
  // Deterministic tie-break: priority first, then id for stable ordering
  const sorted = [...all].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  const curated = sorted.filter((s) => s.cover_status !== 'CONCEPT');
  const concepts = sorted.filter((s) => s.cover_status === 'CONCEPT');

  return {
    primary: curated.slice(0, MAX_CURATED),
    concept: concepts.slice(0, MAX_CONCEPT),
  };
}
