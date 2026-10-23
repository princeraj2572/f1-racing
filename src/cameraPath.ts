// Maps ONE scroll progress value (0-1) to a camera pose, car position and scene mood.
// Pure: no DOM, no three.js. The track is passed in as a sampler so tests can use a fake one.
import type { TileSpan, TrackAnchors } from './track';

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export interface PathSampler {
  /** Point on the centreline at lap fraction t (0-1, wraps). */
  pointAt(t: number): V3;
  /** Unit horizontal heading at lap fraction t. */
  tangentAt(t: number): V3;
  /** Centre of the whole track, used by the overview shot. */
  centre: V3;
}

export interface Pose {
  position: V3;
  target: V3;
  fov: number;
  /** Camera roll in radians, used for the corner whip. */
  roll: number;
  /** Hero car position as a lap fraction. */
  carT: number;
  /** 0 (dawn) to 1 (dusk). */
  sky: number;
  /** 0-1, drives speed lines and engine rumble. */
  speed: number;
  /** 0 = no field cars, 1 = staggered on the back straight, 2 = lined up on the grid. */
  formation: number;
  /** Chapter index and progress inside it. */
  chapter: number;
  chapterProgress: number;
}

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/**
 * Converts overall progress into a chapter coordinate: 2.5 means halfway through chapter 2.
 * Chapters take scroll length in proportion to their weights.
 */
export function chapterCoord(progress: number, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || total <= 0) return 0;
  let remaining = clamp01(progress) * total;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (remaining <= w || i === weights.length - 1)
      return i + (w > 0 ? Math.min(1, remaining / w) : 0);
    remaining -= w;
  }
  return weights.length;
}

/** Progress at which chapter i starts. */
export function chapterStart(i: number, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let sum = 0;
  for (let k = 0; k < i; k++) sum += weights[k] ?? 0;
  return total > 0 ? sum / total : 0;
}

/** Monotone cubic (Fritsch-Carlson) interpolation: smooth, with no overshoot between stops. */
export function monotone(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length;
  const first = ys[0] ?? 0;
  if (n < 2) return () => first;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] ?? 0) - (xs[i] ?? 0);
    d.push(dx > 0 ? ((ys[i + 1] ?? 0) - (ys[i] ?? 0)) / dx : 0);
  }
  const m: number[] = [d[0] ?? 0];
  for (let i = 1; i < n - 1; i++) {
    const a = d[i - 1] ?? 0;
    const b = d[i] ?? 0;
    m.push(a * b <= 0 ? 0 : (2 * a * b) / (a + b));
  }
  m.push(d[n - 2] ?? 0);
  return (x: number) => {
    if (x <= (xs[0] ?? 0)) return first;
    if (x >= (xs[n - 1] ?? 0)) return ys[n - 1] ?? first;
    let i = 0;
    while (i < n - 2 && x > (xs[i + 1] ?? 0)) i++;
    const x0 = xs[i] ?? 0;
    const h = (xs[i + 1] ?? 0) - x0;
    const t = (x - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y0 = ys[i] ?? 0;
    const y1 = ys[i + 1] ?? 0;
    return (
      (2 * t3 - 3 * t2 + 1) * y0 +
      (t3 - 2 * t2 + t) * h * (m[i] ?? 0) +
      (-2 * t3 + 3 * t2) * y1 +
      (t3 - t2) * h * (m[i + 1] ?? 0)
    );
  };
}

/** Camera placement relative to the car, in tile units. */
interface Rig {
  /** Distance behind the car along its heading. */
  back: number;
  /** Offset to the car's right (negative = left). */
  side: number;
  height: number;
  /** How far ahead of the car the camera looks. */
  look: number;
  lookY: number;
  /** 0 = follow the car, 1 = look straight down. */
  top: number;
  topHeight: number;
  /** For the top view: 0 = centre on the whole track, 1 = centre on the car. */
  topFocus: number;
}

interface Stop extends Rig {
  /** Chapter coordinate where this stop applies. */
  at: number;
  /** Car position as a lap fraction. */
  carT: number;
  fov: number;
  roll: number;
  sky: number;
  speed: number;
  formation: number;
}

const CHANNELS = [
  'carT',
  'back',
  'side',
  'height',
  'look',
  'lookY',
  'top',
  'topHeight',
  'topFocus',
  'fov',
  'roll',
  'sky',
  'speed',
  'formation',
] as const;

type Channel = (typeof CHANNELS)[number];

const chase: Rig = {
  back: 1.9,
  side: 0,
  height: 0.9,
  look: 1.4,
  lookY: 0.1,
  top: 0,
  topHeight: 10,
  topFocus: 0,
};

/**
 * The shot list. Stops are in chapter coordinates (chapter index + progress inside it) and the
 * car position is given relative to the track anchors, so editing src/track.ts moves the story.
 */
