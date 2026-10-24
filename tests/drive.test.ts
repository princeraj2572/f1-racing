import { describe, expect, it } from 'vitest';
import { stepDrive } from '../src/drive';

const start = { x: 0, z: 0, h: 0, v: 0 };

describe('stepDrive', () => {
  it('accelerates forward along +z and caps lower on grass', () => {
    let road = start;
    let grass = start;
    for (let i = 0; i < 600; i++) {
      road = stepDrive(road, { throttle: 1, steer: 0 }, 0.016, false);
      grass = stepDrive(grass, { throttle: 1, steer: 0 }, 0.016, true);
    }
    expect(road.z).toBeGreaterThan(0);
    expect(road.v).toBeGreaterThan(grass.v);
  });

  it('does not steer while stationary', () => {
    expect(stepDrive(start, { throttle: 0, steer: 1 }, 0.1, false).h).toBe(0);
  });
});
