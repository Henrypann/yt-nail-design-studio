#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [stepTwo, overlay, appLayout] = await Promise.all([
  readFile(new URL('../src/studio/wizard/StepTwo.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/studio/wizard/WizardPanelOverlay.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/layouts/AppLayout.tsx', import.meta.url), 'utf8'),
]);

const contains = (source, pattern, message) => assert.ok(pattern.test(source), message);
const excludes = (source, pattern, message) => assert.ok(!pattern.test(source), message);

excludes(stepTwo, /lg:grid-cols-\[(?:180|240)px_minmax\(0,1fr\)_(?:260|300)px\]/, 'Wizard must not restore the legacy fixed three-column layout');

for (const testId of [
  'wizard-canvas-first',
  'wizard-template-library',
  'wizard-inspector',
  'wizard-template-trigger',
  'wizard-inspector-trigger',
  'wizard-editor-v7-preflight-toggle',
]) {
  contains(stepTwo, new RegExp(`data-testid=["']${testId}["']`), `${testId} is a stable acceptance hook`);
}

for (const layout of ['full', 'compact', 'focus', 'tablet']) {
  contains(stepTwo, new RegExp(`["']${layout}["']`), `Wizard defines the ${layout} layout mode`);
}

contains(overlay, /role=["']dialog["']/, 'compact panels use dialog semantics');
contains(overlay, /aria-modal/, 'compact panels expose modal semantics');
contains(stepTwo, /模板库/, 'template drawer has an accessible name');
contains(stepTwo, /参数与单指详情/, 'inspector drawer has an accessible name');
contains(stepTwo, /aria-expanded/, 'preflight disclosure reports expanded state');
contains(overlay, /Escape|keydown|onKeyDown/, 'drawers expose a keyboard close path');
contains(overlay, /inert/, 'drawers remove the background from keyboard navigation');
contains(overlay, /if \(!open\) return null/, 'closed overlays are unmounted instead of hidden');

contains(appLayout, /useLocation|location\.pathname/, 'App shell detects the Wizard route');
contains(appLayout, /studio\/design\/new|Routes\.designNew/, 'Wizard route participates in navigation rail policy');
contains(appLayout, /w-14/, 'Wizard can force the compact 56px navigation rail');
contains(appLayout, /role=\{workspaceNavOverlay \? ['"]dialog['"]/, 'expanded creative navigation has dialog semantics');
contains(appLayout, /aria-modal=\{workspaceNavOverlay/, 'expanded creative navigation is modal');
contains(appLayout, /setAttribute\(['"]inert['"]/, 'expanded creative navigation makes the workspace inert');
contains(appLayout, /trapWorkspaceNavFocus/, 'expanded creative navigation traps keyboard focus');

console.log('[wizard-canvas-first:contract] rail policy, four layouts, overlays and preflight disclosure: PASS');
