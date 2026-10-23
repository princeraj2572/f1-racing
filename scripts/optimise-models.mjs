// Extracts the models this site uses from the Kenney Racing Kit ZIP and writes optimised GLBs
// to public/models. Usage: npm run optimise:models
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, meshopt, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const ROOT = resolve(import.meta.dirname, '..');
const ZIP = join(ROOT, 'assets-src', 'kenney_racing-kit.zip');
const WORK = join(ROOT, '.model-work', 'kit');
const OUT = join(ROOT, 'public', 'models');
const SRC_DIR = join(WORK, 'Models', 'GLTF format');
const BUDGET_BYTES = 8 * 1024 * 1024;

// Only these pieces ship. Tiles are re-anchored so their footprint starts at the origin.
const TILES = [
  'roadStart',
  'roadStraight',
  'roadStraightLong',
  'roadCornerSmall',
  'roadCornerLarge',
  'roadCornerLarger',
];
const CARS = ['raceCarRed', 'raceCarOrange', 'raceCarGreen', 'raceCarWhite'];
const PROPS = [
  'grandStand',
  'grandStandCovered',
  'barrierRed',
  'barrierWhite',
  'lightPostLarge',
  'flagCheckers',
  'treeSmall',
  'treeLarge',
  'tent',
  'billboard',
  'pylon',
  'fenceStraight',
  'pitsGarage',
];
const WANTED = [...TILES, ...CARS, ...PROPS];

if (!existsSync(ZIP)) {
  console.error(`Missing ${ZIP}. Put the Kenney Racing Kit ZIP there first (see README).`);
  process.exit(1);
}

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
execFileSync('unzip', ['-q', '-o', ZIP, 'Models/GLTF format/*.glb', 'License.txt', '-d', WORK]);

const available = new Set(readdirSync(SRC_DIR).map((f) => f.replace(/\.glb$/, '')));
const missing = WANTED.filter((n) => !available.has(n));
if (missing.length) {
  console.error(`Not found in the kit: ${missing.join(', ')}`);
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.ERROR))
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
copyFileSync(join(WORK, 'License.txt'), join(OUT, 'LICENSE-kenney-racing-kit.txt'));

let total = 0;
for (const name of WANTED) {
  const doc = await io.read(join(SRC_DIR, `${name}.glb`));
  const root = doc.getRoot();

  // Kenney exports carry an offset on the root node; drop it so models sit on a clean origin.
  for (const scene of root.listScenes()) {
    for (const node of scene.listChildren()) node.setTranslation([0, 0, 0]);
  }

  // Flat-colour materials are exported as unlit. Make them regular PBR so lights and shadows work.
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_materials_unlit') ext.dispose();
  }
  for (const material of root.listMaterials()) {
    material.setMetallicFactor(0).setRoughnessFactor(0.85);
  }

  // The kit has no textures, so there is nothing to compress to WebP/KTX2.
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    quantize(),
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true);

  const file = join(OUT, `${name}.glb`);
  await io.write(file, doc);
  const size = statSync(file).size;
  total += size;
  console.log(`${name.padEnd(20)} ${(size / 1024).toFixed(1).padStart(7)} KB`);
}

console.log(`\n${WANTED.length} models, ${(total / 1024).toFixed(1)} KB total`);
if (total > BUDGET_BYTES) {
  console.error('public/models exceeds the 8 MB budget');
  process.exit(1);
}
