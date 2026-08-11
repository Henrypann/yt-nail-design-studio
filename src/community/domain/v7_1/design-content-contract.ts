/**
 * Community V7.1 · GEN-V7.1-02 runtime contract constants.
 *
 * Single source of truth the runtime parsers validate against. The
 * machine-readable artifact `design-content-v1.schema.json` must agree with
 * these constants (required fields, allowed keys, `additionalProperties:
 * false`) — the test tool cross-checks both sides. `MAX_ISSUES` is the shared
 * GEN-01 bound; `FORBIDDEN_DEVICE_MANUFACTURING_KEYS` is the bounded list of
 * device/manufacturing terms that must never appear in design/look content.
 */

export { MAX_ISSUES } from './contract.ts';

export const DESIGN_VERSION_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'designVersionId',
  'designId',
  'version',
  'revision',
  'editorDocRef',
  'releasedByIdentityId',
  'releasedAt',
  'assetRevisionRefs',
];
export const DESIGN_VERSION_V1_ALLOWED_KEYS: readonly string[] = [
  ...DESIGN_VERSION_V1_REQUIRED_FIELDS,
  'parentVersionId',
];

export const EDITOR_DOC_V7_REF_REQUIRED_FIELDS: readonly string[] = [
  'designId',
  'schemaVersion',
  'revision',
  'sha256',
];
export const EDITOR_DOC_V7_REF_ALLOWED_KEYS: readonly string[] = EDITOR_DOC_V7_REF_REQUIRED_FIELDS;

export const IMMUTABLE_ASSET_REVISION_REF_REQUIRED_FIELDS: readonly string[] = [
  'assetId',
  'revision',
  'sha256',
];
export const IMMUTABLE_ASSET_REVISION_REF_ALLOWED_KEYS: readonly string[] = [
  ...IMMUTABLE_ASSET_REVISION_REF_REQUIRED_FIELDS,
  'mimeType',
];

export const PUBLISHED_LOOK_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'lookId',
  'designVersionId',
  'creatorProfileId',
  'title',
  'tags',
  'visibility',
  'coverPreview',
  'detailPreviews',
  'summaries',
  'publicationGate',
  'status',
  'createdAt',
  'updatedAt',
];
export const PUBLISHED_LOOK_V1_ALLOWED_KEYS: readonly string[] = [
  ...PUBLISHED_LOOK_V1_REQUIRED_FIELDS,
  'metadata',
  'publishedAt',
  'remixRelationId',
];

export const PUBLISHED_PREVIEW_ASSET_REF_REQUIRED_FIELDS: readonly string[] = [
  'assetId',
  'revision',
  'kind',
  'sha256',
  'mimeType',
  'width',
  'height',
  'fidelity',
];
export const PUBLISHED_PREVIEW_ASSET_REF_ALLOWED_KEYS: readonly string[] =
  PUBLISHED_PREVIEW_ASSET_REF_REQUIRED_FIELDS;

export const PUBLISHED_LOOK_SUMMARY_REQUIRED_FIELDS: readonly string[] = [
  'shapeIds',
  'lengthIds',
  'palette',
];
export const PUBLISHED_LOOK_SUMMARY_ALLOWED_KEYS: readonly string[] =
  PUBLISHED_LOOK_SUMMARY_REQUIRED_FIELDS;

export const REMIX_RELATION_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'relationId',
  'sourceLookId',
  'sourceDesignVersionId',
  'sourceCreatorProfileId',
  'targetDesignVersionId',
  'createdAt',
];
export const REMIX_RELATION_V1_ALLOWED_KEYS: readonly string[] = [
  ...REMIX_RELATION_V1_REQUIRED_FIELDS,
  'license',
  'sourceAttribution',
];

/**
 * Keys that must never appear in design/look content contracts, matched
 * case-insensitively at any nesting depth: device references, work orders,
 * manufacturing definitions, process routes, waveforms, trajectories,
 * exposure/UV/cure parameters and print-job terms. Design/look content is
 * decoupled from the manufacturing & device plane; such fields only live in
 * ManufacturingDefinition / WorkOrder / DeviceTask contracts.
 */
export const FORBIDDEN_DEVICE_MANUFACTURING_KEYS: readonly string[] = [
  'deviceid',
  'devicemodel',
  'devicetask',
  'devicetaskid',
  'deviceparameter',
  'deviceparameters',
  'workorder',
  'workorderid',
  'manufacturingdefinition',
  'manufacturingdefinitionid',
  'processroute',
  'vendorjob',
  'vendorjobid',
  'jobid',
  'printjob',
  'waveform',
  'motiontrajectory',
  'trajectory',
  'exposure',
  'exposuretime',
  'uvpower',
  'lampower',
  'lampenergy',
  'curetime',
  'curingprofile',
  'zaxis',
  'axisposition',
  'heater',
  'heaterpower',
  'nozzle',
  'nozzletemperature',
  'inkjethead',
  'pressure',
  'airpressure',
  'temperature',
  'feedrate',
  'pumpspeed',
];
