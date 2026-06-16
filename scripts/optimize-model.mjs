import { spawnSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const cli = resolve('node_modules/@gltf-transform/cli/bin/cli.js');
const source = resolve('public/models/peshka.glb');
const stage = resolve('public/models/.peshka-stage.glb');
const output = resolve('public/models/peshka.optimized.glb');

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

try {
  run([
    'optimize',
    source,
    stage,
    '--compress',
    'false',
    '--texture-compress',
    'webp',
    '--texture-size',
    '1024',
    '--flatten',
    'false',
    '--join',
    'false',
    '--instance',
    'false',
    '--palette',
    'false',
    '--simplify',
    'false',
    '--prune',
    'true',
    '--weld',
    'true',
  ]);
  run([
    'meshopt',
    stage,
    output,
    '--level',
    'high',
    '--quantization-volume',
    'mesh',
    '--quantize-position',
    '16',
    '--quantize-normal',
    '16',
    '--quantize-texcoord',
    '14',
    '--quantize-generic',
    '16',
  ]);
} finally {
  try {
    unlinkSync(stage);
  } catch {
    // The stage file may not exist if the first transform failed.
  }
}
