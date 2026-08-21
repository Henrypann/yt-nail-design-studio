/**
 * FRENCH-02 exact geometry adapter.
 *
 * Resolves GeometryRefV7 through the existing registry and converts a signed
 * product silhouette into canonical canvas/viewBox-local nail-local-v1
 * coordinates. Shape and length come only from the registry entry. This module
 * never infers them from assetId, never renormalizes to contour extrema, and
 * never claims manufacturing validity.
 */

import { FINGER_CODES, type FingerCode, type NailLength, type NailShape } from '../../../lib/types.ts';
import {
  isDrawableNailPathDataV7,
  parseNailPathDataV7,
  serializeNailPathDataV7,
  type ParsedNailPathV7,
} from './flat-vector.ts';
import {
  resolveEditorGeometryV7,
  type GeometryUnavailableReasonV7,
} from './geometry-registry.ts';
import type { GeometryRefV7 } from './model.ts';

export const FRENCH_GEOMETRY_COORDINATE_SPACE_V1 = 'nail-local-v1';
export const FRENCH_SIGNED_SHAPES_V1 = ['almond', 'oval', 'coffin'] as const;
export const FRENCH_SIGNED_LENGTHS_V1 = ['short', 'medium', 'long', 'extra-long'] as const;
export const FRENCH_GOLDEN_FINGER_V1 = 'L1' as const;

/** Frozen exact-key set of a runtime `FrenchExactGeometryV1` object. Unknown keys fail closed. */
export const FRENCH_EXACT_GEOMETRY_KEYS_V1 = [
  'coordinateSpace',
  'finger',
  'assetId',
  'revision',
  'shape',
  'length',
  'registryAssetSetSha256',
  'contourPathData',
  'contourIdentity',
  'viewBox',
  'canvasCenterU',
  'fidelity',
  'evidence',
  'manufacturingValidated',
] as const;

export const FRENCH_VIEWBOX_KEYS_V1 = ['x', 'y', 'width', 'height'] as const;

const FINGER_SET = new Set<string>(FINGER_CODES);
const FULL_SHA256 = /^[0-9a-f]{64}$/;
const PATH_TOKEN = /[MLCQHVZASTmlcqhvzast]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const PATH_ALLOWED = /^[\s,MLCQHVZASTmlcqhvzast0-9eE.+-]+$/;
const ABSOLUTE_ARITY: Record<string, number> = { M: 2, L: 2, Q: 4, C: 6, H: 1, V: 1, Z: 0 };
const RELATIVE_COMMANDS = new Set(['m', 'l', 'c', 'q', 'h', 'v', 'z', 'a', 's', 't']);
const UNSUPPORTED_ABSOLUTE = new Set(['A', 'S', 'T']);

export type FrenchSignedShapeV1 = (typeof FRENCH_SIGNED_SHAPES_V1)[number];
export type FrenchSignedLengthV1 = (typeof FRENCH_SIGNED_LENGTHS_V1)[number];

export type FrenchGeometryUnavailableReasonV1 =
  | 'unknown_asset'
  | 'revision_drift'
  | 'wrong_finger'
  | 'wrong_sha'
  | 'generated'
  | 'placeholder'
  | 'fallback'
  | 'malformed_path'
  | 'relative_path'
  | 'unsupported_command'
  | 'open_path'
  | 'non_drawable_path'
  | 'viewbox_invalid'
  | 'coordinates_out_of_range';

export interface FrenchGeometryDiagnosticV1 {
  code: FrenchGeometryUnavailableReasonV1;
  path: string;
  message: string;
}

