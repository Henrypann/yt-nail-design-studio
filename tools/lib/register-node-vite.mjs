/**
 * Register the Node Vite-compat resolve hook, then run a target script.
 * Usage: node --import ./tools/lib/register-node-vite.mjs --experimental-strip-types <script>
 * Or: import this file first inside a generator that uses register() itself.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hookUrl = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'node-vite-hook.mjs'),
).href;

register(hookUrl);
