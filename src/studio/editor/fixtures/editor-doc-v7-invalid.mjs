import { createFullEditorDocV7Fixture } from './editor-doc-v7.mjs';

const clone = (value) => structuredClone(value);
const mutate = (change) => {
  const doc = createFullEditorDocV7Fixture();
  change(doc);
  return doc;
};

export const EDITOR_DOC_V7_INVALID_FIXTURES = [
  { name: 'schema version', expectedCode: 'schema_version', value: mutate((d) => { d.schemaVersion = 6; }) },
  { name: 'missing background', expectedCode: 'background_missing', value: mutate((d) => { d.nails.L1.steps.shift(); }) },
  { name: 'duplicate background', expectedCode: 'background_duplicated', value: mutate((d) => { d.nails.L1.steps.splice(1, 0, clone(d.nails.L2.steps[0])); }) },
  { name: 'background not first', expectedCode: 'background_not_first', value: mutate((d) => { [d.nails.L1.steps[0], d.nails.L1.steps[1]] = [d.nails.L1.steps[1], d.nails.L1.steps[0]]; }) },
  { name: 'background skipped', expectedCode: 'background_skipped', value: mutate((d) => { d.nails.L1.steps[0].skipped = true; }) },
  { name: 'missing finish', expectedCode: 'finish_missing', value: mutate((d) => { d.nails.L1.steps.pop(); }) },
  { name: 'duplicate finish', expectedCode: 'finish_duplicated', value: mutate((d) => { d.nails.L1.steps.push(clone(d.nails.L2.steps.at(-1))); }) },
  { name: 'finish not last', expectedCode: 'finish_not_last', value: mutate((d) => { const finish = d.nails.L1.steps.pop(); d.nails.L1.steps.splice(1, 0, finish); }) },
  { name: 'finish skipped', expectedCode: 'finish_skipped', value: mutate((d) => { d.nails.L1.steps.at(-1).skipped = true; }) },
  { name: 'finish hidden', expectedCode: 'finish_not_visible', value: mutate((d) => { d.nails.L1.steps.at(-1).visible = false; }) },
  { name: 'invalid finish', expectedCode: 'invalid_enum', value: mutate((d) => { d.nails.L1.steps.at(-1).finish.type = 'pearl'; }) },
  { name: 'unknown kind', expectedCode: 'step_kind_not_allowed', value: mutate((d) => { d.nails.L1.steps[1].kind = 'uv_print'; }) },
  { name: 'unknown top key', expectedCode: 'unknown_key', value: mutate((d) => { d.experimental = true; }) },
  { name: 'legacy customerId', expectedCode: 'legacy_dual_write', value: mutate((d) => { d.customerId = 'legacy'; }) },
  { name: 'order field', expectedCode: 'unknown_key', value: mutate((d) => { d.nails.L1.steps[1].order = 1; }) },
  { name: 'nine fingers', expectedCode: 'finger_set', value: mutate((d) => { delete d.nails.R5; }) },
  { name: 'finger mismatch', expectedCode: 'finger_mismatch', value: mutate((d) => { d.nails.L1.finger = 'R1'; }) },
  { name: 'duplicate node id', expectedCode: 'duplicate_id', value: mutate((d) => { d.nails.L2.steps[0].id = d.nails.L1.steps[0].id; }) },
  { name: 'dangling recipe', expectedCode: 'dangling_reference', value: mutate((d) => { d.nails.L1.steps[1].recipeInstanceId = 'recipe.missing'; }) },
  { name: 'invalid rgba', expectedCode: 'out_of_range', value: mutate((d) => { d.nails.L1.steps[0].background.color.r = 256; }) },
  { name: 'gradient stop order', expectedCode: 'out_of_range', value: mutate((d) => { d.nails.L3.steps[0].background.stops[1].offset = 0; }) },
  { name: 'non finite transform', expectedCode: 'invalid_type', value: mutate((d) => { d.nails.L1.steps[1].elements[0].transform.position.u = Infinity; }) },
  { name: 'out of nail coordinate', expectedCode: 'out_of_range', value: mutate((d) => { d.nails.L1.steps[1].elements[0].transform.position.v = 1.1; }) },
  { name: 'invalid hash', expectedCode: 'invalid_hash', value: mutate((d) => { d.communicationRefs[0].asset.sha256 = '1234'; }) },
  { name: 'data url', expectedCode: 'unknown_key', value: mutate((d) => { d.communicationRefs[0].asset.dataUrl = 'data:image/png;base64,AA'; }) },
  { name: 'nested recipe parameter', expectedCode: 'invalid_parameters', value: mutate((d) => { d.recipeInstances['recipe.cat-eye.1'].parameterValues.bad = { nested: true }; }) },
  { name: 'invalid timestamp', expectedCode: 'invalid_timestamp', value: mutate((d) => { d.createdAt = 'yesterday'; }) },
  { name: 'invalid calendar date', expectedCode: 'invalid_timestamp', value: mutate((d) => { d.createdAt = '2026-02-30T01:00:00.000Z'; }) },
  { name: 'timestamp order', expectedCode: 'timestamp_order', value: mutate((d) => { d.updatedAt = '2026-08-06T01:00:00.000Z'; }) },
  { name: 'registry mismatch', expectedCode: 'type_registry_mismatch', value: mutate((d) => { d.nails.L1.steps[1].typeId = 'builtin.v7.surface_effect'; }) },
  { name: 'dangling composition', expectedCode: 'dangling_reference', value: mutate((d) => { d.nails.L1.compositionProvenance.revision = 'missing'; }) },
  { name: 'missing effect mask', expectedCode: 'not_an_object', value: mutate((d) => { delete d.nails.L1.steps[2].mask; }) },
  { name: 'invalid effect fidelity', expectedCode: 'invalid_enum', value: mutate((d) => { d.nails.L1.steps[2].effect.previewFidelity = 'high'; }) },
  { name: 'geometry enum dual write', expectedCode: 'unknown_key', value: mutate((d) => { d.nails.L1.geometryRef.shape = 'oval'; }) },
];
