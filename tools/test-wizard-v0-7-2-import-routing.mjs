#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const importPage = read('src/app/pages/design/VersionedImportPage.tsx');
const wizard = read('src/app/pages/design/WizardPage.tsx');
const app = read('src/app/App.tsx');
const routes = read('src/app/routes.ts');
const runtime = read('src/integration/community-studio/versioned-use-runtime.ts');
const legacyRuntime = read('src/studio/wizard/consume-community-intent.ts');

assert.match(routes, /designImport:\s*['"]\/studio\/design\/import['"]/);
assert.match(app, /function DesignNewRoute\(\)/);
assert.match(app, /params\.has\(['"]versionedIntent['"]\)[\s\S]*Routes\.designImport/);
assert.match(app, /Routes\.designImport[\s\S]*VersionedImportPage/);
assert.doesNotMatch(app, /import WizardPage from/);
assert.doesNotMatch(importPage, /from ['"][^'"]*(wizard-store|wizard-draft)[^'"]*['"]/);
assert.doesNotMatch(importPage, /useWizardStore\s*\(/);
assert.doesNotMatch(wizard, /versionedIntentPortV2|consumeVersionedUseIntentV2|versioned-intent-/);
assert.match(importPage, /versioned-import-page/);
assert.match(importPage, /lookId/);
assert.match(importPage, /designVersionId/);
assert.match(importPage, /assetRevisionRefs/);
assert.match(importPage, /versionedIntentPortV2\.peek[\s\S]*catch/);
assert.match(importPage, /sourceCreatorProfileId/);
assert.match(importPage, /versionedIntentPortV2\.clear\(intentId\)/);
assert.match(importPage, /dismissFailureAndReturn/);
assert.match(importPage, /const creator = ready\?\.intent\.sourceCreatorProfileId/);
assert.match(importPage, /source_mismatch/);
assert.match(importPage, /t\('wizard\.applyCurrent'\)/);
assert.match(importPage, /t\('versioned\.createNewEditor'\)/);
assert.match(importPage, /t\('versioned\.backCommunity'\)/);
assert.match(importPage, /hasTrustedVersionedImportRuntime/);
assert.match(importPage, /disabled=\{pending \|\| !trustedImportRuntime\}/);
assert.match(importPage, /sanitizeReturnTo/);
assert.match(runtime, /Routes\.designImport/);
assert.doesNotMatch(runtime, /Routes\.designNew\}\?\$\{query/);

// The redirect is outside WizardPage's element. This is the important writer
// boundary: redirecting a legacy canonical link cannot run recovery effects.
const redirectIndex = app.indexOf('function DesignNewRoute');
const wizardElementIndex = app.indexOf('return <Suspense', redirectIndex);
assert.ok(redirectIndex >= 0 && wizardElementIndex > redirectIndex);
assert.match(app.slice(redirectIndex, wizardElementIndex), /<Navigate replace to=\{`\$\{Routes\.designImport\}/);
assert.match(wizard, /wizard-legacy-source/);
assert.match(wizard, /t\('wizard\.legacyApproximate'\)/);
assert.match(wizard, /sourceTemplateId/);
assert.match(wizard, /assetVersion/);
assert.match(wizard, /applicationLevel/);
assert.match(legacyRuntime, /applyTemplate:\s*\(template, options\)[\s\S]*applyTemplate\(template, options\)/);

console.log('[test:wizard-v0-7-2-import-routing] PASS');
