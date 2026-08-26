import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = [
  'src/studio/editor/components/EditorShellV7.tsx',
  'src/studio/editor/components/EditorStageBarV7.tsx',
  'src/studio/editor/components/EditorToolRailV7.tsx',
  'src/studio/editor/components/EditorWorkspaceSidebarV7.tsx',
  'src/studio/editor/components/EditorWorkspaceIntentNoticeV7.tsx',
  'src/studio/editor/components/EditorGuidedStartV7.tsx',
  'src/studio/editor/components/TenFingerBarV7.tsx',
  'src/studio/editor/components/LayerPanelV7.tsx',
  'src/studio/editor/components/EditorCanvasHostV7.tsx',
  'src/studio/editor/components/V7StepToolGate.tsx',
  'src/app/pages/design/CustomerPreviewPageV7.tsx',
  'src/studio/editor/components/CustomerPreviewShellV7.tsx',
  'src/studio/editor/components/BackgroundPanelV7.tsx',
  'src/studio/editor/components/FlatVectorPanelV7.tsx',
  'src/studio/editor/components/DimensionalDecorationPanelV7.tsx',
  'src/studio/editor/components/FlatContentResourcesV7.tsx',
  'src/studio/editor/components/V7BackgroundCanvas.tsx',
  'src/studio/editor/components/V7SurfaceEffectCanvas.tsx',
  'src/studio/editor/components/V7FlatDesignCanvas.tsx',
  'src/studio/editor/components/V7DimensionalDecorationCanvas.tsx',
  'src/studio/editor/components/V7FinishCompositeCanvas.tsx',
  'src/studio/editor/components/FlatContentInspectorV7.tsx',
  'src/studio/editor/components/FlatContentArtworkV7.tsx',
  'src/studio/editor/components/EditorResourceDrawerV7.tsx',
  'src/studio/editor/components/EditorGeometryPanelV7.tsx',
  'src/studio/editor/components/FinishCompositePanelV7.tsx',
  'src/studio/editor/components/SurfaceEffectPanelV7.tsx',
  'src/studio/editor/components/CustomerNailPreviewV7.tsx',
  'src/studio/editor/components/FrenchEdgePopover.tsx',
  'src/studio/editor/components/BrandPalettePopover.tsx',
  'src/studio/editor/components/RiskScreen.tsx',
  'src/studio/editor/components/Nail3DCheck.tsx',
  'src/studio/editor/components/RecipeInspector.tsx',
  'src/studio/editor/components/FingerPanel.tsx',
  'src/studio/editor/components/LayerPanel.tsx',
  'src/studio/editor/components/TiledPreview.tsx',
];

// Only non-product identifiers may remain literal. Every user-facing word must resolve through t().
const allowlist = new Map([
  ['data-testid', 'stable automation selectors are not product copy'],
  ['data-debug-id', 'stable diagnostics identifiers are not product copy'],
  ['data-stage-id', 'stable stage identifiers are not product copy'],
  ['data-tool-id', 'stable tool identifiers are not product copy'],
  ['data-lane', 'stable workspace lane identifiers are not product copy'],
  ['data-testid-values', 'test selectors are not product copy'],
]);
const findings = [];
const meaningful = (value) => /[^\s]/.test(value) && !/^\s*[·/→›:：()（）.,，。!！?？-]+\s*$/.test(value);
const line = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
for (const relative of files) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) { findings.push(`${relative}: missing from audit batch`); continue; }
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isJsxText(node) && meaningful(node.getText(sf))) findings.push(`${relative}:${line(sf, node)}: JSX text literal`);
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.text;
      if (name.startsWith('data-')) return;
      if (['aria-label', 'title', 'placeholder', 'alt'].includes(name)) {
        const value = node.initializer;
        if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) findings.push(`${relative}:${line(sf, node)}: ${name} literal`);
      }
    }
    if (ts.isCallExpression(node) && /(?:toast|notify)\.(?:success|error|warning|info)$/.test(node.expression.getText(sf))) {
      const arg = node.arguments[0];
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) findings.push(`${relative}:${line(sf, node)}: toast literal`);
    }
    if (ts.isCallExpression(node) && (node.expression.getText(sf) === 'text' || /\.text$/.test(node.expression.getText(sf)))) {
      findings.push(`${relative}:${line(sf, node)}: compatibility text() call; use semantic t(key)`);
    }
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'fingerDisplayNameV7') {
      findings.push(`${relative}:${line(sf, node)}: legacy fingerDisplayNameV7 presentation helper; use fingerDisplayNameForLocaleV7(finger, locale)`);
    }
    if (ts.isElementAccessExpression(node) && node.expression.getText(sf) === 'FINGER_CONTENT_STATE_LABEL_V7') {
      findings.push(`${relative}:${line(sf, node)}: fixed-locale finger content state label; use fingerContentStateLabelForLocaleV7(state, locale)`);
    }
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
      for (const element of node.name.elements) {
        const boundName = element.name.getText(sf);
        const propertyName = element.propertyName?.getText(sf) ?? boundName;
        if (propertyName === 'text' || boundName === 'text') findings.push(`${relative}:${line(sf, node)}: destructured compatibility text; use semantic t`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
if (findings.length) {
  console.error(`Editor V7 i18n AST audit failed: ${findings.length} raw UI literals`);
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}
console.log(`Editor V7 i18n AST audit passed: ${files.length} files, 0 raw UI literals`);
console.log(`Allowlist: ${[...allowlist.entries()].map(([key, reason]) => `${key} (${reason})`).join('; ')}`);
