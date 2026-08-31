#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  LegacyRoutes,
  Routes,
  designNewFresh,
  legacyCommunityPathTarget,
  legacyStudioPathTarget,
} from '../src/app/routes.ts';
import {
  ProductSurfaces,
  canUseLocalStudioHandoff,
  communityProductHref,
  studioProductHref,
} from '../src/app/product-navigation.ts';

assert.equal(Routes.community, '/');
assert.equal(Routes.communityLook('look-1'), '/look/look-1');
assert.equal(Routes.studioHome, '/studio');
assert.equal(Routes.dashboard, '/studio/customers/dashboard');
assert.equal(Routes.designs, '/studio/design');
assert.equal(designNewFresh(), '/studio/design/new?fresh=1');
assert.ok(Object.values(Routes).filter((value) => typeof value === 'string' && value.startsWith('/studio')).length >= 8);

assert.equal(ProductSurfaces.community.id, 'nail-lover-community');
assert.equal(ProductSurfaces.studio.id, 'nail-design-studio');
assert.equal(communityProductHref('/look/x', {}), '/look/x');
assert.equal(studioProductHref('/studio/design/new?fresh=1', {}), '/studio/design/new?fresh=1');

const splitOrigins = {
  VITE_COMMUNITY_ORIGIN: 'https://community.example.test/app/ignored',
  VITE_STUDIO_ORIGIN: 'https://studio.example.test/base/ignored',
};
assert.equal(communityProductHref('/', splitOrigins), 'https://community.example.test/');
assert.equal(communityProductHref('/look/x?from=studio', splitOrigins), 'https://community.example.test/look/x?from=studio');
assert.equal(studioProductHref('/studio', splitOrigins), 'https://studio.example.test/');
assert.equal(studioProductHref('/studio/design/new?fresh=1', splitOrigins), 'https://studio.example.test/design/new?fresh=1');
assert.equal(studioProductHref('/look/not-studio', splitOrigins), 'https://studio.example.test/');
assert.equal(canUseLocalStudioHandoff('https://community.example.test', {}), true);
assert.equal(canUseLocalStudioHandoff('https://studio.example.test', splitOrigins), true);
assert.equal(canUseLocalStudioHandoff('https://community.example.test', splitOrigins), false);

assert.equal(legacyCommunityPathTarget(LegacyRoutes.communityRoot), '/');
assert.equal(legacyCommunityPathTarget('/community/look/x'), '/look/x');
assert.equal(legacyStudioPathTarget('/design/canvas'), '/studio/design/canvas');
assert.equal(legacyStudioPathTarget('/customers/c-1'), '/studio/customers/c-1');
assert.equal(legacyStudioPathTarget('/devices/bind'), '/studio/devices/bind');

const app = fs.readFileSync('src/app/App.tsx', 'utf8');
assert.match(app, /CommunityLayout[\s\S]*Routes\.community/);
assert.match(app, /StudioLayout[\s\S]*Routes\.studioHome/);
assert.match(app, /Routes\.deviceBind[\s\S]*HardwareRegistrationGate[\s\S]*Routes\.dashboard/);
assert.match(app, /HardwareRegistrationGate[\s\S]*Routes\.devices/);
assert.match(app, /LegacyProductPathRedirect/);

const studioNavigation = fs.readFileSync('src/app/layouts/AppLayout.tsx', 'utf8');
assert.match(studioNavigation, /hasRegisteredHardware/);
assert.match(studioNavigation, /key: 'studio'[\s\S]*Studio Home/);
assert.match(studioNavigation, /key: 'devices'[\s\S]*Routes\.deviceBind/);
assert.match(studioNavigation, /hasRegisteredHardware[\s\S]*Routes\.devices/);
assert.match(studioNavigation, /hasRegisteredHardware[\s\S]*key: 'customers'/);

const hardwareGate = fs.readFileSync('src/app/guards/HardwareRegistrationGate.tsx', 'utf8');
assert.match(hardwareGate, /devices\.length > 0/);
assert.match(hardwareGate, /Navigate to=\{Routes\.studio\} replace/);

const communityLayout = fs.readFileSync('src/app/layouts/CommunityLayout.tsx', 'utf8');
assert.match(communityLayout, /app\.nailLoverCommunity/);
assert.match(communityLayout, /href=\{studioHref\}/);
assert.match(communityLayout, /CrossProductLink/);
assert.doesNotMatch(communityLayout, /navigate\(studioReturn/);

const crossProductLink = fs.readFileSync('src/app/CrossProductLink.tsx', 'utf8');
assert.match(crossProductLink, /target="_blank"/);
assert.match(crossProductLink, /rel="noopener noreferrer"/);
assert.match(crossProductLink, /event\.currentTarget\.href = result\.href/);

const communityLook = fs.readFileSync('src/community/pages/CommunityLookPage.tsx', 'utf8');
assert.match(communityLook, /canUseLocalStudioHandoff\(window\.location\.origin\)/);
assert.match(communityLook, /community\.crossOriginImportUnavailable/);
assert.doesNotMatch(communityLook, /window\.location\.assign/);

for (const path of [
  'src/app/layouts/AppLayout.tsx',
  'src/app/pages/StudioHomePage.tsx',
  'src/app/pages/DashboardPage.tsx',
  'src/studio/editor/components/EditorTopBar.tsx',
  'src/studio/editor/components/EditorShellV7.tsx',
]) {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /CrossProductLink/, `${path} uses the shared product boundary`);
}

console.log('[product-surfaces] Community home + isolated Studio namespace/origin boundary: PASS');
