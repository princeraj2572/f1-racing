import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitWords } from './ui/splitText';

gsap.registerPlugin(ScrollTrigger);

const EASE = 'expo.out';

export interface ChapterAnimations {
  /** Plays the engine-start reveal of the hero. Call once the loader has gone. */
  playIntro(): void;
  revert(): void;
}

function countUp(el: HTMLElement): void {
  const text = el.dataset.count ?? el.textContent ?? '0';
  const target = Number(text);
  if (Number.isNaN(target)) return;
  const decimals = text.split('.')[1]?.length ?? 0;
  const state = { n: 0 };
  gsap.to(state, {
    n: target,
    duration: 1.4,
    ease: 'power3.out',
    onUpdate: () => {
      el.textContent = state.n.toFixed(decimals);
    },
    onComplete: () => {
      el.textContent = text;
    },
  });
}

/** Masked slide-ups for every split element, list reveals, and the hero start-up sequence. */
export function initChapterAnimations(sections: readonly HTMLElement[]): ChapterAnimations {
  let intro: gsap.core.Timeline | undefined;

  const ctx = gsap.context(() => {
    for (const section of sections) {
      const isHero = section.id === 'hero';
      const words = Array.from(section.querySelectorAll<HTMLElement>('[data-split]')).map((el) => ({
        el,
        words: splitWords(el),
      }));
      const lists = section.querySelectorAll<HTMLElement>('.schedule__row, .team, .ticket');
      const blocks = section.querySelectorAll<HTMLElement>(
        '.meta, .facts .fact, .countdown, .notify, .scroll-cue, .startup',
      );
      const scrubbed = lists.length > 0;

      const tl = gsap.timeline({
        paused: isHero,
        scrollTrigger: isHero
          ? undefined
          : { trigger: section, start: 'top 62%', toggleActions: 'play none none reverse' },
        defaults: { ease: EASE },
      });

      words.forEach(({ words: w }, i) => {
        tl.fromTo(w, { yPercent: 115 }, { yPercent: 0, duration: 0.9, stagger: 0.045 }, i * 0.12);
      });
      if (blocks.length) {
        tl.from(blocks, { opacity: 0, y: 28, duration: 0.7, stagger: 0.08 }, 0.35);
      }
      const counters = section.querySelectorAll<HTMLElement>('[data-count]');
      if (counters.length) tl.call(() => counters.forEach(countUp), [], 0.4);

      if (scrubbed) {
        // Rows reveal one after another while the chapter is pinned
        const scrub = gsap.timeline({
          scrollTrigger: { trigger: section, start: 'top 45%', end: 'bottom bottom', scrub: 0.6 },
          defaults: { ease: 'power2.out' },
        });
        scrub.from(lists, { opacity: 0, y: 36, duration: 1, stagger: 1 });
        scrub.to({}, { duration: 0.6 });
      }

      if (isHero) {
        const lamps = section.querySelectorAll<HTMLElement>('.startup__item');
        lamps.forEach((lamp, i) => tl.call(() => lamp.classList.add('is-on'), [], 0.5 + i * 0.42));
        intro = tl;
      }
    }
  });

  return {
    playIntro() {
      intro?.play(0);
    },
    revert() {
      ctx.revert();
    },
  };
}
