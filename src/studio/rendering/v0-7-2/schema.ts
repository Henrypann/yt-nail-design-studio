import { FINGER_CODES } from '@/lib/types';
import type { ParseRenderContractResultV1, PreviewAppearanceProfileV1, RenderSceneSnapshotV1 } from './model';

type Issue = { path: string; code: 'invalid_contract' | 'unknown_key'; message: string };
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const string = (value: unknown) => typeof value === 'string' && value.length > 0;

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: Issue[]) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) {
    issues.push({ path: `${path}.${key}`, code: 'unknown_key', message: 'Unknown render contract key.' });
  }
}

function tuple3(value: unknown): boolean {
  return Array.isArray(value) && value.length === 3 && value.every(finite);
}

function ref(value: unknown, path: string, issues: Issue[]) {
  if (!isRecord(value)) { issues.push({ path, code: 'invalid_contract', message: 'Expected versioned reference.' }); return; }
  exactKeys(value, ['id', 'revision', 'sha256'], path, issues);
  if (!string(value.id) || !string(value.revision) || !/^[a-f0-9]{64}$/.test(String(value.sha256))) {
    issues.push({ path, code: 'invalid_contract', message: 'Invalid versioned reference.' });
  }
}

export function parsePreviewAppearanceProfileV1(value: unknown): ParseRenderContractResultV1<PreviewAppearanceProfileV1> {
  const issues: Issue[] = [];
  if (!isRecord(value)) return { ok: false, issues: [{ path: '$', code: 'invalid_contract', message: 'Expected appearance profile.' }] };
  exactKeys(value, ['schemaVersion', 'profileId', 'revision', 'sha256', 'purpose', 'colorManagement', 'environment', 'finishes', 'cameraPresets', 'evidence'], '$', issues);
  if (value.schemaVersion !== '1.0.0' || !string(value.profileId) || !string(value.revision)
    || !/^[a-f0-9]{64}$/.test(String(value.sha256)) || value.purpose !== 'single_nail_customer_preview') {
    issues.push({ path: '$', code: 'invalid_contract', message: 'Invalid appearance profile identity.' });
  }
  if (!isRecord(value.colorManagement)) issues.push({ path: '$.colorManagement', code: 'invalid_contract', message: 'Expected color management.' });
  else {
    exactKeys(value.colorManagement, ['workingSpace', 'outputSpace', 'toneMapping', 'exposure'], '$.colorManagement', issues);
    if (value.colorManagement.workingSpace !== 'linear-srgb' || value.colorManagement.outputSpace !== 'srgb'
      || value.colorManagement.toneMapping !== 'aces-filmic' || !finite(value.colorManagement.exposure)
      || Number(value.colorManagement.exposure) < 0.25 || Number(value.colorManagement.exposure) > 4) {
      issues.push({ path: '$.colorManagement', code: 'invalid_contract', message: 'Invalid color management.' });
    }
  }
  if (!isRecord(value.environment)) issues.push({ path: '$.environment', code: 'invalid_contract', message: 'Expected environment.' });
  else {
    exactKeys(value.environment, ['environmentId', 'intensity', 'background'], '$.environment', issues);
    if (value.environment.environmentId !== 'neutral-studio-v1' || value.environment.background !== 'warm-workspace'
      || !finite(value.environment.intensity) || Number(value.environment.intensity) < 0 || Number(value.environment.intensity) > 4) {
      issues.push({ path: '$.environment', code: 'invalid_contract', message: 'Invalid environment.' });
    }
  }
  if (!isRecord(value.finishes)) issues.push({ path: '$.finishes', code: 'invalid_contract', message: 'Expected finish map.' });
  else {
    exactKeys(value.finishes, ['gloss', 'matte', 'frosted'], '$.finishes', issues);
    for (const finish of ['gloss', 'matte', 'frosted']) {
      const entry = value.finishes[finish];
      if (!isRecord(entry)) { issues.push({ path: `$.finishes.${finish}`, code: 'invalid_contract', message: 'Missing finish.' }); continue; }
      exactKeys(entry, ['baseRoughness', 'clearcoat', 'clearcoatRoughness', 'transmission'], `$.finishes.${finish}`, issues);
      if (!['baseRoughness', 'clearcoat', 'clearcoatRoughness', 'transmission'].every((key) => finite(entry[key]) && Number(entry[key]) >= 0 && Number(entry[key]) <= 1)) {
        issues.push({ path: `$.finishes.${finish}`, code: 'invalid_contract', message: 'Finish values must be 0..1.' });
      }
    }
  }
  if (!Array.isArray(value.cameraPresets) || value.cameraPresets.length !== 5) issues.push({ path: '$.cameraPresets', code: 'invalid_contract', message: 'Five camera presets required.' });
  else {
    const ids = new Set<string>();
    value.cameraPresets.forEach((preset, index) => {
      const path = `$.cameraPresets[${index}]`;
      if (!isRecord(preset)) { issues.push({ path, code: 'invalid_contract', message: 'Invalid camera preset.' }); return; }
      exactKeys(preset, ['id', 'positionMm', 'targetMm', 'up', 'verticalFovDeg'], path, issues);
      if (!['surface', 'oblique_left', 'oblique_right', 'side_profile', 'tip_grazing'].includes(String(preset.id))
        || ids.has(String(preset.id)) || !tuple3(preset.positionMm) || !tuple3(preset.targetMm) || !tuple3(preset.up)
        || !finite(preset.verticalFovDeg) || Number(preset.verticalFovDeg) < 15 || Number(preset.verticalFovDeg) > 70) {
        issues.push({ path, code: 'invalid_contract', message: 'Invalid camera preset.' });
      }
      ids.add(String(preset.id));
    });
  }
  if (!isRecord(value.evidence)) issues.push({ path: '$.evidence', code: 'invalid_contract', message: 'Expected evidence.' });
  else {
    exactKeys(value.evidence, ['fidelity', 'manufacturingValidated', 'limitations'], '$.evidence', issues);
    if (value.evidence.fidelity !== 'approximate' || value.evidence.manufacturingValidated !== false
      || !Array.isArray(value.evidence.limitations) || value.evidence.limitations.length === 0 || !value.evidence.limitations.every(string)) {
      issues.push({ path: '$.evidence', code: 'invalid_contract', message: 'Approximate evidence and limitations required.' });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: structuredClone(value) as unknown as PreviewAppearanceProfileV1 };
}

export function parseRenderSceneSnapshotV1(value: unknown): ParseRenderContractResultV1<RenderSceneSnapshotV1> {
  const issues: Issue[] = [];
  if (!isRecord(value)) return { ok: false, issues: [{ path: '$', code: 'invalid_contract', message: 'Expected render scene.' }] };
  exactKeys(value, ['schemaVersion', 'sceneId', 'profileRef', 'geometryRef', 'designRef', 'presentation', 'quality', 'finish', 'layerRefs', 'cameraPresetId', 'evidence'], '$', issues);
  if (value.schemaVersion !== '1.0.0' || !string(value.sceneId) || value.presentation !== 'single_nail_focus_simulated_3d'
    || !['interactive', 'high_quality'].includes(String(value.quality)) || !['gloss', 'matte', 'frosted'].includes(String(value.finish))
    || !['surface', 'oblique_left', 'oblique_right', 'side_profile', 'tip_grazing'].includes(String(value.cameraPresetId))) {
    issues.push({ path: '$', code: 'invalid_contract', message: 'Invalid render scene identity.' });
  }
  ref(value.profileRef, '$.profileRef', issues);
  if (!isRecord(value.geometryRef)) issues.push({ path: '$.geometryRef', code: 'invalid_contract', message: 'Expected geometry ref.' });
  else {
    exactKeys(value.geometryRef, ['snapshotId', 'revision', 'geometryHash', 'fidelity'], '$.geometryRef', issues);
    if (!string(value.geometryRef.snapshotId) || !string(value.geometryRef.revision) || !/^[a-f0-9]{64}$/.test(String(value.geometryRef.geometryHash))
      || !['exact', 'approximate', 'unavailable'].includes(String(value.geometryRef.fidelity))) issues.push({ path: '$.geometryRef', code: 'invalid_contract', message: 'Invalid geometry ref.' });
  }
  if (!isRecord(value.designRef)) issues.push({ path: '$.designRef', code: 'invalid_contract', message: 'Expected design ref.' });
  else {
    exactKeys(value.designRef, ['designId', 'revision', 'finger'], '$.designRef', issues);
    if (!string(value.designRef.designId) || !Number.isSafeInteger(value.designRef.revision) || Number(value.designRef.revision) < 0
      || !FINGER_CODES.includes(value.designRef.finger as never)) issues.push({ path: '$.designRef', code: 'invalid_contract', message: 'Invalid design ref.' });
  }
  if (!Array.isArray(value.layerRefs) || value.layerRefs.length < 2) issues.push({ path: '$.layerRefs', code: 'invalid_contract', message: 'Background and finish layers required.' });
  else value.layerRefs.forEach((layer, index) => {
    const path = `$.layerRefs[${index}]`;
    if (!isRecord(layer)) { issues.push({ path, code: 'invalid_contract', message: 'Invalid layer ref.' }); return; }
    exactKeys(layer, ['stepId', 'kind', 'fidelity'], path, issues);
    if (!string(layer.stepId) || !['background', 'flat_design', 'surface_effect', 'dimensional_decoration', 'surface_finish'].includes(String(layer.kind))
      || !['exact', 'approximate', 'unavailable'].includes(String(layer.fidelity))) issues.push({ path, code: 'invalid_contract', message: 'Invalid layer ref.' });
  });
  if (!isRecord(value.evidence)) issues.push({ path: '$.evidence', code: 'invalid_contract', message: 'Expected evidence.' });
  else {
    exactKeys(value.evidence, ['fidelity', 'writerZero', 'manufacturingValidated', 'limitations'], '$.evidence', issues);
    if (!['exact', 'approximate', 'unavailable'].includes(String(value.evidence.fidelity)) || value.evidence.writerZero !== true
      || value.evidence.manufacturingValidated !== false || !Array.isArray(value.evidence.limitations)
      || value.evidence.limitations.length === 0 || !value.evidence.limitations.every(string)) issues.push({ path: '$.evidence', code: 'invalid_contract', message: 'Invalid evidence.' });
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: structuredClone(value) as unknown as RenderSceneSnapshotV1 };
}
