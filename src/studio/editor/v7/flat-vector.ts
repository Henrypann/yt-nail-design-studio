import type { FingerCode } from '../../../lib/types';
import { editorV7StepAuthoringFailure, type EditorV7CommandFailure, type EditorV7CommandResult } from './commands';
import type {
  EditorDocV7,
  FlatDesignElementV7,
  NailPointV7,
  ProcessStepV7,
  RgbaColorV7,
  Transform2DV7,
} from './model';
import { parseEditorDocV7 } from './schema';

export const FLAT_VECTOR_TOOLS_V7 = [
  'select',
  'brush',
  'eraser',
  'line',
  'rectangle',
  'circle',
  'star',
  'french',
  'region_mask',
  'anchor',
] as const;

export type FlatVectorToolV7 = (typeof FLAT_VECTOR_TOOLS_V7)[number];

export interface FlatElementMaskScopeV7 {
  stepMask: boolean;
  eraserMaskIds: string[];
  regionMaskIds: string[];
}

/**
 * Ordered non-destructive composition: mask elements affect only content
 * before them in `elements[]`. A typed step.mask is authoritative and
 * suppresses element region masks, while later eraser masks still subtract.
 */
export function resolveFlatElementMaskScopeV7(
  step: Extract<ProcessStepV7, { kind: 'flat_design' }>,
  elementIndex: number,
): FlatElementMaskScopeV7 {
  const later = step.elements.slice(elementIndex + 1);
  return {
    stepMask: step.mask !== undefined,
    eraserMaskIds: later.filter((item) => item.kind === 'eraser_mask' && item.visible).map((item) => item.id),
    regionMaskIds: step.mask ? [] : later.filter((item) => item.kind === 'region_mask' && item.visible).map((item) => item.id),
  };
}

export const IDENTITY_TRANSFORM_V7: Transform2DV7 = {
  position: { u: 0.5, v: 0.5 },
  scaleX: 1,
  scaleY: 1,
  rotationDeg: 0,
};