export interface FrenchViewBoxV1 {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrenchExactGeometryV1 {
  coordinateSpace: typeof FRENCH_GEOMETRY_COORDINATE_SPACE_V1;
  finger: FingerCode;
  assetId: string;
  revision: string;
  shape: NailShape;
  length: NailLength;
  registryAssetSetSha256: string;
  contourPathData: string;
  contourIdentity: string;
  viewBox: FrenchViewBoxV1;
  /** Canvas/viewBox-local u of SVG x = 0 (nail-root-center origin). */
  canvasCenterU: number;
  fidelity: 'exact';
  evidence: 'signed_off';
  manufacturingValidated: false;
}

export type FrenchGeometryInputResultV1 =
  | { ok: true; geometry: FrenchExactGeometryV1 }
  | {
      ok: false;
      fidelity: 'unavailable';
      reason: FrenchGeometryUnavailableReasonV1;
      diagnostics: FrenchGeometryDiagnosticV1[];
      manufacturingValidated: false;
    };

export type FrenchSilhouetteCanonicalizeResultV1 =
  | {
      ok: true;
      pathData: string;
      contourIdentity: string;
      viewBox: FrenchViewBoxV1;
      canvasCenterU: number;
    }
  | { ok: false; reason: FrenchGeometryUnavailableReasonV1; diagnostics: FrenchGeometryDiagnosticV1[] };

function fail(
  reason: FrenchGeometryUnavailableReasonV1,
  path: string,
  message: string,
): Extract<FrenchGeometryInputResultV1, { ok: false }> {
  return {
    ok: false,
    fidelity: 'unavailable',
    reason,
    diagnostics: [{ code: reason, path, message }],
    manufacturingValidated: false,
  };
}

function canonicalizeFail(
  reason: FrenchGeometryUnavailableReasonV1,
  path: string,
  message: string,
): Extract<FrenchSilhouetteCanonicalizeResultV1, { ok: false }> {
  return { ok: false, reason, diagnostics: [{ code: reason, path, message }] };
}

export function parseSilhouetteViewBoxV1(viewBox: string): FrenchViewBoxV1 | null {
  if (typeof viewBox !== 'string') return null;
  const parts = viewBox.trim().split(/[\s,]+/);
  if (parts.length !== 4) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const width = Number(parts[2]);
  const height = Number(parts[3]);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function isCommandToken(token: string): boolean {
  return token.length === 1 && /[MLCQHVZASTmlcqhvzast]/.test(token);
}

function readNumbers(tokens: string[], index: number, count: number): { values: number[]; next: number } | null {
  const values: number[] = [];
  let cursor = index;
  for (let offset = 0; offset < count; offset += 1) {
    const token = tokens[cursor];
    if (token === undefined || isCommandToken(token)) return null;
    const value = Number(token);
    if (!Number.isFinite(value)) return null;
    values.push(value);
    cursor += 1;
  }
  return { values, next: cursor };
}

/**
 * Strict absolute SVG subset: M/C/Q/L/Z plus H/V converted to L.
 * Relative commands, A/S/T, malformed tokens, and open paths fail closed.
 */
export function canonicalizeSilhouetteToNailLocalV1(
  viewBox: string,
  pathD: string,
): FrenchSilhouetteCanonicalizeResultV1 {
  const box = parseSilhouetteViewBoxV1(viewBox);
  if (!box) return canonicalizeFail('viewbox_invalid', 'viewBox', 'silhouette viewBox must be four finite numbers with positive size');
  if (typeof pathD !== 'string' || pathD.trim().length === 0 || pathD.length > 100_000) {
    return canonicalizeFail('malformed_path', 'pathD', 'silhouette path is missing or too large');
  }
  const input = pathD.trim();
  if (!PATH_ALLOWED.test(input)) {
    return canonicalizeFail('malformed_path', 'pathD', 'silhouette path contains unsupported characters');
  }
  const tokens = input.match(PATH_TOKEN);
  if (!tokens || tokens.join('') !== input.replace(/[\s,]/g, '')) {
    return canonicalizeFail('malformed_path', 'pathD', 'silhouette path tokenization is not exact');
  }

  const svgCommands: ParsedNailPathV7['commands'] = [];
  let index = 0;
  let implicit: keyof typeof ABSOLUTE_ARITY | '' = '';
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let started = false;

  while (index < tokens.length) {
    const token = tokens[index];
    let command: string;
    if (isCommandToken(token)) {
      command = token;
      index += 1;
    } else if (implicit) {
      command = implicit === 'M' ? 'L' : implicit;
    } else {
      return canonicalizeFail('malformed_path', 'pathD', 'silhouette path starts with a number instead of M');
    }

    if (RELATIVE_COMMANDS.has(command)) {
      return canonicalizeFail('relative_path', 'pathD', `relative SVG command ${command} is not accepted`);
    }
    if (UNSUPPORTED_ABSOLUTE.has(command)) {
      return canonicalizeFail('unsupported_command', 'pathD', `SVG command ${command} is not accepted`);
    }
    if (!(command in ABSOLUTE_ARITY)) {
      return canonicalizeFail('malformed_path', 'pathD', `unknown SVG command ${command}`);
    }
    if (!started && command !== 'M') {
      return canonicalizeFail('malformed_path', 'pathD', 'silhouette path must start with absolute M');
    }

    const arity = ABSOLUTE_ARITY[command];
    if (command === 'Z') {
      if (index < tokens.length) {
        return canonicalizeFail('malformed_path', 'pathD', 'closed silhouette path must not continue after Z');
      }
      svgCommands.push({ command: 'Z', values: [] });
      currentX = startX;
      currentY = startY;
      implicit = '';
      continue;
    }

    const read = readNumbers(tokens, index, arity);
    if (!read) return canonicalizeFail('malformed_path', 'pathD', `incomplete numbers for ${command}`);
    index = read.next;

    if (command === 'H') {
      const x = read.values[0];
      svgCommands.push({ command: 'L', values: [x, currentY] });
      currentX = x;
      implicit = 'H';
    } else if (command === 'V') {
      const y = read.values[0];
      svgCommands.push({ command: 'L', values: [currentX, y] });
      currentY = y;
      implicit = 'V';
    } else if (command === 'M') {
      if (started) {
        return canonicalizeFail(
          'malformed_path',
          'pathD',
          'silhouette path must be a single closed subpath; a second M starts another subpath',
        );
      }
      const [x, y] = read.values;
      svgCommands.push({ command: 'M', values: [x, y] });
      currentX = x;
      currentY = y;
      startX = x;
      startY = y;
      started = true;
      implicit = 'M';
    } else if (command === 'L') {
      const [x, y] = read.values;
      svgCommands.push({ command: 'L', values: [x, y] });
      currentX = x;
      currentY = y;
      implicit = 'L';
    } else if (command === 'Q') {
      const [cx, cy, x, y] = read.values;
      svgCommands.push({ command: 'Q', values: [cx, cy, x, y] });
      currentX = x;
      currentY = y;
      implicit = 'Q';
    } else {
      const [c1x, c1y, c2x, c2y, x, y] = read.values;
      svgCommands.push({ command: 'C', values: [c1x, c1y, c2x, c2y, x, y] });
      currentX = x;
      currentY = y;
      implicit = 'C';
    }
  }

  if (svgCommands.length === 0 || svgCommands[svgCommands.length - 1]?.command !== 'Z') {
    return canonicalizeFail('open_path', 'pathD', 'silhouette path must be a single closed drawable subpath');
  }
  if (svgCommands.filter((item) => item.command === 'M').length !== 1) {
    return canonicalizeFail('malformed_path', 'pathD', 'silhouette path must contain exactly one M');
  }

  const mapped: ParsedNailPathV7 = {
    commands: svgCommands.map(({ command, values }) => {
      if (command === 'Z') return { command, values: [] };
      const next: number[] = [];
      for (let i = 0; i < values.length; i += 2) {
        next.push((values[i] - box.x) / box.width, (values[i + 1] - box.y) / box.height);
      }
      return { command, values: next };
    }),
  };

  for (const { values } of mapped.commands) {
    for (const value of values) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        return canonicalizeFail(
          'coordinates_out_of_range',
          'pathD',
          'viewBox-local mapping must stay inside finite [0, 1]; extrema renormalization is not allowed',
        );
      }
    }
  }

