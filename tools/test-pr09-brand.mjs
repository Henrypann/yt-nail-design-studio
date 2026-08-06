/**
 * PR-09 self-test: brand name consistency.
 */

import { strict as assert } from 'node:assert';

const brandMod = await import('../src/lib/brand.ts');
const { BRAND_NAME, BRAND_NAME_ZH, BRAND_SHORT_NAME, BRAND_TAGLINE, getBrandName } = brandMod;

{
  // Names are non-empty strings
  assert.ok(BRAND_NAME.length > 0);
  assert.ok(BRAND_NAME_ZH.length > 0);
  assert.ok(BRAND_SHORT_NAME.length > 0);
  assert.ok(BRAND_TAGLINE.length > 0);

  // Locale resolution
  assert.equal(getBrandName('en'), BRAND_NAME);
  assert.equal(getBrandName('zh'), BRAND_NAME_ZH);
  assert.equal(getBrandName(), BRAND_NAME_ZH); // default is zh

  // No forbidden characters in brand name (no slashes, no storage key chars)
  assert.ok(!BRAND_NAME.includes('/'));
  assert.ok(!BRAND_NAME.includes(':'));

  console.log('[test:brand] PASS');
}

console.log('\ntest-pr09-brand-rename: all assertions passed');
