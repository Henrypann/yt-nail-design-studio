import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5211';
const evidenceDir = new URL('../evidence/pr-v7-11-ten-finger-operations/', import.meta.url);
const viewports = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 900 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1280', width: 1280, height: 900 },
  { name: '1440', width: 1440, height: 900 },
];

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/studio/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '创建空白画布' }).click();
  await page.locator('[data-editor-schema="7"]').waitFor();

  const finger = (code) => page.locator(`[data-testid="v7-ten-finger-bar"] button[data-finger="${code}"]`);
  await finger('L1').click();
  await page.getByRole('button', { name: '已选指', exact: true }).click();
  await finger('L1').click();
  await finger('L2').click();
  await finger('R2').click();
  let sheetFocusTrapped = true;
  let confirmationFocusTrapped = true;
  if (viewport.width < 1024) {
    await page.getByRole('button', { name: '打开跨指操作' }).click();
    const sheet = page.getByRole('dialog', { name: '跨指操作' });
    sheetFocusTrapped = await sheet.evaluate((node) => node.contains(document.activeElement));
    await page.keyboard.press('Shift+Tab');
    sheetFocusTrapped &&= await sheet.evaluate((node) => node.contains(document.activeElement));
    await page.keyboard.press('Tab');
    sheetFocusTrapped &&= await sheet.evaluate((node) => node.contains(document.activeElement));
    if (viewport.width === 390) await page.screenshot({ path: fileURLToPath(new URL('390-cross-finger-sheet.png', evidenceDir)), fullPage: false });
  }
  await page.getByRole('button', { name: '同步当前快照', exact: true }).click();
  const syncConfirmation = page.getByRole('alertdialog');
  confirmationFocusTrapped = await syncConfirmation.evaluate((node) => node.contains(document.activeElement));
  await page.keyboard.press('Shift+Tab');
  confirmationFocusTrapped &&= await syncConfirmation.evaluate((node) => node.contains(document.activeElement));
  await page.keyboard.press('Tab');
  confirmationFocusTrapped &&= await syncConfirmation.evaluate((node) => node.contains(document.activeElement));
  if (viewport.width === 390) await page.screenshot({ path: fileURLToPath(new URL('390-sync-confirmation.png', evidenceDir)), fullPage: false });
  await page.getByRole('button', { name: '确认执行', exact: true }).click();
  await page.locator('[data-sync-state="linked"]').first().waitFor();
  let closeFocusRestored = true;
  if (viewport.width < 1024) {
    const trigger = page.getByRole('button', { name: '打开跨指操作' });
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: '跨指操作' });
    if (await sheet.getByRole('button', { name: '同步当前快照', exact: true }).isDisabled()) throw new Error(`${viewport.name}: valid selected resync disabled`);
    await sheet.getByRole('button', { name: '关闭', exact: true }).click();
    closeFocusRestored = await trigger.evaluate((node) => document.activeElement === node);
  } else if (await page.getByRole('button', { name: '同步当前快照', exact: true }).isDisabled()) {
    throw new Error(`${viewport.name}: valid selected resync disabled`);
  }

  await page.getByRole('button', { name: '当前指', exact: true }).click();
  await finger('L1').click();
  await page.getByRole('button', { name: '对侧镜像', exact: true }).click();
  const mirrorStatus = await page.getByRole('status').filter({ hasText: '布局镜像' }).textContent();
  if (viewport.width < 1024) {
    const trigger = page.getByRole('button', { name: '打开跨指操作' });
    await trigger.click();
    await page.getByText('对侧镜像是一次性布局复制，不建立快照同步').waitFor();
    await page.getByRole('button', { name: '关闭跨指操作' }).click({ position: { x: 4, y: 4 } });
    closeFocusRestored &&= await trigger.evaluate((node) => document.activeElement === node);
    await trigger.click();
  }
  const syncDisabledInMirror = await page.getByRole('button', { name: '同步当前快照', exact: true }).isDisabled();
  await page.getByRole('button', { name: '复制一次', exact: true }).click();
  await page.getByRole('button', { name: '确认执行', exact: true }).click();
  await page.locator('button[data-sync-state="detached"]').first().waitFor();
  let detachAffectedDisclosure = true;
  if (viewport.width === 390) {
    await page.getByRole('button', { name: '打开跨指操作' }).click();
    await page.getByRole('button', { name: '解除同步', exact: true }).click();
    const detachDialog = page.getByRole('alertdialog');
    detachAffectedDisclosure = (await detachDialog.textContent())?.includes('将解除 L1 的快照同步关系') ?? false;
    await page.screenshot({ path: fileURLToPath(new URL('390-detach-confirmation.png', evidenceDir)), fullPage: false });
    await detachDialog.getByRole('button', { name: '取消', exact: true }).click();
  }

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector('[data-editor-schema="7"]');
    const bar = document.querySelector('[data-testid="v7-ten-finger-bar"]');
    const buttons = [...(bar?.querySelectorAll('button') ?? [])];
    return {
      layout: shell?.getAttribute('data-layout'),
      bodyClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      barWidth: bar?.getBoundingClientRect().width ?? 0,
      minTouchTarget: Math.min(...buttons.filter((button) => button.offsetParent !== null).map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))),
      currentFinger: bar?.querySelector('[data-current="true"]')?.textContent?.trim() ?? null,
      selectedFingers: [...(bar?.querySelectorAll('[data-selected="true"]') ?? [])].map((node) => node.textContent?.trim()),
      linkedCount: bar?.querySelectorAll('[data-sync-state="linked"]').length ?? 0,
      detachedCount: bar?.querySelectorAll('[data-sync-state="detached"]').length ?? 0,
    };
  });
  if (metrics.bodyScrollWidth > metrics.bodyClientWidth + 1) throw new Error(`${viewport.name}: document overflow`);
  if (metrics.minTouchTarget < 43.5) throw new Error(`${viewport.name}: touch target ${metrics.minTouchTarget}`);
  if (!syncDisabledInMirror) throw new Error(`${viewport.name}: mirror sync must be disabled`);
  if (!closeFocusRestored) throw new Error(`${viewport.name}: sheet close did not restore trigger focus`);
  if (!sheetFocusTrapped || !confirmationFocusTrapped) throw new Error(`${viewport.name}: dialog focus escaped`);
  if (!detachAffectedDisclosure) throw new Error(`${viewport.name}: detach affected fingers not disclosed`);
  if (!mirrorStatus?.includes('文字与素材本体保持正向')) throw new Error(`${viewport.name}: mirror fidelity disclosure missing`);
  if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ pageErrors, consoleErrors })}`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-ten-finger.png`, evidenceDir)), fullPage: false });
  reports.push({ viewport, metrics, syncDisabledInMirror, mirrorStatus, sheetFocusTrapped, confirmationFocusTrapped, closeFocusRestored, detachAffectedDisclosure, consoleErrors, pageErrors });
  await context.close();
}

await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-ten-finger-walkthrough] ${reports.length} viewports passed`);
