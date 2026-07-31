import { MERCURY_DEW_DEFINITION } from './recipe-registry.ts';

export function recipeDefinitionChecksum(recipeId: string): string {
  const source = recipeId === 'mercury-dew' ? JSON.stringify(MERCURY_DEW_DEFINITION) : recipeId;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