  const pathData = serializeNailPathDataV7(mapped);
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return canonicalizeFail('malformed_path', 'pathD', 'mapped silhouette is not a canonical nail-local path');
  const canonical = serializeNailPathDataV7(parsed);
  if (!isCanonicalSingleClosedNailPathV1(canonical)) {
    return canonicalizeFail('non_drawable_path', 'pathD', 'mapped silhouette is not a single closed drawable subpath');
  }

  return {
    ok: true,
    pathData: canonical,
    contourIdentity: sha256Hex(canonical),
    viewBox: box,
    canvasCenterU: (0 - box.x) / box.width,
  };
}

/** Nail-local contour must be one drawable M…Z subpath in canonical serialization. */
export function isCanonicalSingleClosedNailPathV1(pathData: unknown): pathData is string {
  if (typeof pathData !== 'string') return false;
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return false;
  if (parsed.commands[0]?.command !== 'M') return false;
  if (parsed.commands[parsed.commands.length - 1]?.command !== 'Z') return false;
  let moves = 0;
  for (const { command } of parsed.commands) {
    if (command === 'M') moves += 1;
    if (moves > 1) return false;
    if (command !== 'M' && command !== 'L' && command !== 'Q' && command !== 'C' && command !== 'Z') return false;
  }
  if (serializeNailPathDataV7(parsed) !== pathData) return false;
  return isDrawableNailPathDataV7(pathData, 'area');
}

