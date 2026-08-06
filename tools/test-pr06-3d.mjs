/**
 * PR-06 self-test: asset manifest validation, renderer adapter.
 */

import { strict as assert } from 'node:assert';

/* ── 1. Asset manifest validation ────────────────────────── */

const manifestMod = await import('../src/studio/preview/asset-manifest.ts');
const { validateComponentEntry, validateAssetManifest } = manifestMod;

{
  // Valid component
  const valid = {
    id: 'shell-almond-med',
    name: 'Almond Medium Shell',
    category: 'shell',
    shape: 'almond',
    length: 'medium',
    glb: { web: { path: '/assets/glb/shell.web.glb' } },
    status: 'SIMULATED',
  };
  assert.equal(validateComponentEntry(valid), null);

  // Missing id
  assert.ok(validateComponentEntry({ name: 'x', category: 'shell', glb: { web: { path: '/' } }, status: 'REAL' }));

  // Invalid category
  assert.ok(validateComponentEntry({ id: 'x', name: 'x', category: 'invalid', glb: { web: { path: '/' } }, status: 'REAL' }));

  // Invalid status
  assert.ok(validateComponentEntry({ id: 'x', name: 'x', category: 'shell', glb: { web: { path: '/' } }, status: 'INVALID' }));

  // Missing glb variants
  assert.ok(validateComponentEntry({ id: 'x', name: 'x', category: 'shell', glb: {}, status: 'REAL' }));

  // Valid manifest
  const manifest = {
    version: 1,
    recipeId: 'mercury-dew',
    updatedAt: '2026-08-01T00:00:00Z',
    components: [valid],
  };
  const result = validateAssetManifest(manifest);
  assert.ok(result.ok);

  // Invalid manifest version
  const badVersion = validateAssetManifest({ version: 2, recipeId: 'x', components: [] });
  assert.ok(!badVersion.ok);

  // Invalid manifest missing recipeId
  const noRecipe = validateAssetManifest({ version: 1, components: [] });
  assert.ok(!noRecipe.ok);

  console.log('[test:asset-manifest] PASS');
}

/* ── 2. Renderer adapter ─────────────────────────────────── */

const adapterMod = await import('../src/studio/preview/renderer-adapter.ts');
const { registerRenderer, createRendererRegistry, describeRendererStatus } = adapterMod;

{
  const registry = createRendererRegistry();

  // Empty registry
  assert.equal(registry.findRenderer('any'), null);
  assert.deepEqual(registry.listRenderers(), []);

  // Register a mock renderer
  const mockRenderer = {
    status: 'ready',
    version: 'three-pbr/test-1',
    canRender: (recipeId) => recipeId === 'test-recipe',
    init: async () => true,
    dispose: () => {},
  };
  registerRenderer(mockRenderer);

  const found = registry.findRenderer('test-recipe');
  assert.ok(found);
  assert.equal(found.version, 'three-pbr/test-1');

  assert.equal(registry.findRenderer('other-recipe'), null);
  assert.equal(registry.listRenderers().length, 1);

  // Status descriptions
  assert.equal(describeRendererStatus('idle'), '未初始化');
  assert.equal(describeRendererStatus('loading'), '加载中…');
  assert.equal(describeRendererStatus('ready'), '就绪');
  assert.equal(describeRendererStatus('error'), '加载失败');
  assert.equal(describeRendererStatus('fallback_2d'), '2D 预览');

  console.log('[test:renderer-adapter] PASS');
}

/* ── Done ────────────────────────────────────────────────── */

console.log('\ntest-pr06-3d-foundation: all assertions passed');
