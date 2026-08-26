import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createOfficialStarterShelfReadModelV1 } from '../src/studio/assets/official-starter-shelf/read-model-v1.ts';
import { preflightOfficialStarterAssetV1 } from '../src/studio/assets/official-starter-shelf/preflight-v1.ts';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const index = JSON.parse(await fs.readFile(path.join(root, 'material-library/index.json'), 'utf8'));
const ledger = JSON.parse(await fs.readFile(path.join(root, 'material-library/asset-ops-governance-v1.json'), 'utf8'));
const shelf = createOfficialStarterShelfReadModelV1({ materialIndex: index, governanceLedger: ledger });
assert.ok(shelf);
const loadBytes = (assetPath) => fs.readFile(path.join(root, assetPath));
for (const shape of ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto']) {
  const result = await preflightOfficialStarterAssetV1({ entry: shelf.entries[0], shape, loadBytes });
  assert.equal(result.technicalStatus, 'EXACT', shape);
  assert.equal(result.assetRef?.assetId, `asset.template-pattern.t_french_white.${shape}`);
  assert.equal(result.manufacturingValidated, false);
}
const wrongBytes = await preflightOfficialStarterAssetV1({ entry: shelf.entries[0], shape: 'almond', loadBytes: async () => new Uint8Array([1, 2, 3]) });
assert.deepEqual(wrongBytes.diagnostics, ['ASSET_SHA256_MISMATCH']);
console.log('test-studio-official-starter-preflight: PASS (Classic French x 7 shapes, SHA and governance fail-closed)');
