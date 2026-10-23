import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  LoadingManager,
  Box3,
  Vector3,
} from 'three';
import type { Material, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { TileName } from '../track';

export const CAR_MODELS = ['raceCarRed', 'raceCarOrange', 'raceCarGreen', 'raceCarWhite'] as const;
export type CarModel = (typeof CAR_MODELS)[number];

export const PROP_MODELS = [
  'grandStand',
  'grandStandCovered',
  'barrierRed',
  'barrierWhite',
  'lightPostLarge',
  'flagCheckers',
  'treeSmall',
  'treeLarge',
  'tent',
  'pylon',
  'fenceStraight',
] as const;
export type PropModel = (typeof PROP_MODELS)[number];

export const TILE_MODELS: readonly TileName[] = [
  'roadStart',
  'roadStraight',
  'roadStraightLong',
  'roadCornerSmall',
  'roadCornerLarge',
  'roadCornerLarger',
];

export type ModelName = CarModel | PropModel | TileName;

export interface ModelLibrary {
  /** Loaded (or stand-in) model for a name. Clone it before adding it to a scene. */
  get(name: ModelName): Object3D;
  /** Names that failed to load and were replaced by a stand-in box. */
  failed: readonly ModelName[];
  dispose(): void;
}

export interface LoadOptions {
  baseUrl?: string;
  names: readonly ModelName[];
  onProgress?: (fraction: number) => void;
}

/** A plain box in the footprint of a tile, used if a model fails so the page keeps working. */
function standIn(name: ModelName): Object3D {
  const car = name.startsWith('raceCar');
  const size = car ? new Vector3(0.5, 0.3, 1.3) : new Vector3(1, 0.06, 1);
  const box = new Mesh(
    new BoxGeometry(size.x, size.y, size.z),
    new MeshStandardMaterial({ color: car ? 0xff5a1f : 0x3a3a42, roughness: 0.9 }),
  );
  box.position.y = size.y / 2;
  if (!car) box.position.set(0.5, size.y / 2, -0.5);
  const group = new Group();
  group.name = name;
  group.add(box);
  return group;
}

export async function loadModels({
  baseUrl = '/models/',
  names,
  onProgress,
}: LoadOptions): Promise<ModelLibrary> {
  const manager = new LoadingManager();
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const loaded = new Map<ModelName, Object3D>();
  const failed: ModelName[] = [];
  let done = 0;

  await Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`${baseUrl}${name}.glb`);
        gltf.scene.traverse((o) => {
          if (o instanceof Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        loaded.set(name, gltf.scene);
      } catch (error) {
        console.warn(`Model ${name} did not load; using a stand-in`, error);
        failed.push(name);
        loaded.set(name, standIn(name));
      } finally {
        done += 1;
        onProgress?.(done / names.length);
      }
    }),
  );

  return {
    failed,
    get(name) {
      const model = loaded.get(name);
      if (!model) throw new Error(`Model ${name} was not requested`);
      return model;
    },
    dispose() {
      for (const model of loaded.values()) disposeObject(model);
      loaded.clear();
    },
  };
}

export function disposeObject(root: Object3D): void {
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      const materials: Material[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) m.dispose();
    }
  });
}

/** Bounding box of a model in its own space. */
export function boundsOf(model: Object3D): Box3 {
  return new Box3().setFromObject(model);
}
