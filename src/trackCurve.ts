import { CatmullRomCurve3, Vector3 } from 'three';
import type { PathSampler } from './cameraPath';
import { TRACK, tileWaypoints } from './track';
import type { TilePlacement } from './track';

/** Height of the road surface in world units. */
export const ROAD_Y = 0.02;

/** Closed curve through the centreline of every tile, in driving order. */
export function buildTrackCurve(track: readonly TilePlacement[] = TRACK): CatmullRomCurve3 {
  const points: Vector3[] = [];
  for (const tile of track) {
    const waypoints = tileWaypoints(tile);
    // The exit of one tile is the entry of the next, so drop the duplicate point.
    for (const w of waypoints.slice(0, -1)) points.push(new Vector3(w.x, ROAD_Y, w.z));
  }
  return new CatmullRomCurve3(points, true, 'centripetal');
}

const wrap01 = (t: number): number => ((t % 1) + 1) % 1;

/** Adapts a curve to the pure camera-path interface. */
export function curveSampler(curve: CatmullRomCurve3): PathSampler {
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of curve.points) {
    bounds.minX = Math.min(bounds.minX, p.x);
    bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.minZ = Math.min(bounds.minZ, p.z);
    bounds.maxZ = Math.max(bounds.maxZ, p.z);
  }
  const centre = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: 0,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
  return {
    centre,
    pointAt(t) {
      const p = curve.getPointAt(wrap01(t));
      return { x: p.x, y: p.y, z: p.z };
    },
    tangentAt(t) {
      const v = curve.getTangentAt(wrap01(t));
      v.y = 0;
      v.normalize();
      return { x: v.x, y: 0, z: v.z };
    },
  };
}
