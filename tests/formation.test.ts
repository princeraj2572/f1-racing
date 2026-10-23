import { describe, expect, it } from 'vitest';
import { FIELD_SIZE, formationSlot } from '../src/formation';

describe('formationSlot', () => {
  it('keeps the hero visible and the rest hidden when there is no formation', () => {
    expect(formationSlot(0, 0).scale).toBe(1);
    for (let i = 1; i < FIELD_SIZE; i++) expect(formationSlot(i, 0).scale).toBe(0);
  });

  it('shows every car by the time the convoy forms', () => {
    for (let i = 0; i < FIELD_SIZE; i++) expect(formationSlot(i, 1).scale).toBe(1);
  });

  it('moves the field onto a 2x2 grid in the finale', () => {
    const lanes = Array.from({ length: FIELD_SIZE }, (_, i) => formationSlot(i, 2));
    expect(new Set(lanes.map((s) => s.dt.toFixed(6))).size).toBe(2);
    expect(new Set(lanes.map((s) => s.lane.toFixed(6))).size).toBe(2);
    expect(Math.max(...lanes.map((s) => s.dt))).toBeCloseTo(0, 9);
  });

  it('never puts two cars on top of each other in the convoy or on the grid', () => {
    const LAP = 19.4;
    for (const f of [1, 1.25, 1.5, 1.75, 2]) {
      for (let a = 0; a < FIELD_SIZE; a++) {
        for (let b = a + 1; b < FIELD_SIZE; b++) {
          const sa = formationSlot(a, f);
          const sb = formationSlot(b, f);
          const along = Math.abs(sa.dt - sb.dt) * LAP;
          const across = Math.abs(sa.lane - sb.lane);
          // Car footprint is about 0.84 long by 0.34 wide
          const clear = along > 0.84 || across > 0.34;
          expect(clear, `cars ${a} and ${b} at formation ${f}`).toBe(true);
        }
      }
    }
  });

  it('throws for a car that does not exist', () => {
    expect(() => formationSlot(FIELD_SIZE, 1)).toThrow();
  });
});
