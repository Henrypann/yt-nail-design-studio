#!/usr/bin/env node
/**
 * Shared Modal contract: opaque overlay from first paint, background inert,
 * focus trap. Community Look confirm consumes this component.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [modal, lookPage] = await Promise.all([
  readFile(new URL('../src/design-system/components/Modal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/community/pages/CommunityLookPage.tsx', import.meta.url), 'utf8'),
]);

const contains = (source, pattern, message) => assert.ok(pattern.test(source), message);
const excludes = (source, pattern, message) => assert.ok(!pattern.test(source), message);

excludes(modal, /animate-fade-in/, 'overlay must not fade from opacity 0 with the dialog');
contains(modal, /isolate/, 'overlay creates an isolated stacking context above page content');
contains(modal, /data-testid=["']modal-scrim["']/, 'scrim is a stable overlay hook');
contains(modal, /absolute inset-0 bg-black\/30/, 'scrim is full-viewport and painted without opacity animation');
contains(modal, /relative z-10[\s\S]*animate-modal-in/, 'only the dialog panel uses the 200ms modal-in motion');
contains(modal, /role=["']dialog["']/, 'dialog semantics live on the panel, not the fading wrapper');
contains(modal, /aria-modal=["']true["']/, 'dialog is modal');
contains(modal, /setAttribute\(['"]inert['"]/, 'open modal marks background siblings inert');
contains(modal, /setAttribute\(['"]aria-hidden['"]/, 'open modal removes background siblings from the a11y tree');
contains(modal, /e\.key !== 'Tab'/, 'Tab is trapped inside the dialog');
contains(modal, /previousFocusRef/, 'closing restores the trigger focus');
contains(modal, /if \(!open\) return null/, 'closed modal is unmounted');

contains(lookPage, /testId=["']community-confirm-look-dialog["']/, 'Look confirm uses a stable dialog hook');
contains(lookPage, /confirmCanonicalLookAsDesignVersionV1/, 'Look confirm still pins DesignVersion identity');
excludes(lookPage, /Routes\.jobs|bindWithCable|HardwareRegistrationGate/, 'Look confirm must not open Job plane or bind/hardware');

console.log('[design-system-modal:contract] opaque overlay, inert background, focus trap: PASS');
