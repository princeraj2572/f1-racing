import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { progressFromCoord } from './cameraPath';

gsap.registerPlugin(ScrollTrigger);

export interface ScrollRig {
  lenis: Lenis;
  /** Chapter coordinate: 2.5 is halfway through chapter 2. */
  coord(): number;
  /** The single 0-1 progress value that drives the camera. */
  progress(): number;
  scrollToChapter(index: number, options?: { immediate?: boolean; onComplete?: () => void }): void;
  onScroll(listener: () => void): void;
  destroy(): void;
}

export function createScrollRig(
  sections: readonly HTMLElement[],
  weights: readonly number[],
): ScrollRig {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  const listeners: (() => void)[] = [];
  let tops: number[] = [];
  let heights: number[] = [];

  const measure = (): void => {
    const y = window.scrollY;
    tops = sections.map((s) => s.getBoundingClientRect().top + y);
    heights = sections.map((s) => s.offsetHeight);
  };
  measure();

  const resizeObserver = new ResizeObserver(() => {
    measure();
    ScrollTrigger.refresh();
    listeners.forEach((l) => l());
  });
  resizeObserver.observe(document.body);

  const coord = (): number => {
    const y = window.scrollY;
    for (let i = sections.length - 1; i >= 0; i--) {
      const top = tops[i] ?? 0;
      if (y >= top) {
        const h = Math.max(1, heights[i] ?? 1);
        return i + Math.min(1, (y - top) / h);
      }
    }
    return 0;
  };

  lenis.on('scroll', () => {
    ScrollTrigger.update();
    listeners.forEach((l) => l());
  });
  const raf = (time: number): void => lenis.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    coord,
    progress: () => progressFromCoord(coord(), weights),
    scrollToChapter(index, { immediate = false, onComplete } = {}) {
      const target = tops[Math.max(0, Math.min(sections.length - 1, index))] ?? 0;
      lenis.scrollTo(target, {
        immediate,
        duration: 1.8,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        onComplete,
      });
    },
    onScroll(listener) {
      listeners.push(listener);
    },
    destroy() {
      resizeObserver.disconnect();
      gsap.ticker.remove(raf);
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    },
  };
}
