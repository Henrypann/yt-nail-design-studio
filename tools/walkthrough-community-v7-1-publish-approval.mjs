import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5238';
const browser = await chromium.launch({ headless: true });
const results = [];
console.log('[community-v7.1-publish-approval:e2e] browser launched');

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  console.log(`[community-v7.1-publish-approval:e2e] start ${viewport.width}`);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/creator`);
  await page.getByRole('button', { name: /新建发布|New publication/ }).click();
  await page.getByTestId('creator-publish-wizard').waitFor();
  await page.getByLabel(/作品标题|Title/).fill(`Publish acceptance ${viewport.width}`);
  // COMM-v0.7.2-TAX-02: the metadata step cannot advance until structured
  // discovery is complete (>=1 overall style, >=1 recommended shape,
  // non-PENDING rights) — taxonomy options carry the shared fixture labels.
  if (!(await page.getByRole('button', { name: /下一步：可见性|Next: visibility/ }).isDisabled())) throw new Error('Next: visibility must stay disabled until structured discovery is complete');
  // COMM-v0.7.2-TAX-02: structured discovery options must be >= 44x44 CSS px
  // touch/pointer targets (WCAG 2.5.8) at every viewport.
  for (const testId of ['taxonomy-option-style:minimal-clean', 'taxonomy-option-shape:almond', 'taxonomy-option-rights:original']) {
    const box = await page.getByTestId(testId).boundingBox();
    if (!box) throw new Error(`taxonomy option ${testId} missing or hidden at ${viewport.width}`);
    if (box.width < 44 || box.height < 44) throw new Error(`taxonomy option ${testId} target too small ${JSON.stringify(box)} at ${viewport.width} (need >= 44x44)`);
    console.log(`[community-v7.1-publish-approval:e2e] taxonomy target ${testId} ${Math.round(box.width)}x${Math.round(box.height)} @ ${viewport.width}`);
  }
  await page.getByTestId('taxonomy-option-style:minimal-clean').click();
  await page.getByTestId('taxonomy-option-shape:almond').click();
  await page.getByTestId('taxonomy-option-rights:original').click();
  await page.getByTestId('discovery-validation-summary').waitFor();
  await page.getByRole('button', { name: /下一步：可见性|Next: visibility/ }).click();
  const publicChoice = page.getByRole('button', { name: /PUBLIC/ });
  if (!(await publicChoice.isDisabled())) throw new Error('PUBLIC must remain disabled before exact-revision clearance');
  await page.getByRole('button', { name: /下一步：来源|Next: source/ }).click();
  await page.getByText(/我确认拥有发布|I have the right/).click();
  await page.getByText(/来源类型与说明真实完整|Source type/).click();
  await page.getByRole('button', { name: /提交当前修订审核|Submit this revision/ }).click();
  await page.getByText(/PUBLIC review · PENDING/).waitFor();
  console.log(`[community-v7.1-publish-approval:e2e] review submitted ${viewport.width}`);

  await page.goto(`${baseUrl}/creator/governance`);
  await page.getByTestId('governance-workspace-page').waitFor();
  await page.getByRole('button', { name: /通过|Clear/ }).click();
  await page.getByText(/PUBLICATION_CLEARED/).waitFor();
  console.log(`[community-v7.1-publish-approval:e2e] review cleared ${viewport.width}`);

  await page.goto(`${baseUrl}/creator`);
  await page.getByRole('button', { name: new RegExp(`Publish acceptance ${viewport.width}`) }).click();
  const nextSource = page.getByRole('button', { name: /下一步：来源|Next: source/ });
  if (await nextSource.count()) await nextSource.click();
  await page.getByText(/PUBLIC review · CLEARED/).waitFor();
  await page.getByRole('button', { name: /上一步|Back/ }).click();
  if (await page.getByRole('button', { name: /PUBLIC/ }).isDisabled()) throw new Error('PUBLIC must unlock after exact-revision clearance');
  await page.getByRole('button', { name: /上一步|Back/ }).click();
  await page.getByLabel(/作品标题|Title/).fill(`Publish acceptance revised ${viewport.width}`);
  await page.getByRole('button', { name: /下一步：可见性|Next: visibility/ }).click();
  if (!(await page.getByRole('button', { name: /PUBLIC/ }).isDisabled())) throw new Error('metadata edit must invalidate old clearance');

  const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (metrics.scrollWidth > metrics.width + 1) throw new Error(`horizontal overflow ${JSON.stringify(metrics)}`);
  if (consoleErrors.length || pageErrors.length) throw new Error(`runtime errors ${JSON.stringify({ consoleErrors, pageErrors })}`);
  results.push({ viewport, exactRevisionClearance: true, revisionInvalidation: true, noOverflow: true, consoleErrors, pageErrors });
  console.log(`[community-v7.1-publish-approval:e2e] completed ${viewport.width}`);
  await context.close();
}

console.log(`[community-v7.1-publish-approval:e2e] PASS ${JSON.stringify(results)}`);
await browser.close();
