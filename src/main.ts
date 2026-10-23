import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import './styles/tokens.css';
import './styles/base.css';
import { content } from './content';
import { detectCapabilities } from './ui/capabilities';
import { bindCountdown } from './ui/countdown';
import { bindNotifyForm } from './ui/form';
import { addNote, hideLoader, setLoaderProgress } from './ui/page';

const root = document.documentElement;

/** No WebGL or reduced motion: the whole story as plain sections with still images and fades. */
function enterStaticMode(reason: 'no-webgl' | 'reduced-motion'): void {
  root.classList.add('is-static');
  if (reason === 'no-webgl') addNote(content.fallback.noWebgl);
  document.querySelectorAll<HTMLImageElement>('img[data-still]').forEach((img) => {
    img.addEventListener('error', () => img.closest('.still')?.remove(), { once: true });
    img.src = `/stills/${img.dataset.still}.jpg`;
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll('.stage > *').forEach((el) => io.observe(el));
  setLoaderProgress(1);
  hideLoader();
}

function main(): void {
  document.querySelectorAll<HTMLFormElement>('#notify').forEach(bindNotifyForm);
  document.querySelectorAll<HTMLElement>('[data-countdown]').forEach(bindCountdown);

  const caps = detectCapabilities();
  if (!caps.webgl) return enterStaticMode('no-webgl');
  if (caps.reducedMotion) return enterStaticMode('reduced-motion');

  // The 3D scene, GSAP and Lenis load as a separate chunk so the text paints first
  import('./experience')
    .then(({ startFullExperience }) => startFullExperience(caps.quality))
    .catch((error: unknown) => {
      console.error('3D scene failed; showing the still version', error);
      enterStaticMode('no-webgl');
    });
}

main();
