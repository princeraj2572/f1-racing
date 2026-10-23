import { describe, expect, it } from 'vitest';
import { qualityFor } from '../src/ui/capabilities';

describe('qualityFor', () => {
  it('gives desktops the full scene', () => {
    expect(qualityFor({ width: 1440, coarsePointer: false, cores: 8 })).toBe('high');
  });

  it.each([360, 390, 430, 820])('simplifies the scene at %ipx wide', (width) => {
    expect(qualityFor({ width, coarsePointer: false, cores: 8 })).toBe('low');
  });

  it('simplifies the scene on touch devices and weak machines', () => {
    expect(qualityFor({ width: 1440, coarsePointer: true, cores: 8 })).toBe('low');
    expect(qualityFor({ width: 1440, coarsePointer: false, cores: 2 })).toBe('low');
  });
});
