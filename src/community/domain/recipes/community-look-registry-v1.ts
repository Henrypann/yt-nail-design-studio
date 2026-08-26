/**
 * Community Look Recipe Registry V1.
 *
 * This is deliberately separate from Editor RecipeDefinitionV1. It registers
 * public Community identities and their evidence/source lineage; it does not
 * claim that a Look is directly editable or manufacturable.
 */

export const COMMUNITY_LOOK_RECIPE_REGISTRY_SCHEMA = 'community-look-recipe-registry-v1' as const;
export const COMMUNITY_LOOK_RECIPE_IDS = Object.freeze([
  'mercury-dew',
  'petal-veil-french',
  'leopard-gilded-nude',
  'crimson-reliquary',
  'ivory-lace-crystal',
  'honey-petal-glass',
  'petal-pearl-bloom',
] as const);

const ROOT_KEYS = ['schemaVersion', 'architectureBaseline', 'updatedAt', 'recipes'] as const;
const ENTRY_KEYS = [
  'recipeId', 'displayName', 'lookIds', 'sourceRefs', 'lifecycle', 'evidenceTier',
  'completenessPriority', 'manufacturingCommandAllowed',
] as const;
const LIFECYCLES = ['CONCEPT', 'SIMULATED'] as const;

export type CommunityLookRecipeIdV1 = typeof COMMUNITY_LOOK_RECIPE_IDS[number];
export type CommunityLookRecipeEntryV1 = {
  recipeId: CommunityLookRecipeIdV1;
  displayName: string;
  lookIds: string[];
  sourceRefs: string[];
  lifecycle: typeof LIFECYCLES[number];
  evidenceTier: string;
  completenessPriority: number;
  manufacturingCommandAllowed: false;
};
export type CommunityLookRecipeRegistryV1 = {
  schemaVersion: typeof COMMUNITY_LOOK_RECIPE_REGISTRY_SCHEMA;
  architectureBaseline: 'v0.7.2';
  updatedAt: string;
  recipes: CommunityLookRecipeEntryV1[];
};

export type CommunityLookRecipeRegistryDiagnosticV1 =
  | { code: 'REGISTRY_INVALID'; message: string }
  | { code: 'LOOK_UNREGISTERED'; lookId: string };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}
function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString) && new Set(value).size === value.length;
}

export function parseCommunityLookRecipeRegistryV1(value: unknown): CommunityLookRecipeRegistryV1 | null {
  const raw = object(value);
  if (!raw || !exactKeys(raw, ROOT_KEYS) || raw.schemaVersion !== COMMUNITY_LOOK_RECIPE_REGISTRY_SCHEMA
    || raw.architectureBaseline !== 'v0.7.2' || !nonEmptyString(raw.updatedAt) || !Array.isArray(raw.recipes)
    || raw.recipes.length !== COMMUNITY_LOOK_RECIPE_IDS.length) return null;
  const seenRecipeIds = new Set<string>();
  const seenLookIds = new Set<string>();
  const recipes: CommunityLookRecipeEntryV1[] = [];
  for (const candidate of raw.recipes) {
    const entry = object(candidate);
    if (!entry || !exactKeys(entry, ENTRY_KEYS) || !nonEmptyString(entry.recipeId)
      || !COMMUNITY_LOOK_RECIPE_IDS.includes(entry.recipeId as CommunityLookRecipeIdV1)
      || seenRecipeIds.has(entry.recipeId)
      || !nonEmptyString(entry.displayName) || !uniqueStrings(entry.lookIds) || !uniqueStrings(entry.sourceRefs)
      || !LIFECYCLES.includes(entry.lifecycle as typeof LIFECYCLES[number])
      || !nonEmptyString(entry.evidenceTier) || typeof entry.completenessPriority !== 'number' || !Number.isInteger(entry.completenessPriority)
      || entry.completenessPriority < 1 || entry.completenessPriority > COMMUNITY_LOOK_RECIPE_IDS.length
      || entry.manufacturingCommandAllowed !== false) return null;
    if (entry.lookIds.some((lookId) => seenLookIds.has(lookId))) return null;
    seenRecipeIds.add(entry.recipeId);
    entry.lookIds.forEach((lookId) => seenLookIds.add(lookId));
    recipes.push(entry as unknown as CommunityLookRecipeEntryV1);
  }
  if (seenRecipeIds.size !== COMMUNITY_LOOK_RECIPE_IDS.length
    || COMMUNITY_LOOK_RECIPE_IDS.some((id) => !seenRecipeIds.has(id))) return null;
  const priorities = recipes.map((entry) => entry.completenessPriority);
  if (new Set(priorities).size !== priorities.length) return null;
  return { ...raw, recipes: structuredClone(recipes) } as unknown as CommunityLookRecipeRegistryV1;
}

export function getCommunityRecipeForLookIdV1(
  registry: CommunityLookRecipeRegistryV1,
  lookId: string,
): CommunityLookRecipeEntryV1 | null {
  return registry.recipes.find((recipe) => recipe.lookIds.includes(lookId)) ?? null;
}

/** Select one Look per registered recipe in caller-provided candidate priority order. */
export function selectRegisteredCommunityLooksV1<T extends { lookId: string }>(
  registry: CommunityLookRecipeRegistryV1,
  candidates: readonly T[],
  onDiagnostic?: (diagnostic: CommunityLookRecipeRegistryDiagnosticV1) => void,
): T[] {
  const selectedRecipeIds = new Set<string>();
  const output: T[] = [];
  for (const candidate of candidates) {
    const recipe = getCommunityRecipeForLookIdV1(registry, candidate.lookId);
    if (!recipe) {
      onDiagnostic?.({ code: 'LOOK_UNREGISTERED', lookId: candidate.lookId });
      continue;
    }
    if (selectedRecipeIds.has(recipe.recipeId)) continue;
    selectedRecipeIds.add(recipe.recipeId);
    output.push(candidate);
  }
  return output;
}
