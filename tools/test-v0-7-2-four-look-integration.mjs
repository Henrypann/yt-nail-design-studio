import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FINGER_CODES } from '../src/lib/types.ts';
import { parsePublishedLookV1 } from '../src/community/domain/v7_1/design-content-parse.ts';
import { resolveStudioUseAvailabilityV1 } from '../src/community/domain/studio-use-availability.ts';
import { resolveDimensionalMeshFidelityV7 } from '../src/studio/editor/v7/dimensional-decoration.ts';
import { FOUR_LOOK_SET_DEFINITIONS_V0_7_2 } from '../src/studio/editor/v7/four-look-sets.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import { canonicalJsonV1, parseDesignReleaseStoreV1 } from '../src/studio/versioning/design-release.ts';
import { FOUR_LOOK_SET_AUTHORITIES_V0_7_2 } from '../src/integration/community-studio/v0-7-2-four-look-sets.ts';

assert.equal(FOUR_LOOK_SET_AUTHORITIES_V0_7_2.length, 4);
assert.equal(new Set(FOUR_LOOK_SET_AUTHORITIES_V0_7_2.map((authority) => authority.publishedLook.lookId)).size, 4);

for (const authority of FOUR_LOOK_SET_AUTHORITIES_V0_7_2) {
  const { definition, doc, release, publishedLook, readModel } = authority;
  assert.equal(parsePublishedLookV1(publishedLook).ok, true, `${definition.id} PublishedLook parses`);
  assert.equal(parseEditorDocV7(doc).ok, true, `${definition.id} EditorDoc parses`);
  const parsedStore = parseDesignReleaseStoreV1({ schemaVersion: 1, kind: 'STUDIO_DESIGN_RELEASE_STORE', records: [release] });
  assert.equal(parsedStore.ok, true, `${definition.id} release envelope parses`);
  const digest = createHash('sha256').update(canonicalJsonV1(doc)).digest('hex');
  assert.equal(digest, release.designVersion.editorDocRef.sha256, `${definition.id} immutable snapshot digest`);
  assert.deepEqual(release.designVersion.assetRevisionRefs, release.manifest.assetRevisionRefs);
  assert.deepEqual(resolveStudioUseAvailabilityV1(readModel), { enabled: true, state: 'VERSIONED_READY' });
  assert.equal(readModel.evidence.status.manufacturable, false);
  assert.equal(readModel.evidence.status.productionDispatched, false);
  assert.equal(readModel.cover.url, `/assets/hero-recipes/${definition.id}/look-cover-16x9-v1.png`);

  const ids = [];
  for (const finger of FINGER_CODES) {
    const nail = doc.nails[finger];
    assert.equal(nail.steps[0].kind, 'background', `${definition.id}/${finger} begins with background`);
    assert.equal(nail.steps.at(-1).kind, 'surface_finish', `${definition.id}/${finger} ends with finish`);
    assert.equal(nail.steps.length, definition.fingers[finger].middle.length + 2, `${definition.id}/${finger} preserves signed allocation`);
    assert.equal(nail.steps.filter((step) => step.kind === 'background').length, 1);
    assert.equal(nail.steps.filter((step) => step.kind === 'surface_finish').length, 1);
    ids.push(...nail.steps.map((step) => step.id));
    for (const step of nail.steps) {
      if (step.kind === 'flat_design') ids.push(...step.elements.map((element) => element.id));
      if (step.kind === 'dimensional_decoration') {
        ids.push(...step.decorations.map((decoration) => decoration.id));
        for (const decoration of step.decorations) {
          if (decoration.kind === 'attachment_3d') {
            assert.equal(resolveDimensionalMeshFidelityV7(decoration.asset), 'approximate', `${definition.id}/${finger} GLB registry fidelity`);
          }
        }
      }
    }
  }
  assert.equal(new Set(ids).size, ids.length, `${definition.id} node ids are globally unique`);
}

assert.deepEqual(
  FOUR_LOOK_SET_AUTHORITIES_V0_7_2.map((authority) => authority.definition.id),
  FOUR_LOOK_SET_DEFINITIONS_V0_7_2.map((definition) => definition.id),
);
console.log('[test:look-v0-7-2-four-sets-integration] PASS · 4 canonical Community → EditorDocV7 releases');
