#!/usr/bin/env node
/**
 * S-UI-PLACE: 生产 Job 占位页。
 * HardwareRegistrationGate 不得挡住 Studio / Look；无 submitDesign / ManufacturingPackage runner / WebBluetooth。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const gateSource = fs.readFileSync(new URL('../src/app/guards/HardwareRegistrationGate.tsx', import.meta.url), 'utf8');
const jobsSource = fs.readFileSync(new URL('../src/app/pages/jobs/JobsPlaceholderPage.tsx', import.meta.url), 'utf8');
const layoutSource = fs.readFileSync(new URL('../src/app/layouts/AppLayout.tsx', import.meta.url), 'utf8');
const routesSource = fs.readFileSync(new URL('../src/app/routes.ts', import.meta.url), 'utf8');

assert.equal(routesSource.includes("jobs: '/studio/jobs'"), true);

const jobsRouteIndex = appSource.indexOf('path={Routes.jobs}');
const lookRouteIndex = appSource.indexOf('path={Routes.communityLookPath}');
const confirmedRouteIndex = appSource.indexOf('path={Routes.designConfirmed}');
const gateIndex = appSource.indexOf('<Route element={<HardwareRegistrationGate />}');
assert.ok(jobsRouteIndex > 0 && gateIndex > jobsRouteIndex, 'jobs placeholder stays outside HardwareRegistrationGate');
assert.ok(lookRouteIndex > 0 && lookRouteIndex < gateIndex, 'Community Look stays outside HardwareRegistrationGate');
assert.ok(confirmedRouteIndex > 0 && confirmedRouteIndex < gateIndex, 'confirmed DesignVersion stays outside HardwareRegistrationGate');

const gateChildren = appSource.slice(gateIndex, gateIndex + 700);
assert.equal(gateChildren.includes('Routes.jobs'), false);
assert.equal(gateChildren.includes('Routes.designConfirmed'), false);
assert.equal(gateChildren.includes('communityLookPath'), false);
assert.equal(gateChildren.includes('Routes.dashboard'), true);
assert.equal(gateChildren.includes('Routes.devices'), true);

assert.equal(gateSource.includes('state.devices.length'), true);
assert.equal(gateSource.includes('activationState'), false, 'gate still does not read activation/firmware fields');

assert.equal(jobsSource.includes('submitDesign'), false);
assert.equal(/from ['"][^'"]*state-machine['"]/.test(jobsSource), false);
assert.equal(/ManufacturingPackage/.test(jobsSource), false);
assert.equal(jobsSource.includes('WebBluetooth'), false);
assert.equal(jobsSource.includes('jobs.waitingForPrototypes'), true);
assert.equal(jobsSource.includes('disabled'), true);

assert.equal(layoutSource.includes('Routes.jobs'), true);
assert.equal(layoutSource.includes('hasRegisteredHardware'), true);
assert.match(layoutSource, /to: Routes\.jobs/);

const bindWizard = fs.readFileSync(new URL('../src/platform/devices/BindWizard.tsx', import.meta.url), 'utf8');
assert.ok(bindWizard.length > 0, 'bind wizard remains in tree; this PR must not rewrite it');

console.log('[S-UI-PLACE] jobs placeholder + HardwareRegistrationGate software surfaces: PASS');
