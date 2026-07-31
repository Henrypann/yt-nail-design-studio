import definitionJson from '../../../../material-library/recipes/mercury-dew/recipe.json' with { type: 'json' };
import petalDefinitionJson from '../../../../material-library/recipes/petal-veil-french/recipe.json' with { type: 'json' };
import indexJson from '../../../../material-library/recipes/index.json' with { type: 'json' };
import type { RecipeDefinitionV1, RecipeInstanceV1 } from './recipe-model';

export const MERCURY_DEW_DEFINITION = definitionJson as RecipeDefinitionV1;
export const PETAL_VEIL_DEFINITION = petalDefinitionJson as RecipeDefinitionV1;
export const RECIPE_REGISTRY = indexJson as { version: string; recipes: Array<{ id: string; version: string; definition: string; lifecycle: string; manufacturing_command_allowed: false }> };

export function getRecipeDefinition(id: string, version?: string): RecipeDefinitionV1 | null {
  const definition =
    id === MERCURY_DEW_DEFINITION.identity.id
      ? MERCURY_DEW_DEFINITION
      : id === PETAL_VEIL_DEFINITION.identity.id
        ? PETAL_VEIL_DEFINITION
        : null;
  if (!definition || (version && version !== definition.version)) return null;
  return definition;
}

export function assertRecipeReference(instance: RecipeInstanceV1): void {
  const definition = getRecipeDefinition(instance.recipeRef.id, instance.recipeRef.version);
  if (!definition) throw new Error(`Recipe reference unavailable: ${instance.recipeRef.id}@${instance.recipeRef.version}`);
  if (definition.outputPolicy.manufacturing_command_allowed) throw new Error('Recipe cannot emit manufacturing commands');
}
