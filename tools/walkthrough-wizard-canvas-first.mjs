#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const baseURL = process.argv[2] ?? process.env.WIZARD_CANVAS_FIRST_URL ?? 'http://127.0.0.1:5200';
const evidenceDir = process.env.WIZARD_CANVAS_FIRST_EVIDENCE_DIR
  ? pathToFileURL(`${resolve(process.env.WIZARD_CANVAS_FIRST_EVIDENCE_DIR)}/`)
  : new URL('../evidence/design-v1-1-wizard-canvas-first/', import.meta.url);
const screenshotDir = new URL('screenshots/', evidenceDir);

const viewports = [
  {
    name: '1440', width: 1440, height: 900, layout: 'full', minPreviewWidth: 720, minPreviewHeight: 400,
    library: 'persistent', inspector: 'persistent', libraryRange: [272, 288], inspectorRange: [292, 308],
  },
  {
    name: '1366', width: 1366, height: 768, layout: 'compact', minPreviewWidth: 680, minPreviewHeight: 320,
    library: 'persistent', inspector: 'persistent', libraryRange: [208, 232], inspectorRange: [208, 232],
  },
  {
    name: '1280', width: 1280, height: 800, layout: 'compact', minPreviewWidth: 680, minPreviewHeight: 340,
    library: 'persistent', inspector: 'persistent', libraryRange: [208, 232], inspectorRange: [208, 232],
  },
  {
    name: '1024', width: 1024, height: 768, layout: 'focus', minPreviewWidth: 680, minPreviewHeight: 320,
    library: 'drawer', inspector: 'persistent', inspectorRange: [208, 232],
  },
  {
    name: '768', width: 768, height: 1024, layout: 'tablet', minPreviewWidth: 640, minPreviewHeight: 450,
    library: 'drawer', inspector: 'drawer', touch: true,
  },
  {
    name: '390', width: 390, height: 844, layout: 'tablet', minPreviewWidth: 300, minPreviewHeight: 280,
    library: 'drawer', inspector: 'drawer', touch: true,
  },
];
const collectAllFailures = process.env.WIZARD_CANVAS_FIRST_COLLECT === '1';

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

async function isVisible(locator) {
  return await locator.count() > 0 && await locator.first().isVisible();
}

async function waitForWorkspaceGeometryStable(page) {
  await page.evaluate(() => new Promise((resolve) => {
    let previous = null;
    let stableFrames = 0;
    let frame = 0;
    const sample = () => {
      const sidebar = document.querySelector('[data-debug-id="app.layout.sidebar"]');
      const preview = document.querySelector('[data-debug-id="studio.wizard.step2.preview"]');
      if (!sidebar || !preview) {
        window.requestAnimationFrame(sample);
        return;
      }
      const current = {
        sidebar: sidebar.getBoundingClientRect().width,
        preview: preview.getBoundingClientRect().width,
      };
      if (previous
        && Math.abs(current.sidebar - previous.sidebar) <= 0.1
        && Math.abs(current.preview - previous.preview) <= 0.1
        && Math.abs(current.sidebar - 56) <= 0.5) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
      previous = current;
      frame += 1;
      if (stableFrames >= 2 || frame > 180) resolve(undefined);
      else window.requestAnimationFrame(sample);
    };
    window.requestAnimationFrame(sample);
  }));
}

async function seedStepTwo(page) {
  await page.goto(`${baseURL}/studio/design/new?fresh=1`, { waitUntil: 'networkidle' });
  await page.locator('[data-debug-id="app.layout.topbar"]').waitFor();
  await page.evaluate(async () => {
    const { useWizardStore } = await import('/src/studio/wizard/wizard-store.ts');
    useWizardStore.setState({
      step: 2,
      pickerOpen: false,
      customer: null,
      viewMode: 'tiled',
      shape: 'almond',
      length: 'short',
      styleId: null,
      styleName: null,
      stylePrompted: true,
      appliedShape: 'almond',
      appliedLength: 'short',
      editingShapeLength: false,
      applying: false,
      applyError: null,
      presentNudge: false,
      templateId: null,
      templateName: null,
      baseColor: '#F5E0D3',
      finish: 'gloss',
      fingerOverrides: {},
      recipe: undefined,
      selectedFinger: null,
      status: 'draft',
      saveState: 'saved',
    });
  });
  await page.getByTestId('wizard-canvas-first').waitFor();
  await page.locator('[data-debug-id="studio.wizard.step2.preview"]').waitFor();
  // App navigation changes from the persisted 240px preference to the creative
  // workspace rail through a CSS width transition. Geometry is accepted only
  // after that transition settles, otherwise the transition is misattributed
  // to the first opened product overlay.
  await waitForWorkspaceGeometryStable(page);
}

