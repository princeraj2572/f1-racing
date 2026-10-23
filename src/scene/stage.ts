import {
  ACESFilmicToneMapping,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { CatmullRomCurve3 } from 'three';
import type { CameraPath } from '../cameraPath';
import { content } from '../content';
import { FIELD_SIZE, formationSlot } from '../formation';
import { skyMood } from '../sky';
import { createCar } from './car';
import type { Car } from './car';
import { createLighting } from './lighting';
import type { Lighting } from './lighting';
import type { ModelLibrary } from './models';
import { createWorld } from './world';
import type { Quality, World } from './world';

/** The kit cars are about as wide as its road; scale them down so two fit side by side. */
const CAR_SCALE = 0.42;
const teams = content.chapters.teams.teams;

export interface StageOptions {
  canvas: HTMLCanvasElement;
  library: ModelLibrary;
  curve: CatmullRomCurve3;
  path: CameraPath;
  quality: Quality;
  /** Freeze camera motion and engine rumble (reduced motion). */
  calm?: boolean;
}

export class Stage {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(42, 1, 0.05, 140);
  private readonly world: World;
  private readonly lighting: Lighting;
  private readonly cars: Car[] = [];
  private readonly curve: CatmullRomCurve3;
  private readonly path: CameraPath;
  private readonly quality: Quality;
  private readonly calm: boolean;
  private target = 0;
  private current = 0;
  private lastCarT = -1;
  private dirty = true;
  private active = true;
  private width = 1;
  private height = 1;
  private elapsed = 0;
  private lastFov = 0;
  private readonly focus = new Vector3();
  private readonly lookAt = new Vector3();

  constructor({ canvas, library, curve, path, quality, calm = false }: StageOptions) {
    this.curve = curve;
    this.path = path;
    this.quality = quality;
    this.calm = calm;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: quality === 'high',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.world = createWorld({ library, curve, quality });
    this.scene.add(this.world.root);
    this.lighting = createLighting(this.scene, quality);

    // Car 0 is the hero (first team); the rest fill the convoy and the grid. Each wears its team livery.
    for (let i = 0; i < FIELD_SIZE; i++) {
      const team = teams[i];
      const car = createCar(library, team?.car ?? 'raceCarRed');
      car.object.scale.setScalar(CAR_SCALE);
      if (team) car.setColour(team.colour);
      this.cars.push(car);
      this.scene.add(car.object);
    }
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  /** Where the page is, 0-1. The stage eases towards it. */
  setProgress(progress: number, immediate = false): void {
    this.target = MathUtils.clamp(progress, 0, 1);
    if (immediate) this.current = this.target;
    this.dirty = true;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active) this.dirty = true;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const cap = this.quality === 'high' ? 2 : 1.25;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    // Push the picture away from the text: right on wide screens, up on portrait ones
    const wide = this.camera.aspect > 1.1;
    this.camera.setViewOffset(
      this.width,
      this.height,
      wide ? -this.width * 0.14 : 0,
      wide ? 0 : this.height * 0.12,
      this.width,
      this.height,
    );
    this.lastFov = 0;
    this.dirty = true;
  }

  /** Advance and draw one frame. `dt` is in seconds. */
  tick(dt: number): void {
    if (!this.active) return;
    const delta = this.target - this.current;
    const settling = Math.abs(delta) > 1e-5;
    if (settling) this.current += delta * (this.calm ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 9));
    else this.current = this.target;
    this.elapsed += dt;

    const rumble = !this.calm && this.current < 0.04;
    if (!settling && !this.dirty && !rumble) return;
    this.dirty = false;

    const pose = this.path.poseAt(this.current);
    const wrap = (t: number): number => ((t % 1) + 1) % 1;

    // Cars: hero first, then the field relative to it
    const carLength = this.curve.getLength();
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car) continue;
      const slot = formationSlot(i, pose.formation);
      car.object.visible = slot.scale > 0.01;
      if (!car.object.visible) continue;
      const t = wrap(pose.carT + slot.dt);
      const p = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t);
      tangent.y = 0;
      tangent.normalize();
      p.x += -tangent.z * slot.lane;
      p.z += tangent.x * slot.lane;
      const bob = i === 0 && rumble ? Math.sin(this.elapsed * 55) * 0.003 : 0;
      car.object.position.set(p.x, p.y + bob, p.z);
      car.object.scale.setScalar(CAR_SCALE * slot.scale);
      car.object.lookAt(p.x + tangent.x, p.y + bob, p.z + tangent.z);
      if (i === 0) {
        const travelled = (pose.carT - this.lastCarT) * carLength;
        if (this.lastCarT >= 0 && Math.abs(travelled) < 3) {
          for (const c of this.cars) c.roll(travelled * CAR_SCALE);
        }
        this.lastCarT = pose.carT;
      }
    }

    // Camera
    const jitter = rumble ? (0.0035 * (0.04 - this.current)) / 0.04 : 0;
    this.camera.position.set(
      pose.position.x + Math.sin(this.elapsed * 47) * jitter,
      pose.position.y + Math.sin(this.elapsed * 61) * jitter,
      pose.position.z,
    );
    this.lookAt.set(pose.target.x, pose.target.y, pose.target.z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.lookAt);
    if (pose.roll !== 0) this.camera.rotateZ(this.calm ? 0 : pose.roll);

    // Portrait screens need a taller field of view to keep the car in frame
    const portrait = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 0.75 : 1;
    const fov = Math.min(95, pose.fov * portrait);
    if (Math.abs(fov - this.lastFov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.lastFov = fov;
    }

    const hero = this.cars[0]?.object.position;
    this.focus.copy(hero ?? this.lookAt);
    this.lighting.update(skyMood(pose.sky), this.focus, pose.position.y);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const car of this.cars) car.dispose();
    this.cars.length = 0;
    this.lighting.dispose();
    this.world.dispose();
    this.renderer.dispose();
  }
}
