import { getRecipeDefinition } from './recipe-registry.ts';

export function recipeDefinitionChecksum(recipeId: string): string {
  const source = JSON.stringify(getRecipeDefinition(recipeId) ?? recipeId);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
