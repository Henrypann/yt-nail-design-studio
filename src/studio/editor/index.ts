/**
 * Editor 模块（模块 4）对外出口。
 * 页面入口：src/app/pages/design/EditorPage.tsx（/studio/design/canvas）。
 * 桥接入口：@/studio/bridge 的 openBridge(designId)。
 */

export { EditorShell } from './components/EditorShell';
export { EditorShellV7 } from './components/EditorShellV7';
export { LayerPanelV7 } from './components/LayerPanelV7';
export { BackgroundPanelV7 } from './components/BackgroundPanelV7';
export { V7BackgroundCanvas } from './components/V7BackgroundCanvas';
export { FlatVectorPanelV7 } from './components/FlatVectorPanelV7';
export { V7FlatDesignCanvas } from './components/V7FlatDesignCanvas';
export { TenFingerBarV7 } from './components/TenFingerBarV7';
export { useEditorStore } from './store';
export { useEditorV6Store } from './store-v6';
export * from './lib/model';
export {
  createBlankEditorDesign,
  getEditorDoc,
  getEditorDocV6Result,
  hasEditorDoc,
  hasEditorDocRaw,
  inspectEditorDoc,
  saveEditorDoc,
  saveEditorDocV6,
  removeEditorDoc,
  duplicateEditorDoc,
} from './lib/repo';
export {
  createBlankEditorDesignV6,
  duplicateEditorDocV6,
  getEditorDocV6Result as getEditorDocV6ResultV6,
  hasEditorDoc as hasEditorDocV6,
  hasEditorDocRaw as hasEditorDocRawV6,
  inspectEditorDoc as inspectEditorDocV6,
  removeEditorDoc as removeEditorDocV6,
  removeDesign as removeDesignV6,
  saveEditorDocV6ToLocalStorage,
} from './lib/repo-v6';
export { createBlankEditorDesignV7, createWizardEditorDocV7 } from './lib/repo-v7';
export type {
  EditorDocProbe,
  EditorDocV6,
  EditorDocV6MigrationResult,
  EditorDocV6SaveResult,
} from './lib/repo';
export type {
  EditorDocV6 as EditorDocV6FromRepo,
  EditorDocV6MigrationResult as EditorDocV6MigrationResultV6,
  EditorDocV6SaveResult as EditorDocV6SaveResultV6,
} from './lib/repo-v6';
export { createEmptyEditorDocV6 } from './v6/model';
export { migrateEditorDocV6 } from './v6/migrate';
export { validateEditorDocV6, parseEditorDocV6 } from './v6/schema';
export { generateEditorId } from './v6/id';
export type * from './v7/model';
export {
  PREVIEW_FIDELITIES_V7,
  PROCESS_STEP_KINDS_V7,
  PROCESS_STEP_REGISTRY_V7,
  PROCESS_STEP_TYPE_IDS_V7,
  SURFACE_FINISH_TYPES_V7,
  getProcessStepTypeDefinitionV7,
} from './v7/registry';
export type { EditorToolIdV7, ProcessStepTypeDefinitionV1 } from './v7/registry';
export {
  EDITOR_V7_ADVANCED_BACKGROUND_MODES,
  EDITOR_V7_BACKGROUND_MODES,
  canonicalRgbaColorV7,
  composeBackgroundAlphaV7,
  createGlitterPreviewParticlesV7,
  hashBackgroundSeedV7,
  isAdvancedBackgroundModeV7,
  isBackgroundModeV7,
  isCanonicalRgbaColorV7,
  matchProductSilhouetteRefV7,
  normalizeBackgroundDirectionV7,
  normalizeGradientStopsV7,
  parseHexColorV7,
  representativeBackgroundColorV7,
  resolveBackgroundPreviewModelV7,
  resolveBackgroundSilhouetteV7,
  rgbaToHexV7,
  addEditorV7GradientStop,
  applyEditorV7PaletteTheme,
  removeEditorV7GradientStop,
  setEditorV7AdvancedBackgroundMode,
  setEditorV7BackgroundColor,
  setEditorV7BackgroundMode,
  setEditorV7BackgroundOpacity,
  setEditorV7CatEyeParameters,
  setEditorV7GlitterParameters,
  setEditorV7GradientDirection,
  setEditorV7GradientStops,
} from './v7/background';
export {
  FLAT_VECTOR_TOOLS_V7,
  IDENTITY_TRANSFORM_V7,
  circlePathDataV7,
  createFrenchFlatElementV7,
  createPointerFlatElementV7,
  createRegionMaskFlatElementV7,
  createVectorFlatElementV7,
  inverseTransformNailPointV7,
  isClosedNailPathDataV7,
  isDrawableNailPathDataV7,
  isValidNailPathDataV7,
  linePathDataV7,
  mapNailPathDataV7,
  moveNailPathAnchorV7,
  nailPathAnchorsV7,
  normalizePointerPointsV7,
  parseNailPathDataV7,
  rectanglePathDataV7,
  resolveFlatElementMaskScopeV7,
  replaceEditorV7FlatElement,
  serializeNailPathDataV7,
  setEditorV7FlatElementOpacity,
  starPathDataV7,
  transformNailPointV7,
} from './v7/flat-vector';
export type { FlatVectorToolV7, ParsedNailPathV7 } from './v7/flat-vector';
export {
  detachEditorV7NailScope,
  detachLinkedEditorV7NailAfterEdit,
  materializeEditorV7NailScope,
  oppositeEditorV7Finger,
  resolveEditorV7FingerScope,
} from './v7/ten-finger-operations';
export type {
  EditorV7FingerProjection,
  EditorV7FingerScope,
  EditorV7FingerScopeKind,
  EditorV7ScopeCommandResult,
  EditorV7ScopeResolution,
  EditorV7ScopeTarget,
} from './v7/ten-finger-operations';
export {
  FLAT_ASSET_MAX_BYTES_V7,
  FLAT_ASSET_MAX_DIMENSION_V7,
  FLAT_ASSET_MIN_DIMENSION_V7,
  FLAT_ASSET_MIME_PNG_V7,
  FLAT_ASSET_MIME_SVG_V7,
  FLAT_ASSET_REVISION_V1_V7,
  FLAT_BUNDLED_ASSET_REGISTRY_V7,
  FLAT_FONT_REGISTRY_V7,
  FLAT_FONT_REVISION_V1_V7,
  FLAT_SYSTEM_SANS_FALLBACK_CSS_V7,
  FLAT_IMAGE_ROLES_V7,
  FLAT_TEXT_FONT_SIZE_MAX_MM_V7,
  FLAT_TEXT_FONT_SIZE_MIN_MM_V7,
  FLAT_TEXT_MAX_CODE_POINTS_V7,
  createDefaultFlatAssetDigestV7,
  createImageFlatElementV7,
  createTextFlatElementV7,
  flatAssetSourcePayloadBytesV7,
  flatAssetSourceSha256V7,
  flatContentAssetStatusV7,
  flatElementLabelV7,
  getBundledFlatAssetV7,
  isFlatImageRoleCompatibleV7,
  isRegisteredFontV7,
  isValidFlatAssetRefV7,
  prepareFlatAssetImportV7,
  relinkImageFlatElementV7,
  resolveBundledFlatAssetV7,
  resolveFontCssFamilyV7,
  shortAssetIdV7,
  validateSvgSourceV7,
  validateFlatAssetSourceV7,
} from './v7/flat-content-assets';
export type {
  BundledFlatAssetV7,
  FlatAssetDigestV7,
  FlatAssetImportSourceV7,
  FlatAssetPreparedV7,
  FlatAssetPrepareFailureV7,
  FlatAssetPrepareOptionsV7,
  FlatAssetPrepareResultV7,
  FlatAssetSourceValidationV7,
  FlatContentAssetStatusV7,
  FlatAssetRoleV7,
  FlatFontEntryV7,
  ImageFlatElementInputV7,
  TextFlatElementInputV7,
} from './v7/flat-content-assets';
export {
  FLAT_ASSETS_STORAGE_KEY_V7,
  createFlatAssetRepositoryV7,
  createLocalFlatAssetStorageV7,
  flatAssetKeyV7,
} from './v7/flat-content-repository';
export type {
  FlatAssetEnvelopeV7,
  FlatAssetGetResultV7,
  FlatAssetInspectEntryV7,
  FlatAssetInspectResultV7,
  FlatAssetPutResultV7,
  FlatAssetRemoveResultV7,
  FlatAssetRepositoryOptionsV7,
  FlatAssetRepositoryV7,
  FlatAssetStorageV7,
  StoredFlatAssetV7,
} from './v7/flat-content-repository';
export {
  addBundledFlatAssetCommand,
  addPreparedImportCommand,
  addTextFlatElementCommand,
  relinkImageAssetCommand,
  replaceTextFlatElementCommand,
} from './v7/flat-content-commands';
export type {
  BackgroundPreviewModelV7,
  EditorV7CatEyeParametersV7,
  EditorV7GlitterParametersV7,
  EditorV7PaletteThemeV7,
  GlitterPreviewParticleV7,
  EditorV7AdvancedBackgroundModeV7,
  EditorV7BackgroundModeAnyV7,
  EditorV7BackgroundModeV7,
  NailSilhouetteV7,
} from './v7/background';
export {
  isEditorV7InternalEnabled,
  resolveEditorWriterRoute,
} from './v7/feature';
export type {
  EditorDocVersionProbeV7,
  EditorWriterRoute,
} from './v7/feature';
export type {
  EditorDocV7Issue,
  EditorDocV7IssueCode,
  EditorDocV7ParseResult,
} from './v7/schema';
export { isEditorDocV7, parseEditorDocV7, validateEditorDocV7 } from './v7/schema';
export { migrateEditorDocV7 } from './v7/migrate';
export {
  PRODUCT_GEOMETRY_REVISION_V7,
  createBlankEditorDocV7,
  createProductGeometryRefV7,
  wizardDesignToEditorDocV7,
} from './v7/create';
export type {
  BlankEditorDocV7Input,
  EditorDocV7CreationFailure,
  EditorDocV7CreationResult,
} from './v7/create';
export {
  OFFICIAL_TEMPLATE_PATTERN_ASSET_COUNT_V7,
  getOfficialTemplatePatternAssetV7,
  identifyOfficialTemplatePatternV7,
} from './v7/official-template-assets';
export type {
  AssetResolutionInputV7,
  EditorDocV7LegacyEvidence,
  EditorDocV7MigrationDiagnostic,
  EditorDocV7MigrationDiagnosticCode,
  EditorDocV7MigrationResolvers,
  EditorDocV7MigrationResult,
  FinishPresetResolutionInputV7,
  GeometryResolutionInputV7,
  RecipeResolutionInputV7,
  RecipeResolutionV7,
} from './v7/migrate';
export { getEditorDocV7Result } from './v7/repository-contract';
export {
  createEditorDocV7InLocalStorage,
  createEditorDocV7InMap,
} from './v7/repository';
export type {
  EditorDocV7Repository,
} from './v7/repository';
export {
  createEditorV7Store,
  editorV7Store,
  selectCurrentNailV7,
  selectCurrentStepV7,
  useEditorV7Store,
} from './store-v7';
export type {
  EditorV7ActionResult,
  EditorV7LoadResult,
  EditorV7RuntimeDependencies,
  EditorV7SaveState,
  EditorV7State,
} from './store-v7';
export { composeNailSvg, composeTiledSvg, svgToPngDataUrl } from './lib/render';
export { runRiskChecks } from './lib/risk';
export * from './lib/recipe-model';
export * from '../versioning';
export { compileRecipeToFingerRenderModel } from './lib/mercury-renderer';
export { createNailSurfaceMapper } from './lib/surface-mapper';
