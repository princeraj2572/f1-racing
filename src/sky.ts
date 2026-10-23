// Sky, fog and sun mood from 0 (dawn) to 1 (dusk). Pure, so the scene and the tests share it.
import { clamp01, lerp } from './cameraPath';

export type Rgb = readonly [number, number, number];

export interface SkyMood {
  /** Colour at the top of the sky dome. */
  top: Rgb;
  /** Colour at the horizon; also used for fog. */
  horizon: Rgb;
  sun: Rgb;
  /** Sun height above the horizon in degrees; low sun gives long shadows. */
  sunElevation: number;
  sunIntensity: number;
  ambient: number;
}

const hex = (h: number): Rgb => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

const STOPS: readonly { at: number; mood: SkyMood }[] = [
  // dawn
  {
    at: 0,
    mood: {
      top: hex(0x1b1d36),
      horizon: hex(0xf0875a),
      sun: hex(0xffb27a),
      sunElevation: 7,
      sunIntensity: 2.2,
      ambient: 0.55,
    },
  },
  // early morning
  {
    at: 0.3,
    mood: {
      top: hex(0x2f4f86),
      horizon: hex(0xf2b98c),
      sun: hex(0xffd7a8),
      sunElevation: 18,
      sunIntensity: 2.8,
      ambient: 0.8,
    },
  },
  // midday
  {
    at: 0.55,
    mood: {
      top: hex(0x3a78c9),
      horizon: hex(0xb8d2ea),
      sun: hex(0xfff1dc),
      sunElevation: 38,
      sunIntensity: 3.2,
      ambient: 0.95,
    },
  },
  // golden hour
  {
    at: 0.8,
    mood: {
      top: hex(0x2a3568),
      horizon: hex(0xf59a52),
      sun: hex(0xffa860),
      sunElevation: 12,
      sunIntensity: 2.6,
      ambient: 0.7,
    },
  },
  // dusk
  {
    at: 1,
    mood: {
      top: hex(0x0e0f24),
      horizon: hex(0xc4506b),
      sun: hex(0xff7a5a),
      sunElevation: 5,
      sunIntensity: 1.8,
      ambient: 0.5,
    },
  },
];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export function skyMood(t: number): SkyMood {
  const x = clamp01(t);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (!a || !b || x > b.at) continue;
    const k = (x - a.at) / (b.at - a.at);
    return {
      top: mix(a.mood.top, b.mood.top, k),
      horizon: mix(a.mood.horizon, b.mood.horizon, k),
      sun: mix(a.mood.sun, b.mood.sun, k),
      sunElevation: lerp(a.mood.sunElevation, b.mood.sunElevation, k),
      sunIntensity: lerp(a.mood.sunIntensity, b.mood.sunIntensity, k),
      ambient: lerp(a.mood.ambient, b.mood.ambient, k),
    };
  }
  const last = STOPS[STOPS.length - 1];
  if (!last) throw new Error('No sky stops defined');
  return last.mood;
}