const PATH_COMMAND_ARITY = { M: 2, L: 2, Q: 4, C: 6, Z: 0 } as const;
const PATH_TOKEN = /[MLQCZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const PATH_ALLOWED = /^[\s,MLQCZ0-9eE.+-]+$/;

export interface ParsedNailPathV7 {
  commands: Array<{ command: keyof typeof PATH_COMMAND_ARITY; values: number[] }>;
}

/**
 * V7-07 canonical path subset. Coordinates are absolute nail-local values in
 * [0, 1]. Relative commands, arcs and shorthand commands are intentionally
 * rejected so persisted paths have one deterministic interpretation.
 */
export function parseNailPathDataV7(pathData: string): ParsedNailPathV7 | null {
  const input = pathData.trim();
  if (!input || input.length > 100_000 || !PATH_ALLOWED.test(input)) return null;
  const tokens = input.match(PATH_TOKEN);
  if (!tokens || tokens.join('').toUpperCase() !== input.replace(/[\s,]/g, '').toUpperCase()) return null;

  const commands: ParsedNailPathV7['commands'] = [];
  let index = 0;
  while (index < tokens.length) {
    const command = tokens[index] as keyof typeof PATH_COMMAND_ARITY;
    if (!(command in PATH_COMMAND_ARITY)) return null;
    if (commands.length === 0 && command !== 'M') return null;
    index += 1;
    const arity = PATH_COMMAND_ARITY[command];
    const values: number[] = [];
    for (let offset = 0; offset < arity; offset += 1) {
      const token = tokens[index + offset];
      if (!token || token in PATH_COMMAND_ARITY) return null;
      const value = Number(token);
      if (!Number.isFinite(value) || value < 0 || value > 1) return null;
      values.push(value);
    }
    index += arity;
    commands.push({ command, values });
    if (command === 'Z' && index < tokens.length) return null;
  }
  return commands.length > 0 ? { commands } : null;
}

export function isValidNailPathDataV7(pathData: string): boolean {
  return parseNailPathDataV7(pathData) !== null;
}

export function isClosedNailPathDataV7(pathData: string): boolean {
  const parsed = parseNailPathDataV7(pathData);
  return Boolean(parsed && parsed.commands[parsed.commands.length - 1]?.command === 'Z');
}

const MIN_PATH_SPAN_V7 = 0.0025;
const MIN_PATH_AREA_V7 = 0.000001;

function pathPoints(parsed: ParsedNailPathV7): NailPointV7[] {
  return parsed.commands.flatMap(({ values }) => {
    const points: NailPointV7[] = [];
    for (let index = 0; index < values.length; index += 2) {
      points.push({ u: values[index], v: values[index + 1] });
    }
    return points;
  });
}

function uniquePathPoints(points: readonly NailPointV7[]): NailPointV7[] {
  return points.filter((point, index) => points.findIndex((candidate) => (
    Math.hypot(candidate.u - point.u, candidate.v - point.v) < MIN_PATH_SPAN_V7
  )) === index);
}

/** Reject syntactically valid paths that cannot produce a visible stroke or area. */
export function isDrawableNailPathDataV7(pathData: string, appearance: 'stroke' | 'area'): boolean {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return false;
  const points = uniquePathPoints(pathPoints(parsed));
  if (appearance === 'stroke') return points.length >= 2;
  if (parsed.commands[parsed.commands.length - 1]?.command !== 'Z' || points.length < 3) return false;
  const width = Math.max(...points.map((point) => point.u)) - Math.min(...points.map((point) => point.u));
  const height = Math.max(...points.map((point) => point.v)) - Math.min(...points.map((point) => point.v));
  if (width < MIN_PATH_SPAN_V7 || height < MIN_PATH_SPAN_V7) return false;
  for (let first = 0; first < points.length - 2; first += 1) {
    for (let second = first + 1; second < points.length - 1; second += 1) {
      for (let third = second + 1; third < points.length; third += 1) {
        const a = points[first];
        const b = points[second];
        const c = points[third];
        const twiceArea = Math.abs((b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u));
        if (twiceArea >= MIN_PATH_AREA_V7) return true;
      }
    }
  }
  return false;
}

export function serializeNailPathDataV7(parsed: ParsedNailPathV7): string {
  return parsed.commands
    .map(({ command, values }) => values.length > 0 ? `${command}${values.map(formatUnit).join(' ')}` : command)
    .join(' ');
}

export function mapNailPathDataV7(
  pathData: string,
  mapper: (point: NailPointV7, index: number) => NailPointV7,
): string | null {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return null;
  let pointIndex = 0;
  const mapped: ParsedNailPathV7 = {
    commands: parsed.commands.map(({ command, values }) => {
      const next = [...values];
      for (let i = 0; i < next.length; i += 2) {
        const point = mapper({ u: next[i], v: next[i + 1] }, pointIndex);
        next[i] = clampUnit(point.u);
        next[i + 1] = clampUnit(point.v);
        pointIndex += 1;
      }
      return { command, values: next };
    }),
  };
  return serializeNailPathDataV7(mapped);
}

export function nailPathAnchorsV7(pathData: string): NailPointV7[] {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return [];
  return pathPoints(parsed);
}

export function moveNailPathAnchorV7(pathData: string, anchorIndex: number, point: NailPointV7): string | null {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed || !Number.isInteger(anchorIndex) || anchorIndex < 0) return null;
  let currentAnchor = 0;
  let found = false;
  const commands = parsed.commands.map(({ command, values }) => {
    const next = [...values];
    for (let valueIndex = 0; valueIndex < next.length; valueIndex += 2) {
      if (currentAnchor === anchorIndex) {
        next[valueIndex] = clampUnit(point.u);
        next[valueIndex + 1] = clampUnit(point.v);
        found = true;
      }
      currentAnchor += 1;
    }
    return { command, values: next };
  });
  return found ? serializeNailPathDataV7({ commands }) : null;
}

/** Apply the canonical element transform in nail-local space. */
export function transformNailPointV7(point: NailPointV7, transform: Transform2DV7): NailPointV7 {
  const aspect = 1.6;
  const radians = transform.rotationDeg * Math.PI / 180;
  const x = (point.u - 0.5) * transform.scaleX;
  const y = (point.v - 0.5) * transform.scaleY * aspect;
  return {
    u: transform.position.u + x * Math.cos(radians) - y * Math.sin(radians),
    v: transform.position.v + (x * Math.sin(radians) + y * Math.cos(radians)) / aspect,
  };
}

/** Inverse of transformNailPointV7, used before persisting a dragged anchor. */
export function inverseTransformNailPointV7(point: NailPointV7, transform: Transform2DV7): NailPointV7 {
  const aspect = 1.6;
  const radians = -transform.rotationDeg * Math.PI / 180;
  const x = point.u - transform.position.u;
  const y = (point.v - transform.position.v) * aspect;
  const rotatedX = x * Math.cos(radians) - y * Math.sin(radians);
  const rotatedY = x * Math.sin(radians) + y * Math.cos(radians);
  return {
    u: 0.5 + rotatedX / transform.scaleX,
    v: 0.5 + rotatedY / (transform.scaleY * aspect),
  };
}

export function normalizePointerPointsV7(points: readonly NailPointV7[]): NailPointV7[] {
  const normalized: NailPointV7[] = [];
  for (const point of points) {
    const next = { u: clampUnit(point.u), v: clampUnit(point.v) };
    const previous = normalized[normalized.length - 1];
    if (!previous || Math.hypot(next.u - previous.u, next.v - previous.v) >= 0.0025) normalized.push(next);
  }
  return normalized;
}

