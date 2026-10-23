import { describe, expect, it } from 'vitest';
import {
  chapterCoord,
  chapterStart,
  createCameraPath,
  monotone,
  type Pose,
  type V3,
} from '../src/cameraPath';
import { CHAPTER_ORDER, content } from '../src/content';
import { TRACK, TRACK_ANCHORS, tileSpans } from '../src/track';
import { buildTrackCurve, curveSampler } from '../src/trackCurve';

const weights = CHAPTER_ORDER.map((id) => content.chapters[id].weight);
const path = createCameraPath({
  sampler: curveSampler(buildTrackCurve()),
  weights,
  spans: tileSpans(TRACK),
  anchors: TRACK_ANCHORS,
});

const dist = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const horizontal = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.z - b.z);

describe('chapterCoord', () => {
  it('maps 0 and 1 to the start and end', () => {
    expect(chapterCoord(0, weights)).toBe(0);
    expect(chapterCoord(1, weights)).toBeCloseTo(weights.length, 10);
  });

  it('clamps progress outside 0-1', () => {
    expect(chapterCoord(-3, weights)).toBe(0);
    expect(chapterCoord(7, weights)).toBeCloseTo(weights.length, 10);
  });

  it('gives longer chapters more scroll', () => {
    expect(chapterCoord(chapterStart(3, weights), weights)).toBeCloseTo(3, 10);
    expect(chapterCoord(chapterStart(5, weights), weights)).toBeCloseTo(5, 10);
    const mid = (chapterStart(4, weights) + chapterStart(5, weights)) / 2;
    expect(chapterCoord(mid, weights)).toBeCloseTo(4.5, 10);
  });

  it('is monotonic', () => {
    let last = -1;
    for (let i = 0; i <= 200; i++) {
      const c = chapterCoord(i / 200, weights);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
  });
});

describe('monotone interpolation', () => {
  const f = monotone([0, 1, 2, 3], [0, 0, 5, 5]);
  it('hits the stops and never overshoots', () => {
    expect(f(1)).toBeCloseTo(0, 10);
    expect(f(2)).toBeCloseTo(5, 10);
    for (let x = 0; x <= 3; x += 0.05) {
      expect(f(x)).toBeGreaterThanOrEqual(-1e-9);
      expect(f(x)).toBeLessThanOrEqual(5 + 1e-9);
    }
  });
});

describe('camera pose at key scroll values', () => {
  const at = (chapter: number, local = 0): Pose =>
    path.poseAt(chapterStart(chapter, weights) + local * 0.0001);

  it('starts behind and above the car on the grid', () => {
    const pose = path.poseAt(0);
    const car = curveSampler(buildTrackCurve()).pointAt(pose.carT);
    expect(pose.chapter).toBe(0);
    expect(pose.position.y).toBeGreaterThan(car.y + 0.3);
    expect(horizontal(pose.position, car)).toBeGreaterThan(1);
    expect(horizontal(pose.position, car)).toBeLessThan(4);
    expect(pose.formation).toBe(0);
    expect(pose.sky).toBe(0);
  });

  it('is looking straight down at the end', () => {
    const pose = path.poseAt(1);
    expect(pose.chapter).toBe(CHAPTER_ORDER.length - 1);
    expect(pose.position.y).toBeGreaterThan(4);
    expect(horizontal(pose.position, pose.target)).toBeLessThan(0.01);
    expect(pose.sky).toBe(1);
    expect(pose.formation).toBe(2);
  });

  it('shows a top-down overview during the track chapter', () => {
    const pose = path.poseAt(
      chapterStart(1, weights) + (chapterStart(2, weights) - chapterStart(1, weights)) * 0.35,
    );
    expect(pose.position.y).toBeGreaterThan(6);
    expect(horizontal(pose.position, pose.target)).toBeLessThan(0.5);
  });

  it('comes down to ground level for corner one', () => {
    expect(at(2).position.y).toBeLessThan(1.5);
  });

  it('whips with roll and a wider lens mid corner one', () => {
    const start = chapterStart(2, weights);
    const end = chapterStart(3, weights);
    const mid = path.poseAt(start + (end - start) * 0.55);
    expect(Math.abs(mid.roll)).toBeGreaterThan(0.08);
    expect(mid.fov).toBeGreaterThan(path.poseAt(0).fov + 15);
  });

  it('pulls the camera back and widens the lens along the straight', () => {
    const car = (p: Pose): number =>
      horizontal(p.position, curveSampler(buildTrackCurve()).pointAt(p.carT));
    const start = chapterStart(3, weights);
    const end = chapterStart(4, weights);
    const early = path.poseAt(start + (end - start) * 0.05);
    const late = path.poseAt(start + (end - start) * 0.9);
    expect(car(late)).toBeGreaterThan(car(early) + 1);
    expect(late.fov).toBeGreaterThan(early.fov);
    expect(late.speed).toBeGreaterThan(0.8);
  });

  it('shows the field of cars on the back straight during the teams chapter', () => {
    const start = chapterStart(5, weights);
    const end = chapterStart(6, weights);
    expect(path.poseAt((start + end) / 2).formation).toBeCloseTo(1, 1);
  });

  it('never moves the hero backwards along the lap', () => {
    let last = -1;
    for (let i = 0; i <= 500; i++) {
      const t = path.poseAt(i / 500).carT;
      expect(t).toBeGreaterThanOrEqual(last - 1e-6);
      last = t;
    }
  });

  it('moves smoothly: no jump bigger than a tile between small scroll steps', () => {
    let previous = path.poseAt(0);
    for (let i = 1; i <= 2000; i++) {
      const pose = path.poseAt(i / 2000);
      expect(dist(pose.position, previous.position)).toBeLessThan(0.6);
      previous = pose;
    }
  });

  it('keeps every value finite', () => {
    for (let i = 0; i <= 100; i++) {
      const p = path.poseAt(i / 100);
      for (const n of [
        p.position.x,
        p.position.y,
        p.position.z,
        p.target.x,
        p.target.y,
        p.target.z,
        p.fov,
        p.roll,
        p.sky,
        p.speed,
      ]) {
        expect(Number.isFinite(n)).toBe(true);
      }
    }
  });
});