export function buildStops(spans: readonly TileSpan[], anchors: TrackAnchors): Stop[] {
  const span = (i: number): TileSpan => {
    const s = spans[i];
    if (!s) throw new Error(`Track anchor ${i} is outside the track`);
    return s;
  };
  const at = (tile: number, f: number): number => lerp(span(tile).start, span(tile).end, f);
  const lastOf = (list: readonly number[]): number => list[list.length - 1] ?? 0;
  const firstOf = (list: readonly number[]): number => list[0] ?? 0;
  const base = { roll: 0, speed: 0, formation: 0 };

  const startLine = at(anchors.startLine, 0.1);
  const c1In = at(anchors.corner1, 0) - 0.045;
  const c1Mid = at(anchors.corner1, 0.5);
  const c1Out = at(anchors.corner1, 1);
  const stIn = at(firstOf(anchors.straight), 0.12);
  const stOut = at(lastOf(anchors.straight), 1);
  const bendIn = at(firstOf(anchors.doubleBend), 0.05);
  const bendMid = at(firstOf(anchors.doubleBend), 0.7);
  const bendMid2 = at(lastOf(anchors.doubleBend), 0.5);
  const bendOut = at(lastOf(anchors.doubleBend), 1);
  const bsIn = at(firstOf(anchors.backStraight), 0.15);
  const bsMid = at(lastOf(anchors.backStraight), 0.2);
  const bsOut = at(lastOf(anchors.backStraight), 0.95);
  const finalMid = at(anchors.finalCorner, 0.5);
  const finalOut = at(anchors.finalCorner, 1);

  return [
    // 0 Hero: low behind the car on the grid
    { ...chase, ...base, at: 0, carT: startLine, fov: 42, sky: 0 },
    { ...chase, ...base, at: 0.9, carT: startLine, back: 1.5, height: 0.7, fov: 40, sky: 0.04 },
    // 1 Track: lift into a top-down overview, then drop to ground level at turn one
    { ...chase, ...base, at: 1.0, carT: startLine, back: 1.5, height: 0.8, fov: 40, sky: 0.08 },
    {
      ...chase,
      ...base,
      at: 1.3,
      carT: startLine,
      top: 1,
      topHeight: 12,
      fov: 38,
      sky: 0.12,
      speed: 0.1,
    },
    {
      ...chase,
      ...base,
      at: 1.65,
      carT: lerp(startLine, c1In, 0.4),
      top: 1,
      topHeight: 7.5,
      topFocus: 0.35,
      fov: 40,
      sky: 0.16,
      speed: 0.2,
    },
    {
      ...chase,
      ...base,
      at: 2.0,
      carT: c1In,
      back: 2.0,
      height: 1.0,
      fov: 48,
      sky: 0.2,
      speed: 0.4,
    },
    // 2 Corner 1: whip around the tight right-hander
    {
      ...chase,
      ...base,
      at: 2.3,
      carT: lerp(c1In, c1Mid, 0.6),
      back: 1.8,
      height: 0.8,
      fov: 52,
      sky: 0.24,
      speed: 0.55,
    },
    {
      ...chase,
      ...base,
      at: 2.55,
      carT: c1Mid,
      back: 0.3,
      side: -1.5,
      height: 0.6,
      look: 0.5,
      fov: 66,
      roll: 0.14,
      sky: 0.27,
      speed: 0.7,
    },
    {
      ...chase,
      ...base,
      at: 2.8,
      carT: c1Out,
      back: 2.2,
      side: 0.3,
      height: 0.9,
      fov: 54,
      roll: -0.04,
      sky: 0.3,
      speed: 0.8,
    },
    // 3 Straight: floor it and pull the camera back
    {
      ...chase,
      ...base,
      at: 3.0,
      carT: stIn,
      back: 2.6,
      height: 1.1,
      fov: 56,
      sky: 0.34,
      speed: 0.9,
    },
    {
      ...chase,
      ...base,
      at: 3.6,
      carT: lerp(stIn, stOut, 0.65),
      back: 4.6,
      height: 1.7,
      look: 2.2,
      fov: 68,
      sky: 0.4,
      speed: 1,
    },
    {
      ...chase,
      ...base,
      at: 4.0,
      carT: stOut,
      back: 5.4,
      height: 2.1,
      look: 2.4,
      fov: 70,
      sky: 0.46,
      speed: 0.9,
    },
    // 4 Schedule: side shots through the double bend
    {
      ...chase,
      ...base,
      at: 4.2,
      carT: bendIn,
      back: 2.6,
      side: 1.8,
      height: 1.2,
      look: 1.2,
      fov: 52,
      sky: 0.5,
      speed: 0.7,
    },
    {
      ...chase,
      ...base,
      at: 4.55,
      carT: bendMid,
      back: -0.4,
      side: 2.6,
      height: 1.3,
      look: 0.4,
      fov: 48,
      roll: -0.05,
      sky: 0.54,
      speed: 0.6,
    },
    {
      ...chase,
      ...base,
      at: 4.8,
      carT: bendMid2,
      back: 0.4,
      side: -2.5,
      height: 1.2,
      look: 0.6,
      fov: 50,
      roll: 0.05,
      sky: 0.58,
      speed: 0.6,
    },
    {
      ...chase,
      ...base,
      at: 5.0,
      carT: bendOut,
      back: 2.0,
      side: 0,
      height: 0.9,
      fov: 46,
      sky: 0.62,
      speed: 0.6,
    },
    // 5 Teams: slow side-on pass along the line of livery cars
    {
      ...chase,
      ...base,
      at: 5.1,
      carT: bsIn,
      back: 0.4,
      side: 1.9,
      height: 0.55,
      look: 0.6,
      fov: 44,
      sky: 0.66,
      speed: 0.1,
      formation: 1,
    },
    {
      ...chase,
      ...base,
      at: 5.6,
      carT: bsMid,
      back: -0.2,
      side: 1.9,
      height: 0.55,
      look: 0.4,
      fov: 44,
      sky: 0.7,
      speed: 0.1,
      formation: 1,
    },
    {
      ...chase,
      ...base,
      at: 6.0,
      carT: bsOut,
      back: 1.4,
      side: 1.6,
      height: 0.8,
      look: 0.9,
      fov: 46,
      sky: 0.74,
      speed: 0.1,
      formation: 1,
    },
    // 6 Tickets: high wide shot swinging round the last corner towards the grandstands
    {
      ...chase,
      ...base,
      at: 6.4,
      carT: finalMid,
      back: 2.6,
      side: 2.4,
      height: 3.2,
      look: 0.8,
      lookY: 0,
      fov: 46,
      sky: 0.82,
      speed: 0.4,
      formation: 0,
    },
    {
      ...chase,
      ...base,
      at: 7.0,
      carT: finalOut,
      back: 2.4,
      height: 1.6,
      look: 1.6,
      fov: 44,
      sky: 0.9,
      speed: 0.3,
      formation: 1,
    },
    // 7 Finale: line-up on the grid seen from the side, then straight down
    {
      ...chase,
      ...base,
      at: 7.4,
      carT: 1,
      back: -0.5,
      side: 2.4,
      height: 1.2,
      look: 0.2,
      fov: 42,
      sky: 0.95,
      speed: 0,
      formation: 2,
    },
    {
      ...chase,
      ...base,
      at: 8.0,
      carT: 1,
      top: 1,
      topHeight: 5.2,
      topFocus: 1,
      fov: 40,
      sky: 1,
      speed: 0,
      formation: 2,
    },
  ];
}