export function linePathDataV7(start: NailPointV7, end: NailPointV7): string {
  return `M${formatUnit(clampUnit(start.u))} ${formatUnit(clampUnit(start.v))} L${formatUnit(clampUnit(end.u))} ${formatUnit(clampUnit(end.v))}`;
}

export function rectanglePathDataV7(start: NailPointV7, end: NailPointV7): string {
  const left = clampUnit(Math.min(start.u, end.u));
  const right = clampUnit(Math.max(start.u, end.u));
  const top = clampUnit(Math.min(start.v, end.v));
  const bottom = clampUnit(Math.max(start.v, end.v));
  return `M${formatUnit(left)} ${formatUnit(top)} L${formatUnit(right)} ${formatUnit(top)} L${formatUnit(right)} ${formatUnit(bottom)} L${formatUnit(left)} ${formatUnit(bottom)} Z`;
}

export function circlePathDataV7(start: NailPointV7, end: NailPointV7): string {
  const cx = clampUnit((start.u + end.u) / 2);
  const cy = clampUnit((start.v + end.v) / 2);
  const rx = Math.max(0.005, Math.abs(end.u - start.u) / 2);
  const ry = Math.max(0.005, Math.abs(end.v - start.v) / 2);
  const k = 0.5522848;
  return [
    `M${formatUnit(cx)} ${formatUnit(clampUnit(cy - ry))}`,
    `C${formatUnit(clampUnit(cx + k * rx))} ${formatUnit(clampUnit(cy - ry))} ${formatUnit(clampUnit(cx + rx))} ${formatUnit(clampUnit(cy - k * ry))} ${formatUnit(clampUnit(cx + rx))} ${formatUnit(cy)}`,
    `C${formatUnit(clampUnit(cx + rx))} ${formatUnit(clampUnit(cy + k * ry))} ${formatUnit(clampUnit(cx + k * rx))} ${formatUnit(clampUnit(cy + ry))} ${formatUnit(cx)} ${formatUnit(clampUnit(cy + ry))}`,
    `C${formatUnit(clampUnit(cx - k * rx))} ${formatUnit(clampUnit(cy + ry))} ${formatUnit(clampUnit(cx - rx))} ${formatUnit(clampUnit(cy + k * ry))} ${formatUnit(clampUnit(cx - rx))} ${formatUnit(cy)}`,
    `C${formatUnit(clampUnit(cx - rx))} ${formatUnit(clampUnit(cy - k * ry))} ${formatUnit(clampUnit(cx - k * rx))} ${formatUnit(clampUnit(cy - ry))} ${formatUnit(cx)} ${formatUnit(clampUnit(cy - ry))} Z`,
  ].join(' ');
}

export function starPathDataV7(start: NailPointV7, end: NailPointV7): string {
  const cx = clampUnit((start.u + end.u) / 2);
  const cy = clampUnit((start.v + end.v) / 2);
  const radiusU = Math.max(0.005, Math.abs(end.u - start.u) / 2);
  const radiusV = Math.max(0.005, Math.abs(end.v - start.v) / 2);
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const ratio = index % 2 === 0 ? 1 : 0.42;
    return { u: clampUnit(cx + Math.cos(angle) * radiusU * ratio), v: clampUnit(cy + Math.sin(angle) * radiusV * ratio) };
  });
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'}${formatUnit(point.u)} ${formatUnit(point.v)}`).join(' ')} Z`;
}

export function createPointerFlatElementV7(args: {
  id: string;
  tool: 'brush' | 'eraser';
  points: readonly NailPointV7[];
  color: RgbaColorV7;
  widthMm: number;
}): FlatDesignElementV7 | null {
  const points = normalizePointerPointsV7(args.points);
  if (points.length < 2 || !Number.isFinite(args.widthMm) || args.widthMm < 0.01 || args.widthMm > 10) return null;
  const common = { id: args.id, visible: true, locked: false, opacity: 1, transform: structuredClone(IDENTITY_TRANSFORM_V7) };
  return args.tool === 'brush'
    ? { ...common, kind: 'brush_stroke', points, color: structuredClone(args.color), widthMm: args.widthMm }
    : { ...common, kind: 'eraser_mask', path: points, widthMm: args.widthMm };
}

