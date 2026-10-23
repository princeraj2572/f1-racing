import type { Quality } from '../scene/world';

export interface Capabilities {
  webgl: boolean;
  reducedMotion: boolean;
  quality: Quality;
}

export interface QualityInput {
  width: number;
  coarsePointer: boolean;
  cores: number;
}

/** Phones, tablets and weak machines get fewer props, simpler shadows and a lower resolution. */
export function qualityFor({ width, coarsePointer, cores }: QualityInput): Quality {
  if (width <= 820 || coarsePointer || cores <= 2) return 'low';
  return 'high';
}

export function detectWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function detectCapabilities(): Capabilities {
  return {
    webgl: detectWebgl(),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    quality: qualityFor({
      width: window.innerWidth,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      cores: navigator.hardwareConcurrency || 4,
    }),
  };
}