function reasonFromRegistry(reason: GeometryUnavailableReasonV7): FrenchGeometryUnavailableReasonV1 {
  if (reason === 'unknown_asset') return 'unknown_asset';
  if (reason === 'revision_mismatch') return 'revision_drift';
  if (reason === 'finger_mismatch') return 'wrong_finger';
  if (reason === 'capability_unavailable') return 'placeholder';
  return 'fallback';
}

/**
 * Strict exact-geometry adapter. Calls resolveEditorGeometryV7 and accepts only
 * resolved + exact + signed_off + full registry SHA equality.
 */
export function resolveExactFrenchGeometryInputV1(
  ref: GeometryRefV7,
  expectedFinger: FingerCode,
  expectedRegistrySha256: string,
): FrenchGeometryInputResultV1 {
  if (!FINGER_SET.has(expectedFinger)) {
    return fail('wrong_finger', 'finger', 'expected finger is not a V7 finger code');
  }
  if (typeof expectedRegistrySha256 !== 'string' || !FULL_SHA256.test(expectedRegistrySha256)) {
    return fail('wrong_sha', 'registryAssetSetSha256', 'expected registry SHA must be a full 64-character lowercase hex digest');
  }

  const resolved = resolveEditorGeometryV7(ref, expectedFinger);
  if (resolved.status === 'unresolved') {
    const reason = reasonFromRegistry(resolved.reason);
    return fail(reason, 'geometryRef', `registry resolution is unavailable (${resolved.reason})`);
  }
  if (resolved.registryAssetSetSha256 !== expectedRegistrySha256) {
    return fail('wrong_sha', 'registryAssetSetSha256', 'returned full product registry SHA does not equal the expected digest');
  }
  if (resolved.fidelity !== 'exact' || resolved.evidence !== 'signed_off') {
    if (resolved.evidence === 'generated') {
      return fail('generated', 'geometryRef', 'generated silhouettes are unavailable to the exact French compiler');
    }
    return fail('fallback', 'geometryRef', 'only signed_off exact registry geometry is accepted');
  }

  const canonical = canonicalizeSilhouetteToNailLocalV1(resolved.silhouette.viewBox, resolved.silhouette.pathD);
  if (!canonical.ok) {
    return fail(canonical.reason, canonical.diagnostics[0]?.path ?? 'silhouette', canonical.diagnostics[0]?.message ?? 'silhouette canonicalize failed');
  }

  return {
    ok: true,
    geometry: {
      coordinateSpace: FRENCH_GEOMETRY_COORDINATE_SPACE_V1,
      finger: resolved.finger,
      assetId: resolved.assetId,
      revision: resolved.revision,
      shape: resolved.shape,
      length: resolved.length,
      registryAssetSetSha256: resolved.registryAssetSetSha256,
      contourPathData: canonical.pathData,
      contourIdentity: canonical.contourIdentity,
      viewBox: canonical.viewBox,
      canvasCenterU: canonical.canvasCenterU,
      fidelity: 'exact',
      evidence: 'signed_off',
      manufacturingValidated: false,
    },
  };
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** Portable SHA-256 so contour identity never depends on Node-only crypto. */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((word) => word.toString(16).padStart(8, '0')).join('');
}
