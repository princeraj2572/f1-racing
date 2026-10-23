import { describe, expect, it } from 'vitest';
import { skyMood } from '../src/sky';

describe('skyMood', () => {
  it('starts low and warm at dawn and ends low and dim at dusk', () => {
    const dawn = skyMood(0);
    const dusk = skyMood(1);
    expect(dawn.sunElevation).toBeLessThan(10);
    expect(dusk.sunElevation).toBeLessThan(10);
    expect(dusk.sunIntensity).toBeLessThan(dawn.sunIntensity);
  });

  it('is brightest around midday', () => {
    expect(skyMood(0.55).sunElevation).toBeGreaterThan(skyMood(0).sunElevation);
    expect(skyMood(0.55).sunElevation).toBeGreaterThan(skyMood(1).sunElevation);
  });

  it('clamps out-of-range input', () => {
    expect(skyMood(-2)).toEqual(skyMood(0));
    expect(skyMood(9)).toEqual(skyMood(1));
  });

  it('blends continuously', () => {
    let last = skyMood(0).sunElevation;
    for (let i = 1; i <= 100; i++) {
      const e = skyMood(i / 100).sunElevation;
      expect(Math.abs(e - last)).toBeLessThan(3);
      last = e;
    }
  });
});
