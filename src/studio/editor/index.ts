/**
 * Editor 模块（模块 4）对外出口。
 * 页面入口：src/app/pages/design/EditorPage.tsx（/design/canvas）。
 * 桥接入口：@/studio/bridge 的 openBridge(designId)。
 */

export { EditorShell } from './components/EditorShell';
export { useEditorStore } from './store';
export * from './lib/model';
export {
  createBlankEditorDesign,
  getEditorDoc,
  saveEditorDoc,
  removeEditorDoc,
  duplicateEditorDoc,
} from './lib/repo';
export { composeNailSvg, composeTiledSvg, svgToPngDataUrl } from './lib/render';
export { runRiskChecks } from './lib/risk';
export * from './lib/recipe-model';
export { compileRecipeToFingerRenderModel } from './lib/mercury-renderer';
export { createNailSurfaceMapper } from './lib/surface-mapper';
