import {
  Color,
  Group,
  InstancedMesh,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import type { CatmullRomCurve3, Object3D } from 'three';
import { TILE_DEFS, TRACK, TRACK_ANCHORS, tileOrigin, tileSpans } from '../track';
import type { TilePlacement } from '../track';
import type { ModelLibrary } from './models';
import { boundsOf } from './models';

export type Quality = 'high' | 'low';

const UP = new Vector3(0, 1, 0);

/** Small deterministic random generator so the scenery is the same on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Turns every mesh of a model into one InstancedMesh, so repeated tiles and props cost one draw
 * call per material instead of one per copy. Geometry and materials are shared with the model.
 */
export function instanceModel(model: Object3D, placements: readonly Matrix4[]): Group {
  const group = new Group();
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const local = inverse.clone().multiply(o.matrixWorld);
    const instanced = new InstancedMesh(o.geometry, o.material, placements.length);
    placements.forEach((p, i) => instanced.setMatrixAt(i, p.clone().multiply(local)));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    group.add(instanced);
  });
  return group;
}

export function tileMatrix(p: TilePlacement): Matrix4 {
  const origin = tileOrigin(p);
  const def = TILE_DEFS[p.tile];
  return new Matrix4()
    .makeTranslation(origin.x, 0, origin.z)
    .multiply(new Matrix4().makeRotationY((-p.rotation * Math.PI) / 2))
    .multiply(new Matrix4().makeTranslation(def.modelOffsetX, 0, 0));
}

/** Pivot of a prop: footprint centre on the ground, plus its size, so it can be placed by centre. */
function propFrame(model: Object3D): { offset: Matrix4; size: Vector3 } {
  const box = boundsOf(model);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  return { offset: new Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z), size };
}

export interface WorldOptions {
  library: ModelLibrary;
  curve: CatmullRomCurve3;
  quality: Quality;
  track?: readonly TilePlacement[];
}

export interface World {
  root: Group;
  /** Distance from the centreline in the horizontal plane. */
  distanceToRoad(x: number, z: number): number;
  dispose(): void;
}

const linear = (r: number, g: number, b: number): Color =>
  new Color().setRGB(r, g, b, LinearSRGBColorSpace);

