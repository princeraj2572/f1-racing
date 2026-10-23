// Where each car sits relative to the hero car. Pure, so it can be tested without a GPU.
import { clamp01, lerp, smoothstep } from './cameraPath';

export interface Slot {
  /** Offset along the lap, as a fraction of the lap (positive = ahead of the hero). */
  dt: number;
  /** Sideways offset in world units (positive = to the right of travel). */
  lane: number;
  /** 0 = hidden, 1 = full size. */
  scale: number;
}

/** Four cars driving in a loose convoy along the back straight. */
const CONVOY: readonly Pick<Slot, 'dt' | 'lane'>[] = [
  { dt: 0, lane: 0 },
  { dt: 0.06, lane: 0.24 },
  { dt: -0.06, lane: -0.24 },
  { dt: -0.12, lane: 0.24 },
];

/** Two-by-two grid, hero on the front row. */
const GRID: readonly Pick<Slot, 'dt' | 'lane'>[] = [
  { dt: 0, lane: -0.26 },
  { dt: 0, lane: 0.26 },
  { dt: -0.052, lane: -0.26 },
  { dt: -0.052, lane: 0.26 },
];

export const FIELD_SIZE = CONVOY.length;

/**
 * `formation` runs 0 (hero alone) to 1 (convoy) to 2 (grid). Car 0 is the hero and is always
 * visible; the others grow in as the formation passes 0 and then slide into their grid slots.
 */
export function formationSlot(index: number, formation: number): Slot {
  const convoy = CONVOY[index];
  const grid = GRID[index];
  if (!convoy || !grid) throw new Error(`No formation slot for car ${index}`);
  const toGrid = smoothstep(clamp01(formation - 1));
  return {
    dt: lerp(convoy.dt, grid.dt, toGrid),
    lane: lerp(convoy.lane, grid.lane, toGrid),
    scale: index === 0 ? 1 : smoothstep(clamp01(formation)),
  };
}