export function createVectorFlatElementV7(args: {
  id: string;
  pathData: string;
  color: RgbaColorV7;
  appearance: 'stroke' | 'fill';
  strokeWidthMm?: number;
}): FlatDesignElementV7 | null {
  const parsed = parseNailPathDataV7(args.pathData);
  if (!parsed || !isDrawableNailPathDataV7(args.pathData, args.appearance === 'fill' ? 'area' : 'stroke')) return null;
  const common = { id: args.id, kind: 'vector_shape' as const, visible: true, locked: false, opacity: 1, transform: structuredClone(IDENTITY_TRANSFORM_V7), pathData: serializeNailPathDataV7(parsed) };
  return args.appearance === 'stroke'
    ? { ...common, stroke: structuredClone(args.color), strokeWidthMm: args.strokeWidthMm ?? 0.35 }
    : { ...common, fill: structuredClone(args.color) };
}

export function createFrenchFlatElementV7(id: string, color: RgbaColorV7): FlatDesignElementV7 {
  return { id, kind: 'french_edge', visible: true, locked: false, opacity: 1, transform: structuredClone(IDENTITY_TRANSFORM_V7), widthRatio: 0.22, curvature: 0.35, color: structuredClone(color) };
}

export function createRegionMaskFlatElementV7(id: string, pathData: string): FlatDesignElementV7 | null {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed || !isDrawableNailPathDataV7(pathData, 'area')) return null;
  return {
    id,
    kind: 'region_mask',
    visible: true,
    locked: false,
    opacity: 1,
    transform: structuredClone(IDENTITY_TRANSFORM_V7),
    mask: { coordinateSpace: 'nail-local-v1', pathData: serializeNailPathDataV7(parsed), fillRule: 'nonzero', inverted: false },
  };
}

function reject(reason: EditorV7CommandFailure, message: string): EditorV7CommandResult {
  return { ok: false, reason, message };
}

type LocatedFlatElementV7 =
  | { ok: false; result: EditorV7CommandResult }
  | { ok: true; stepIndex: number; elementIndex: number; step: Extract<ProcessStepV7, { kind: 'flat_design' }>; element: FlatDesignElementV7 };

function locateFlatElement(doc: EditorDocV7, finger: FingerCode, stepId: string, elementId: string): LocatedFlatElementV7 {
  const stepIndex = doc.nails[finger].steps.findIndex((step) => step.id === stepId);
  const step = doc.nails[finger].steps[stepIndex];
  if (!step) return { ok: false, result: reject('not_found', 'step not found') };
  if (step.kind !== 'flat_design') return { ok: false, result: reject('not_allowed', 'element edit requires a flat design step') };
  const unavailable = editorV7StepAuthoringFailure(step);
  if (unavailable) return { ok: false, result: unavailable };
  const elementIndex = step.elements.findIndex((element) => element.id === elementId);
  const element = step.elements[elementIndex];
  if (!element) return { ok: false, result: reject('not_found', 'element not found') };
  if (element.locked) return { ok: false, result: reject('locked', 'element is locked') };
  return { ok: true, stepIndex, elementIndex, step, element };
}

function validate(next: EditorDocV7): EditorV7CommandResult {
  const parsed = parseEditorDocV7(next);
  return parsed.ok ? { ok: true, doc: parsed.doc } : reject('invalid_document', parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
}

/** Atomic typed replacement; ID and discriminant are immutable through this command. */
export function replaceEditorV7FlatElement(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  elementId: string,
  replacement: FlatDesignElementV7,
): EditorV7CommandResult {
  const located = locateFlatElement(doc, finger, stepId, elementId);
  if (!located.ok) return located.result;
  if (replacement.id !== elementId || replacement.kind !== located.element.kind) {
    return reject('not_allowed', 'element ID and kind cannot change during update');
  }
  if (replacement.kind === 'vector_shape' && !isDrawableNailPathDataV7(replacement.pathData, replacement.fill !== undefined ? 'area' : 'stroke')) return reject('invalid_value', 'pathData must produce a visible canonical nail-local stroke or closed area');
  if (replacement.kind === 'region_mask' && !isDrawableNailPathDataV7(replacement.mask.pathData, 'area')) return reject('invalid_value', 'mask pathData must produce a visible closed canonical nail-local area');
  if (JSON.stringify(replacement) === JSON.stringify(located.element)) return reject('not_allowed', 'element is unchanged');
  const next = structuredClone(doc);
  const target = next.nails[finger].steps[located.stepIndex] as Extract<ProcessStepV7, { kind: 'flat_design' }>;
  target.elements[located.elementIndex] = structuredClone(replacement);
  return validate(next);
}

export function setEditorV7FlatElementOpacity(doc: EditorDocV7, finger: FingerCode, stepId: string, elementId: string, opacity: number): EditorV7CommandResult {
  const located = locateFlatElement(doc, finger, stepId, elementId);
  if (!located.ok) return located.result;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) return reject('invalid_value', 'element opacity must be between 0 and 1');
  return replaceEditorV7FlatElement(doc, finger, stepId, elementId, { ...located.element, opacity });
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function formatUnit(value: number): string {
  return Number(value.toFixed(5)).toString();
}