export function createWorld({ library, curve, quality, track = TRACK }: WorldOptions): World {
  const root = new Group();
  root.name = 'world';
  const owned: { dispose(): void }[] = [];

  // Ground
  const groundGeometry = new PlaneGeometry(120, 120);
  const groundMaterial = new MeshStandardMaterial({
    color: linear(0.24, 0.44, 0.34),
    roughness: 1,
  });
  owned.push(groundGeometry, groundMaterial);
  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(3.5, -0.012, 2.5);
  ground.receiveShadow = true;
  root.add(ground);

  // Tiles, instanced per tile type
  const byTile = new Map<string, Matrix4[]>();
  for (const p of track) {
    const list = byTile.get(p.tile) ?? [];
    list.push(tileMatrix(p));
    byTile.set(p.tile, list);
  }
  for (const [name, matrices] of byTile) {
    const model = library.get(name as TilePlacement['tile']);
    root.add(instanceModel(model, matrices));
  }

  // Sample the centreline once for placing props
  const samples = curve.getSpacedPoints(400);
  const distanceToRoad = (x: number, z: number): number => {
    let best = Infinity;
    for (const s of samples) best = Math.min(best, Math.hypot(s.x - x, s.z - z));
    return best;
  };
  const lap = curve.getLength();
  const frameAt = (t: number): { p: Vector3; tangent: Vector3; right: Vector3 } => {
    const p = curve.getPointAt(((t % 1) + 1) % 1);
    const tangent = curve.getTangentAt(((t % 1) + 1) % 1);
    tangent.y = 0;
    tangent.normalize();
    return { p, tangent, right: new Vector3(-tangent.z, 0, tangent.x) };
  };
  /** Matrix that puts a prop's centre at p, with its long axis along `along`. */
  const place = (p: Vector3, along: Vector3, size: Vector3, extraYaw = 0): Matrix4 => {
    // Props are modelled with their long side on x or z; line the long side up with `along`.
    const longOnX = size.x > size.z;
    const yaw = Math.atan2(along.x, along.z) + (longOnX ? Math.PI / 2 : 0) + extraYaw;
    return new Matrix4().compose(
      new Vector3(p.x, 0, p.z),
      new Quaternion().setFromAxisAngle(UP, yaw),
      new Vector3(1, 1, 1),
    );
  };
  const addProp = (name: Parameters<ModelLibrary['get']>[0], matrices: Matrix4[]): void => {
    if (matrices.length === 0) return;
    const model = library.get(name);
    const { offset } = propFrame(model);
    const group = instanceModel(
      model,
      matrices.map((m) => m.clone().multiply(offset)),
    );
    root.add(group);
  };

  // Barriers along both sides, alternating red and white
  const red: Matrix4[] = [];
  const white: Matrix4[] = [];
  const barrierStep = quality === 'high' ? 0.9 : 1.6;
  const barrierSize = propFrame(library.get('barrierRed')).size;
  const count = Math.floor(lap / barrierStep);
  for (let i = 0; i < count; i++) {
    const { p, tangent, right } = frameAt(i / count);
    for (const side of [1, -1]) {
      const at = p.clone().addScaledVector(right, side * 0.66);
      ((i + (side > 0 ? 1 : 0)) % 2 === 0 ? red : white).push(place(at, tangent, barrierSize));
    }
  }
  addProp('barrierRed', red);
  addProp('barrierWhite', white);

  // Grandstands outside the back straight, facing the road. Outside is the left of travel.
  const spans = tileSpans(track);
  const stands: Matrix4[] = [];
  const covered: Matrix4[] = [];
  const standSize = propFrame(library.get('grandStand')).size;
  const standCount = quality === 'high' ? 5 : 3;
  const back = TRACK_ANCHORS.backStraight;
  const backStart = spans[back[0]]?.start ?? 0;
  const backEnd = spans[back.at(-1) ?? 0]?.end ?? 0;
  for (let i = 0; i < standCount; i++) {
    const t = backStart + ((backEnd - backStart) * (i + 0.5)) / standCount;
    const { p, tangent, right } = frameAt(t);
    const at = p.clone().addScaledVector(right, -1.45);
    (i % 2 === 0 ? stands : covered).push(place(at, tangent, standSize, Math.PI));
  }
  addProp('grandStand', stands);
  addProp('grandStandCovered', covered);

  // Pit garages and flags beside the start line, on the inside of the loop
  const start = spans[TRACK_ANCHORS.startLine];
  const garages: Matrix4[] = [];
  const garageSize = propFrame(library.get('pitsGarage')).size;
  for (let i = 0; i < 2; i++) {
    const t = (start?.start ?? 0) + ((start?.end ?? 0.1) - (start?.start ?? 0)) * (0.2 + i * 0.5);
    const { p, tangent, right } = frameAt(t);
    garages.push(place(p.clone().addScaledVector(right, 1.1), tangent, garageSize, 0));
  }
  addProp('pitsGarage', garages);
  const flagSize = propFrame(library.get('flagCheckers')).size;
  addProp('flagCheckers', [
    place(
      frameAt((start?.start ?? 0) + 0.015).p.addScaledVector(frameAt(0.015).right, -0.85),
      frameAt(0.015).tangent,
      flagSize,
    ),
  ]);

  // Scatter trees, tents, billboards and light posts away from the road
  const rand = mulberry32(2027);
  const trees: Matrix4[] = [];
  const bigTrees: Matrix4[] = [];
  const tents: Matrix4[] = [];
  const billboards: Matrix4[] = [];
  const pylons: Matrix4[] = [];
  const lamps: Matrix4[] = [];
  const treeTarget = quality === 'high' ? 90 : 30;
  let attempts = 0;
  while (trees.length + bigTrees.length < treeTarget && attempts++ < 4000) {
    const x = -4 + rand() * 15;
    const z = -4 + rand() * 13;
    if (distanceToRoad(x, z) < 1.7) continue;
    const m = new Matrix4().compose(
      new Vector3(x, 0, z),
      new Quaternion().setFromAxisAngle(UP, rand() * Math.PI * 2),
      new Vector3(1, 1, 1).multiplyScalar(0.8 + rand() * 0.5),
    );
    (rand() > 0.55 ? bigTrees : trees).push(m);
  }
  addProp('treeSmall', trees);
  addProp('treeLarge', bigTrees);

  if (quality === 'high') {
    const tentSize = propFrame(library.get('tent')).size;
    const boardSize = propFrame(library.get('billboard')).size;
    const lampSize = propFrame(library.get('lightPostLarge')).size;
    const pylonSize = propFrame(library.get('pylon')).size;
    for (let i = 0; i < 4; i++) {
      const t = 0.1 + i * 0.22;
      const { p, tangent, right } = frameAt(t);
      tents.push(place(p.clone().addScaledVector(right, 2.1), tangent, tentSize));
      billboards.push(place(p.clone().addScaledVector(right, -2.2), tangent, boardSize, Math.PI));
    }
    for (let i = 0; i < 10; i++) {
      const { p, tangent, right } = frameAt(i / 10 + 0.03);
      lamps.push(place(p.clone().addScaledVector(right, -0.95), tangent, lampSize));
      pylons.push(place(p.clone().addScaledVector(right, 0.8), tangent, pylonSize));
    }
    addProp('tent', tents);
    addProp('billboard', billboards);
    addProp('lightPostLarge', lamps);
    addProp('pylon', pylons);
  }

  return {
    root,
    distanceToRoad,
    dispose() {
      for (const item of owned) item.dispose();
      root.removeFromParent();
    },
  };
}