async function assertDrawerLifecycle({ page, trigger, dialogName, touch, onOpen }) {
  assert.equal(await trigger.isVisible(), true, `${dialogName} trigger must be visible`);
  const widthBefore = await page.locator('[data-debug-id="studio.wizard.step2.preview"]').evaluate((element) => element.getBoundingClientRect().width);
  const geometryBefore = await page.evaluate(() => ({
    rootClientWidth: document.documentElement.clientWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
    rootClientHeight: document.documentElement.clientHeight,
    rootScrollHeight: document.documentElement.scrollHeight,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyOverflow: document.body.style.overflow,
    sidebarWidth: document.querySelector('[data-debug-id="app.layout.sidebar"]')?.getBoundingClientRect().width ?? null,
    shellWidth: document.querySelector('[data-testid="wizard-canvas-first"]')?.getBoundingClientRect().width ?? null,
    layout: document.querySelector('[data-testid="wizard-canvas-first"]')?.getAttribute('data-layout') ?? null,
  }));
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await dialog.waitFor();
  assert.equal(
    await page.locator('[role="dialog"]').count(),
    1,
    `${dialogName} must be the only mounted dialog`,
  );
  await page.waitForFunction((name) => {
    const element = document.querySelector(`[role="dialog"][aria-label="${name}"]`);
    return element instanceof HTMLElement && element.contains(document.activeElement);
  }, dialogName);

  const lifecycle = {
    initialFocusInside: await dialog.evaluate((element) => element.contains(document.activeElement)),
    trappedFocusInside: false,
    focusRestored: false,
    previewWidthBefore: widthBefore,
    previewWidthWhileOpen: 0,
    paramsPanelCountWhileOpen: 0,
    touchTargets: [],
  };

  lifecycle.paramsPanelCountWhileOpen = await page.locator('[data-debug-id="studio.wizard.step2.params-panel"]').count();
  assert.ok(lifecycle.paramsPanelCountWhileOpen <= 1, `${dialogName}: ParamsPanel must have at most one mounted instance`);
  if (onOpen) await onOpen(dialog, lifecycle);

  const focusableCount = await dialog.locator('button:not([disabled])').count();
  assert.ok(focusableCount > 0, `${dialogName} must contain a focusable control: ${await dialog.evaluate((element) => element.outerHTML.slice(0, 1000))}`);
  await dialog.getByRole('button').last().focus();
  await page.keyboard.press('Tab');
  lifecycle.trappedFocusInside = await dialog.evaluate((element) => element.contains(document.activeElement));
  lifecycle.previewWidthWhileOpen = await page.locator('[data-debug-id="studio.wizard.step2.preview"]').evaluate((element) => element.getBoundingClientRect().width);
  const geometryDebug = await page.evaluate(() => ({
    rootClientWidth: document.documentElement.clientWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
    rootClientHeight: document.documentElement.clientHeight,
    rootScrollHeight: document.documentElement.scrollHeight,
    bodyOverflow: document.body.style.overflow,
    sidebarWidth: document.querySelector('[data-debug-id="app.layout.sidebar"]')?.getBoundingClientRect().width ?? null,
    layout: document.querySelector('[data-testid="wizard-canvas-first"]')?.getAttribute('data-layout') ?? null,
  }));
  assert.ok(
    Math.abs(lifecycle.previewWidthWhileOpen - lifecycle.previewWidthBefore) <= 1,
    `${dialogName} must overlay instead of pushing the preview: ${JSON.stringify({ lifecycle, geometryBefore, geometryDebug })}`,
  );

  if (touch) {
    const close = dialog.getByRole('button', { name: /关闭/ }).first();
    lifecycle.touchTargets = await Promise.all([
      trigger.evaluate((element) => ({ label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '', height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width })),
      close.evaluate((element) => ({ label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '', height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width })),
    ]);
    for (const target of lifecycle.touchTargets) {
      assert.ok(target.height >= 43.5 && target.width >= 43.5, `${dialogName} touch target below 44px: ${JSON.stringify(target)}`);
    }
  }

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('[role="dialog"]').count(), 0, `${dialogName}: closed overlays must be removed from the DOM`);
  lifecycle.focusRestored = await trigger.evaluate((element) => document.activeElement === element);
  assert.equal(lifecycle.initialFocusInside, true, `${dialogName} must receive initial focus`);
  assert.equal(lifecycle.trappedFocusInside, true, `${dialogName} focus must remain trapped`);
  assert.equal(lifecycle.focusRestored, true, `${dialogName} must restore focus to its trigger`);
  return lifecycle;
}

