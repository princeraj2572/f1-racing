import { Box3, Color, Group, Mesh, Vector3 } from 'three';
import type { Material, MeshStandardMaterial, Object3D } from 'three';
import type { CarModel, ModelLibrary } from './models';

const WHEEL_RADIUS = 0.14;
const KEEP_MATERIALS = new Set(['carTire', 'glass']);

export interface Car {
  object: Group;
  /** Moves the car's wheels as if it travelled `distance` world units. */
  roll(distance: number): void;
  /** Recolours the body in code (no textures involved). */
  setColour(colour: string | Color): void;
  readonly baseColour: Color;
  dispose(): void;
}

function insideBody(o: Object3D): boolean {
  for (let node: Object3D | null = o; node; node = node.parent) {
    if (node.name === 'body') return true;
  }
  return false;
}

/**
 * A kit car with its pivot at the centre of its footprint on the ground, facing +z. Body
 * materials are cloned so each car can carry its own livery.
 */
export function createCar(library: ModelLibrary, model: CarModel): Car {
  const inner = library.get(model).clone(true);
  const bodyMaterials: MeshStandardMaterial[] = [];
  const owned: Material[] = [];
  const wheels: Object3D[] = [];

  inner.traverse((o) => {
    if (o.name.startsWith('wheel')) wheels.push(o);
    if (!(o instanceof Mesh) || !insideBody(o)) return;
    const source = o.material as MeshStandardMaterial;
    if (KEEP_MATERIALS.has(source.name)) return;
    const own = source.clone();
    o.material = own;
    owned.push(own);
    bodyMaterials.push(own);
  });

  inner.updateMatrixWorld(true);
  const box = new Box3().setFromObject(inner);
  const centre = box.getCenter(new Vector3());
  inner.position.set(-centre.x, -box.min.y, -centre.z);

  const object = new Group();
  object.name = model;
  object.add(inner);

  const baseColour = bodyMaterials[0]?.color.clone() ?? new Color(0xffffff);
  return {
    object,
    baseColour,
    roll(distance) {
      for (const wheel of wheels) wheel.rotateX(distance / WHEEL_RADIUS);
    },
    setColour(colour) {
      const target = colour instanceof Color ? colour : new Color(colour);
      for (const m of bodyMaterials) m.color.copy(target);
    },
    dispose() {
      for (const m of owned) m.dispose();
      object.removeFromParent();
    },
  };
}
