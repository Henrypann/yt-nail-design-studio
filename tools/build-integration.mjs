import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nextgen-integration-build-'));
const stagedDist = path.join(stagingRoot, 'dist');
const finalDist = path.join(projectRoot, 'dist');

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function publishBuild() {
  const previousDist = `${finalDist}.previous-${process.pid}`;
  const hadPrevious = fs.existsSync(finalDist);
  if (hadPrevious) fs.renameSync(finalDist, previousDist);
  try {
    fs.cpSync(stagedDist, finalDist, { recursive: true });
  } catch (error) {
    fs.rmSync(finalDist, { force: true, recursive: true });
    if (hadPrevious) fs.renameSync(previousDist, finalDist);
    throw error;
  }
  if (hadPrevious) fs.rmSync(previousDist, { force: true, recursive: true });
}

try {
  run(path.join(projectRoot, 'node_modules/.bin/tsc'), ['-b']);
  run(path.join(projectRoot, 'node_modules/.bin/vite'), ['build', '--mode', 'integration'], {
    ...process.env,
    NEXTGEN_INTEGRATION_OUT_DIR: stagedDist,
  });
  publishBuild();
  console.log(`Integration build published to ${finalDist}`);
} finally {
  fs.rmSync(stagingRoot, { force: true, recursive: true });
}