async function assertNavigationOverlayLifecycle({ page, touch }) {
  const trigger = page.getByRole('button', { name: '展开导航' });
  const preview = page.locator('[data-debug-id="studio.wizard.step2.preview"]');
  const sidebar = page.locator('[data-debug-id="app.layout.sidebar"]');
  const lifecycle = {
    previewWidthBefore: await preview.evaluate((element) => element.getBoundingClientRect().width),
    previewWidthWhileOpen: 0,
    expandedWidth: 0,
    initialFocusInside: false,
    tabTrappedInside: false,
    shiftTabTrappedInside: false,
    focusRestored: false,
    triggerTarget: await trigger.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })),
  };
  if (touch) {
    assert.ok(
      lifecycle.triggerTarget.width >= 43.5 && lifecycle.triggerTarget.height >= 43.5,
      `Studio navigation trigger below 44px: ${JSON.stringify(lifecycle.triggerTarget)}`,
    );
  }

  await trigger.click();
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-debug-id="app.layout.sidebar"]');
    return element?.getAttribute('data-overlay-open') === 'true' && element.getBoundingClientRect().width >= 230;
  });
  const dialog = page.getByRole('dialog', { name: 'Studio 导航' });
  await dialog.waitFor();
  await page.waitForFunction(() => {
    const element = document.querySelector('[role="dialog"][aria-label="Studio 导航"]');
    return element instanceof HTMLElement && element.contains(document.activeElement);
  });
  lifecycle.initialFocusInside = await dialog.evaluate((element) => element.contains(document.activeElement));

  const focusables = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  const focusableCount = await focusables.count();
  assert.ok(focusableCount > 1, 'Studio navigation dialog must contain multiple focusable controls');
  await focusables.nth(focusableCount - 1).focus();
  await page.keyboard.press('Tab');
  lifecycle.tabTrappedInside = await dialog.evaluate((element) => element.contains(document.activeElement));
  await focusables.first().focus();
  await page.keyboard.press('Shift+Tab');
  lifecycle.shiftTabTrappedInside = await dialog.evaluate((element) => element.contains(document.activeElement));

  lifecycle.expandedWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
  lifecycle.previewWidthWhileOpen = await preview.evaluate((element) => element.getBoundingClientRect().width);
  assert.ok(Math.abs(lifecycle.previewWidthWhileOpen - lifecycle.previewWidthBefore) <= 1, 'expanded Studio navigation must overlay instead of pushing the preview');
  assert.equal(lifecycle.initialFocusInside, true, 'Studio navigation dialog must receive initial focus');
  assert.equal(lifecycle.tabTrappedInside, true, 'Studio navigation Tab must not escape the dialog');
  assert.equal(lifecycle.shiftTabTrappedInside, true, 'Studio navigation Shift+Tab must not escape the dialog');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-debug-id="app.layout.sidebar"]')?.getAttribute('data-overlay-open') === 'false');
  await waitForWorkspaceGeometryStable(page);
  assert.equal(await page.locator('[role="dialog"]').count(), 0, 'closed Studio navigation dialog must be removed from the accessibility tree');
  lifecycle.focusRestored = await trigger.evaluate((element) => document.activeElement === element);
  assert.equal(lifecycle.focusRestored, true, 'Studio navigation must restore focus after Escape');
  return lifecycle;
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch ?? false,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('nail-studio:session', JSON.stringify({
        v: 1,
        updatedAt: Date.now(),
        tabId: 'wizard-canvas-first-e2e',
        data: { storeName: 'Canvas First QA', userName: 'QA', email: 'qa@example.test' },
      }));
      // A stored expanded preference must not be allowed to crush the Wizard canvas.
      localStorage.setItem('nail-studio:ui.sidebar-collapsed', JSON.stringify({
        v: 1,
        updatedAt: Date.now(),
        tabId: 'wizard-canvas-first-e2e',
        data: { collapsed: false },
      }));
    });

    await seedStepTwo(page);
    const shell = page.getByTestId('wizard-canvas-first');
    assert.equal(await shell.getAttribute('data-layout'), viewport.layout, `${viewport.name}: responsive layout`);

    const metrics = await page.evaluate(() => {
      const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
      const byDebugId = (id) => document.querySelector(`[data-debug-id="${id}"]`);
      const rectOrNull = (element) => {
        if (!(element instanceof HTMLElement) || element.getClientRects().length === 0) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: Number(rect.x.toFixed(2)),
          y: Number(rect.y.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
        };
      };
      return {
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
          bodyClientWidth: document.body.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        },
        sidebar: rectOrNull(byDebugId('app.layout.sidebar')),
        wizard: rectOrNull(byTestId('wizard-canvas-first')),
        library: rectOrNull(byTestId('wizard-template-library')),
        preview: rectOrNull(byDebugId('studio.wizard.step2.preview')),
        inspector: rectOrNull(byTestId('wizard-inspector')),
        handoff: rectOrNull(byTestId('wizard-editor-handoff')),
      };
    });

    assert.ok(metrics.document.scrollWidth <= metrics.document.clientWidth + 1, `${viewport.name}: document overflow ${JSON.stringify(metrics.document)}`);
    assert.ok(metrics.document.bodyScrollWidth <= metrics.document.bodyClientWidth + 1, `${viewport.name}: body overflow ${JSON.stringify(metrics.document)}`);
    if (viewport.width >= 800) {
      assert.ok(metrics.document.scrollHeight <= metrics.document.clientHeight + 1, `${viewport.name}: desktop Wizard must not scroll at document level ${JSON.stringify(metrics.document)}`);
    }
    assert.ok(metrics.sidebar && metrics.sidebar.width <= 64, `${viewport.name}: Wizard must force the app navigation to a rail`);
    assert.ok(metrics.preview && metrics.preview.width >= viewport.minPreviewWidth, `${viewport.name}: preview ${metrics.preview?.width}px < ${viewport.minPreviewWidth}px`);
    assert.ok(metrics.preview && metrics.preview.height >= viewport.minPreviewHeight, `${viewport.name}: preview height ${metrics.preview?.height}px < ${viewport.minPreviewHeight}px`);
    assert.ok(metrics.handoff && metrics.preview, `${viewport.name}: Preview and Handoff geometry must be measurable`);
    if (viewport.touch) {
      assert.ok(metrics.handoff.y >= metrics.preview.y + metrics.preview.height - 1, `${viewport.name}: touch Handoff must follow without covering the Canvas ${JSON.stringify({ preview: metrics.preview, handoff: metrics.handoff })}`);
    } else {
      assert.ok(metrics.handoff.y >= metrics.preview.y + metrics.preview.height - 1, `${viewport.name}: desktop Handoff must remain below the Canvas ${JSON.stringify({ preview: metrics.preview, handoff: metrics.handoff })}`);
    }

    const library = page.getByTestId('wizard-template-library');
    const inspector = page.getByTestId('wizard-inspector');
    assert.equal(await page.locator('[role="dialog"]').count(), 0, `${viewport.name}: all product overlays must start unmounted`);
    const paramsPanel = page.locator('[data-debug-id="studio.wizard.step2.params-panel"]');
    assert.ok(await paramsPanel.count() <= 1, `${viewport.name}: closed overlays must not duplicate ParamsPanel`);
    assert.equal(await isVisible(library), viewport.library === 'persistent', `${viewport.name}: persistent library state`);
    assert.equal(await isVisible(inspector), viewport.inspector === 'persistent', `${viewport.name}: persistent inspector state`);
    if (viewport.libraryRange && metrics.library) {
      assert.ok(metrics.library.width >= viewport.libraryRange[0] && metrics.library.width <= viewport.libraryRange[1], `${viewport.name}: library width ${metrics.library.width}`);
    }
    if (viewport.inspectorRange && metrics.inspector) {
      assert.ok(metrics.inspector.width >= viewport.inspectorRange[0] && metrics.inspector.width <= viewport.inspectorRange[1], `${viewport.name}: inspector width ${metrics.inspector.width}`);
    }
    const persistentSideWidths = [metrics.library?.width, metrics.inspector?.width].filter((width) => typeof width === 'number');
    if (persistentSideWidths.length > 0) {
      assert.ok(metrics.preview.width > 2 * Math.max(...persistentSideWidths), `${viewport.name}: preview must be wider than both support panels ${JSON.stringify(metrics)}`);
    }

    if (viewport.inspector === 'persistent') {
      if (viewport.layout !== 'full') {
        await inspector.getByRole('tab', { name: '参数', exact: true }).click();
      }
      assert.equal(await paramsPanel.count(), 1, `${viewport.name}: docked Inspector must mount exactly one ParamsPanel`);
      assert.equal(await inspector.locator('[data-debug-id="studio.wizard.step2.params-panel"]').count(), 1, `${viewport.name}: the only ParamsPanel must belong to the docked Inspector`);
    } else {
      assert.equal(await paramsPanel.count(), 0, `${viewport.name}: closed Tablet Inspector must not mount ParamsPanel`);
    }

    const navigationLifecycle = await assertNavigationOverlayLifecycle({ page, touch: viewport.touch });

    const drawerLifecycle = {};
    const maxHandoffHeight = viewport.touch ? 84 : 72;
    const handoffHeightOk = (metrics.handoff?.height ?? Infinity) <= maxHandoffHeight;
    if (!collectAllFailures) {
      assert.ok(handoffHeightOk, `${viewport.name}: handoff ${metrics.handoff?.height}px > ${maxHandoffHeight}px`);
    }
    drawerLifecycle.preflight = await assertDrawerLifecycle({
      page,
      trigger: page.getByTestId('wizard-editor-v7-preflight-toggle'),
      dialogName: 'Editor V7 资产兼容详情',
      touch: viewport.touch,
    });

    if (viewport.library === 'drawer') {
      drawerLifecycle.library = await assertDrawerLifecycle({
        page,
        trigger: page.getByTestId('wizard-template-trigger'),
        dialogName: '官方模板',
        touch: viewport.touch,
      });
    } else {
      assert.equal(await isVisible(page.getByTestId('wizard-template-trigger')), false, `${viewport.name}: desktop library trigger hidden`);
    }

    if (viewport.inspector === 'drawer') {
      drawerLifecycle.inspector = await assertDrawerLifecycle({
        page,
        trigger: page.getByTestId('wizard-inspector-trigger'),
        dialogName: '参数与单指详情',
        touch: viewport.touch,
        onOpen: async (dialog, lifecycle) => {
          await dialog.getByRole('tab', { name: '参数', exact: true }).click();
          lifecycle.paramsPanelCountWhileOpen = await paramsPanel.count();
          assert.equal(lifecycle.paramsPanelCountWhileOpen, 1, `${viewport.name}: open Tablet Inspector must mount exactly one ParamsPanel`);
          assert.equal(await dialog.locator('[data-debug-id="studio.wizard.step2.params-panel"]').count(), 1, `${viewport.name}: Tablet ParamsPanel must live inside the open Inspector dialog`);
        },
      });
      assert.equal(await paramsPanel.count(), 0, `${viewport.name}: closing Tablet Inspector must unmount ParamsPanel`);
    } else {
      assert.equal(await isVisible(page.getByTestId('wizard-inspector-trigger')), false, `${viewport.name}: persistent inspector trigger hidden`);
    }

    assert.equal(await page.locator('[role="dialog"]').count(), 0, `${viewport.name}: no closed overlay may remain mounted`);
    assert.ok(await paramsPanel.count() <= 1, `${viewport.name}: final ParamsPanel instance count must remain canonical`);
    const mountMetrics = {
      closedDialogCount: await page.locator('[role="dialog"]').count(),
      finalParamsPanelCount: await paramsPanel.count(),
      inspectorParamsPanelCountWhileOpen: drawerLifecycle.inspector?.paramsPanelCountWhileOpen ?? null,
    };
    assert.deepEqual(pageErrors, [], `${viewport.name}: page errors`);
    assert.deepEqual(consoleErrors, [], `${viewport.name}: console errors`);

    await page.screenshot({
      path: fileURLToPath(new URL(`${viewport.name}-wizard-canvas-first.png`, screenshotDir)),
      fullPage: false,
    });
    report.push({ viewport, metrics, acceptance: { maxHandoffHeight, handoffHeightOk }, mountMetrics, navigationLifecycle, drawerLifecycle, consoleErrors, pageErrors });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(report, null, 2)}\n`);
if (collectAllFailures) {
  const failed = report.filter((item) => !item.acceptance.handoffHeightOk);
  assert.equal(failed.length, 0, `handoff height failed: ${JSON.stringify(failed.map((item) => ({ viewport: item.viewport.name, height: item.metrics.handoff?.height, max: item.acceptance.maxHandoffHeight })))}`);
}
console.log(`[wizard-canvas-first:e2e] ${report.length} responsive viewports passed`);