export interface CameraPath {
  poseAt(progress: number): Pose;
  stops: readonly Stop[];
}

export interface CameraPathOptions {
  sampler: PathSampler;
  weights: readonly number[];
  spans: readonly TileSpan[];
  anchors: TrackAnchors;
}

const wrap01 = (t: number): number => ((t % 1) + 1) % 1;

export function createCameraPath(options: CameraPathOptions): CameraPath {
  const { sampler, weights } = options;
  const stops = buildStops(options.spans, options.anchors);
  const xs = stops.map((s) => s.at);
  const channels = Object.fromEntries(
    CHANNELS.map((name) => [
      name,
      monotone(
        xs,
        stops.map((s) => s[name]),
      ),
    ]),
  ) as Record<Channel, (x: number) => number>;

  function poseAt(progress: number): Pose {
    const c = chapterCoord(progress, weights);
    const v = Object.fromEntries(CHANNELS.map((n) => [n, channels[n](c)])) as Record<
      Channel,
      number
    >;

    // The monotone fit can wobble a hair on the mix channels; keep them in range.
    const top = clamp01(v.top);
    const topFocus = clamp01(v.topFocus);
    const car = sampler.pointAt(wrap01(v.carT));
    const t = sampler.tangentAt(wrap01(v.carT));
    // Right-hand normal, clockwise from the heading (x east, z south).
    const n = { x: -t.z, y: 0, z: t.x };

    const follow = {
      x: car.x - t.x * v.back + n.x * v.side,
      y: car.y + v.height,
      z: car.z - t.z * v.back + n.z * v.side,
    };
    const followTarget = {
      x: car.x + t.x * v.look,
      y: car.y + v.lookY,
      z: car.z + t.z * v.look,
    };
    const focus = {
      x: lerp(sampler.centre.x, car.x, topFocus),
      y: 0,
      z: lerp(sampler.centre.z, car.z, topFocus),
    };
    // A tiny offset keeps the up vector well defined when looking straight down.
    const overhead = { x: focus.x, y: v.topHeight, z: focus.z + 0.001 };

    const chapter = Math.min(weights.length - 1, Math.floor(Math.min(c, weights.length - 1e-9)));
    return {
      position: {
        x: lerp(follow.x, overhead.x, top),
        y: lerp(follow.y, overhead.y, top),
        z: lerp(follow.z, overhead.z, top),
      },
      target: {
        x: lerp(followTarget.x, focus.x, top),
        y: lerp(followTarget.y, focus.y, top),
        z: lerp(followTarget.z, focus.z, top),
      },
      fov: v.fov,
      roll: v.roll,
      carT: wrap01(v.carT),
      sky: clamp01(v.sky),
      speed: clamp01(v.speed),
      formation: Math.min(2, Math.max(0, v.formation)),
      chapter,
      chapterProgress: clamp01(c - chapter),
    };
  }

  return { poseAt, stops };
}
