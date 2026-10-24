import gsap from 'gsap';
import { createDriveInput, stepDrive } from './drive';
import type { DriveState } from './drive';
import { createCameraPath, progressFromCoord } from './cameraPath';
import { initChapterAnimations } from './chapters';
import { CHAPTER_ORDER, content } from './content';
import { createScrollRig } from './scroll';
import { CAR_MODELS, PROP_MODELS, TILE_MODELS, loadModels } from './scene/models';
import type { ModelName } from './scene/models';
import { Stage } from './scene/stage';
import { TRACK, TRACK_ANCHORS, tileSpans } from './track';
import { buildTrackCurve, curveSampler } from './trackCurve';
import { bindNav } from './ui/nav';
import { $, addNote, hideLoader, setLoaderProgress } from './ui/page';

const root = document.documentElement;
const weights = CHAPTER_ORDER.map((id) => content.chapters[id].weight);
const sections = Array.from(document.querySelectorAll<HTMLElement>('.chapter'));

export async function startFullExperience(quality: 'high' | 'low'): Promise<void> {
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

  // Drive mode: freeze the scroll story and hand the car to the keyboard
  const driveBtn = $<HTMLButtonElement>('#drive');
  let drive: DriveState | null = null;
  const input = createDriveInput();
  const setDrive = (on: boolean): void => {
    drive = on ? stage.startState() : null;
    if (drive) stage.snapChase(drive);
    root.classList.toggle('is-driving', on);
    if (on) rig.lenis.stop();
    else rig.lenis.start();
    stage.setDriving(on);
    const label = driveBtn?.querySelector('span');
    if (label) label.textContent = on ? 'Exit' : 'Drive';
  };
  if (driveBtn) {
    driveBtn.hidden = false;
    driveBtn.addEventListener('click', () => setDrive(!drive));
  }
  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (event.key.toLowerCase() === 'g') setDrive(!drive);
    if (event.key === 'Escape' && drive) setDrive(false);
  });

  gsap.ticker.add((_time, deltaMs) => {
    const dt = deltaMs / 1000;
    if (!drive) return stage.tick(dt);
    const step = Math.min(dt, 0.05);
    drive = stepDrive(drive, input.read(), step, stage.distanceToRoad(drive.x, drive.z) > 0.45);
    stage.driveTick(drive, step);
  });

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
    input.destroy();
    stage.dispose();
    library.dispose();
  };
  window.addEventListener('pagehide', teardown, { once: true });
  import.meta.hot?.dispose(teardown);
}
