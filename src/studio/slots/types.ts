/**
 * NailSlot V2 — per-finger affine slots on a fixed visual plate.
 * Local UV: root center (0.5, 1), tip center (0.5, 0); u left→right.
 * Projection uses landmarks + SVG affine only — NOT nailScale / PX_PER_MM.
 */

import type { FingerCode } from '@/lib/types';

export type PointPx = { x: number; y: number };

/** SVG matrix(a b c d e f) → [a, b, c, d, tx, ty] */
export type AffineMatrix = [number, number, number, number, number, number];

export type FingerRole = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export type HandViewV2 = 'back' | 'palm';

export type NailLengthMm = 14 | 18 | 22 | 26;

export const NAIL_LENGTH_MM = {
  short: 14,
  medium: 18,
  long: 22,
  'extra-long': 26,
} as const satisfies Record<string, NailLengthMm>;

export interface NailSlotV2 {
  id: string;
  fingerCode: FingerCode;
  fingerRole: FingerRole;
  view: HandViewV2;
  rootLeft: PointPx;
  rootRight: PointPx;
  tipCenter: PointPx;
  center: PointPx;
  rotationDeg: number;
  nailBedWidthPx: number;
  visibleLengthPx: number;
  /** Maps local UV → stage px (non-uniform sx/sy allowed) */
  transform: AffineMatrix;
  /** Optional closed polyline (px pairs or PointPx) */
  contourPx?: Array<PointPx | [number, number]>;
  contourPolyline?: PointPx[];
  /** SVG path `d` keeping artwork inside illustrated nail bed */
  clipPath?: string;
  localUv?: {
    rootCenter: [number, number];
    tipCenter: [number, number];
  };
}

export interface NailSlotsV2File {
  version: number;
  view: HandViewV2;
  updated_at: string;
  plate: {
    file?: string;
    path?: string;
    sourceWidth: number;
    sourceHeight: number;
    acceptance?: string;
    style?: string;
  };
  coordinate_space?: Record<string, unknown>;
  local_uv_contract?: Record<string, unknown>;
  handedness?: string;
  referenceLengthMm?: NailLengthMm;
  slots: NailSlotV2[];
}

export const FINGER_ROLE_BY_CODE: Record<FingerCode, FingerRole> = {
  L1: 'thumb',
  L2: 'index',
  L3: 'middle',
  L4: 'ring',
  L5: 'pinky',
  R1: 'thumb',
  R2: 'index',
  R3: 'middle',
  R4: 'ring',
  R5: 'pinky',
};
