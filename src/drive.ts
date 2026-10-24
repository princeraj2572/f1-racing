export interface DriveState {
  x: number;
  z: number;
  /** Yaw in radians; the car faces (sin h, cos h). */
  h: number;
  /** Signed speed in world units per second. */
  v: number;
}

export interface DriveInput {
  throttle: number;
  steer: number;
}

const MAX_SPEED = 3.2;
const MAX_REVERSE = 1;
const GRASS_SPEED = 1;
const ACCEL = 2.4;
const BRAKE = 5;
const DRAG = 0.6;
const STEER_RATE = 2.2;

/** Advances the car one step. Pure so it can be tested without a renderer. */
export function stepDrive(
  s: DriveState,
  input: DriveInput,
  dt: number,
  offRoad: boolean,
): DriveState {
  let v = s.v;
  if (input.throttle > 0) v += (v < 0 ? BRAKE : ACCEL) * dt;
  else if (input.throttle < 0) v -= (v > 0 ? BRAKE : ACCEL * 0.6) * dt;
  else v -= Math.sign(v) * Math.min(Math.abs(v), DRAG * dt);
  const top = offRoad ? GRASS_SPEED : MAX_SPEED;
  if (v > top) v = Math.max(top, v - BRAKE * dt);
  v = Math.max(-MAX_REVERSE, v);
  // Steering bites with speed, and flips when reversing
  const h = s.h + input.steer * STEER_RATE * Math.min(1, Math.abs(v)) * Math.sign(v) * dt;
  return { x: s.x + Math.sin(h) * v * dt, z: s.z + Math.cos(h) * v * dt, h, v };
}

const BINDINGS: [string[], 'throttle' | 'steer', number][] = [
  [['w', 'arrowup'], 'throttle', 1],
  [['s', 'arrowdown'], 'throttle', -1],
  [['a', 'arrowleft'], 'steer', 1],
  [['d', 'arrowright'], 'steer', -1],
];

/** Tracks held keys. Steer is +1 for left (h increases). */
export function createDriveInput(): { read(): DriveInput; destroy(): void } {
  const down = new Set<string>();
  const onDown = (e: KeyboardEvent): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    down.add(e.key.toLowerCase());
    if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  };
  const onUp = (e: KeyboardEvent): void => void down.delete(e.key.toLowerCase());
  const clear = (): void => down.clear();
  // On-screen pad: each button holds a virtual key while a finger is on it
  const held = new Map<number, string>();
  const press = (e: PointerEvent): void => {
    const key = (e.target as HTMLElement).dataset.key;
    if (!key) return;
    held.set(e.pointerId, key);
    down.add(key);
    e.preventDefault();
  };
  const release = (e: PointerEvent): void => {
    const key = held.get(e.pointerId);
    if (key) down.delete(key);
    held.delete(e.pointerId);
  };
  const pad = document.getElementById('drive-pad');
  pad?.addEventListener('pointerdown', press);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', clear);
  return {
    read() {
      const out: DriveInput = { throttle: 0, steer: 0 };
      for (const [keys, axis, sign] of BINDINGS) {
        if (keys.some((k) => down.has(k))) out[axis] += sign;
      }
      if (down.has(' ')) out.throttle = Math.min(out.throttle, -1);
      return out;
    },
    destroy() {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
      pad?.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    },
  };
}
