import { describe, expect, it } from 'vitest';
import { TRACK, TRACK_ANCHORS, TILE_DEFS, tilePorts, tileSpans, validateTrack } from '../src/track';

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value');
  return value;
}

describe('track layout', () => {
  it('has 8-12 tiles, at least 4 corners and one straight', () => {
    expect(TRACK.length).toBeGreaterThanOrEqual(8);
    expect(TRACK.length).toBeLessThanOrEqual(12);
    const report = validateTrack();
    expect(report.corners).toBeGreaterThanOrEqual(4);
    expect(report.straights).toBeGreaterThanOrEqual(1);
  });

  it('connects every tile to the next and closes the loop', () => {
    const report = validateTrack();
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('reports the first tile of the loop as the start line', () => {
    expect(TRACK[0]?.tile).toBe('roadStart');
  });

  it('detects a broken connection', () => {
    const broken = TRACK.map((t, i) => (i === 3 ? { ...t, col: t.col + 1 } : t));
    const report = validateTrack(broken);
    expect(report.ok).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it('detects overlapping tiles', () => {
    const overlapping = [...TRACK.slice(0, 5), { ...must(TRACK[4]) }];
    expect(validateTrack(overlapping).ok).toBe(false);
  });

  it('exits a corner turning right (clockwise)', () => {
    const corner = must(TRACK.find((t) => TILE_DEFS[t.tile].kind === 'corner'));
    const { entry, exit } = tilePorts(corner);
    // heading rotated clockwise by 90 degrees: (hx, hz) -> (-hz, hx)
    expect(exit.hx).toBe(-entry.hz);
    expect(exit.hz).toBe(entry.hx);
  });

  it('splits the lap into spans that cover 0 to 1', () => {
    const spans = tileSpans();
    expect(spans[0]?.start).toBe(0);
    expect(spans.at(-1)?.end).toBeCloseTo(1, 10);
    for (let i = 1; i < spans.length; i++)
      expect(must(spans[i]).start).toBeCloseTo(must(spans[i - 1]).end, 10);
  });
});

describe('track anchors', () => {
  const kindAt = (i: number) => TILE_DEFS[must(TRACK[i]).tile].kind;

  it('points at tiles of the expected kind', () => {
    expect(TRACK_ANCHORS.startLine).toBe(0);
    expect(kindAt(TRACK_ANCHORS.corner1)).toBe('corner');
    expect(kindAt(TRACK_ANCHORS.finalCorner)).toBe('corner');
    for (const i of TRACK_ANCHORS.straight) expect(kindAt(i)).toBe('straight');
    for (const i of TRACK_ANCHORS.backStraight) expect(kindAt(i)).toBe('straight');
    for (const i of TRACK_ANCHORS.doubleBend) expect(kindAt(i)).toBe('corner');
  });

  it('lists anchors in driving order', () => {
    const order = [
      TRACK_ANCHORS.startLine,
      TRACK_ANCHORS.corner1,
      ...TRACK_ANCHORS.straight,
      ...TRACK_ANCHORS.doubleBend,
      ...TRACK_ANCHORS.backStraight,
      TRACK_ANCHORS.finalCorner,
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i < TRACK.length)).toBe(true);
  });
});
