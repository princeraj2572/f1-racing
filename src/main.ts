import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import './styles/tokens.css';
import './styles/base.css';
import gsap from 'gsap';
import { createCameraPath, progressFromCoord } from './cameraPath';
import { initChapterAnimations } from './chapters';
import { CHAPTER_ORDER, content } from './content';
import { createScrollRig } from './scroll';
import { Stage } from './scene/stage';
import { CAR_MODELS, PROP_MODELS, TILE_MODELS, loadModels } from './scene/models';
import type { ModelName } from './scene/models';
import { TRACK, TRACK_ANCHORS, tileSpans } from './track';
import { buildTrackCurve, curveSampler } from './trackCurve';
import { detectCapabilities } from './ui/capabilities';
import { bindCountdown } from './ui/countdown';
import { bindNotifyForm } from './ui/form';
import { bindNav } from './ui/nav';

const root = document.documentElement;
const $ = <T extends HTMLElement>(selector: string): T | null =>
  document.querySelector<T>(selector);

const weights = CHAPTER_ORDER.map((id) => content.chapters[id].weight);
const sections = Array.from(document.querySelectorAll<HTMLElement>('.chapter'));

function hideLoader(): void {
  const loader = $('#loader');
  if (!loader) return;
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
}

function setLoaderProgress(fraction: number): void {
  const pct = Math.round(fraction * 100);
  const fill = $('#loader-fill');
  const label = $('#loader-pct');
  if (fill) fill.style.transform = `scaleX(${fraction})`;
  if (label) label.textContent = String(pct);
}

function addNote(text: string): void {
  const note = $('#sample-note');
  if (note) note.append(` ${text}`);
}

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

async function startFullExperience(quality: 'high' | 'low'): Promise<void> {
  const canvas = $<HTMLCanvasElement>('#stage');
  if (!canvas) throw new Error('Missing canvas');

  const curve = buildTrackCurve();
  const sampler = curveSampler(curve);
  const path = createCameraPath({
    sampler,
    weights,
    spans: tileSpans(TRACK),
    anchors: TRACK_ANCHORS,
  });

  const names: ModelName[] = [...TILE_MODELS, ...CAR_MODELS, ...PROP_MODELS];
  const library = await loadModels({ names, onProgress: setLoaderProgress });
  if (library.failed.length > 0) addNote(content.fallback.modelError);

  const stage = new Stage({ canvas, library, curve, path, quality });
  const rig = createScrollRig(sections, weights);
  const animations = initChapterAnimations(sections);
  const speedlines = $('#speedlines');
  const teamCards = Array.from(document.querySelectorAll<HTMLElement>('.team'));
  const teamsIndex = CHAPTER_ORDER.indexOf('teams');

  const goTo = (index: number): void => {
    const clamped = Math.max(0, Math.min(sections.length - 1, index));
    rig.scrollToChapter(clamped, {
      onComplete: () => {
        const section = sections[clamped];
        history.replaceState(null, '', `#${section?.id ?? ''}`);
        section?.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
      },
    });
  };

  const nav = $('.track-nav');
  const navUi = nav ? bindNav(nav, sections.length, goTo) : null;
  let active = 0;

  const sync = (): void => {
    const coord = rig.coord();
    const progress = progressFromCoord(coord, weights);
    stage.setProgress(progress);
    active = Math.max(0, Math.min(sections.length - 1, Math.floor(coord + 0.35)));
    navUi?.update(coord, active);
    const pose = path.poseAt(progress);
    if (speedlines)
      speedlines.style.opacity = String(Math.min(0.7, Math.max(0, pose.speed - 0.6) * 1.6));
    if (active === teamsIndex) {
      const local = Math.min(0.999, Math.max(0, coord - teamsIndex));
      const lit = Math.floor(local * teamCards.length);
      teamCards.forEach((card, i) => card.classList.toggle('is-active', i === lit));
    }
  };
  rig.onScroll(sync);

  sections.forEach((s) => s.querySelector<HTMLElement>('h1, h2')?.setAttribute('tabindex', '-1'));
  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (event.key === ']') goTo(active + 1);
    if (event.key === '[') goTo(active - 1);
  });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => stage.resize(window.innerWidth, window.innerHeight));
  });

  // Stop drawing when the tab is hidden or the canvas is not on screen
  let visible = true;
  let inView = true;
  const updateActive = (): void => stage.setActive(visible && inView);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    updateActive();
  });
  new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    updateActive();
  }).observe(canvas);

  gsap.ticker.add((_time, deltaMs) => stage.tick(deltaMs / 1000));

  const hash = decodeURIComponent(location.hash.slice(1));
  const hashIndex = CHAPTER_ORDER.findIndex((id) => id === hash);
  if (hashIndex > 0) rig.scrollToChapter(hashIndex, { immediate: true });
  sync();
  stage.setProgress(progressFromCoord(rig.coord(), weights), true);
  stage.tick(0.016);

  // Wait for fonts so the reveal does not jump, but never for long
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  hideLoader();
  animations.playIntro();

  if (new URLSearchParams(location.search).has('capture')) {
    // Hook for the still-image script: jump to any point of the story and draw one frame
    (window as unknown as { __apex: unknown }).__apex = {
      chapters: CHAPTER_ORDER.length,
      shoot(coord: number): void {
        stage.setProgress(progressFromCoord(coord, weights), true);
        stage.tick(0.016);
      },
    };
    root.classList.add('is-capture');
  }

  const teardown = (): void => {
    animations.revert();
    rig.destroy();
    stage.dispose();
    library.dispose();
  };
  window.addEventListener('pagehide', teardown, { once: true });
  import.meta.hot?.dispose(teardown);
}

function main(): void {
  document.querySelectorAll<HTMLFormElement>('#notify').forEach(bindNotifyForm);
  document.querySelectorAll<HTMLElement>('[data-countdown]').forEach(bindCountdown);

  const caps = detectCapabilities();
  if (!caps.webgl) return enterStaticMode('no-webgl');
  if (caps.reducedMotion) return enterStaticMode('reduced-motion');

  startFullExperience(caps.quality).catch((error: unknown) => {
    console.error('3D scene failed; showing the still version', error);
    enterStaticMode('no-webgl');
  });
}

main();
