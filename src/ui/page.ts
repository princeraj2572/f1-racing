export const $ = <T extends HTMLElement>(selector: string): T | null =>
  document.querySelector<T>(selector);

export function hideLoader(): void {
  const loader = $('#loader');
  if (!loader) return;
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
}

export function setLoaderProgress(fraction: number): void {
  const pct = Math.round(fraction * 100);
  const fill = $('#loader-fill');
  const label = $('#loader-pct');
  if (fill) fill.style.transform = `scaleX(${fraction})`;
  if (label) label.textContent = String(pct);
}

export function addNote(text: string): void {
  const note = $('#sample-note');
  if (note) note.append(` ${text}`);
}
