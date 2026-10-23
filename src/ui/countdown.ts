export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function timeLeft(targetMs: number, nowMs: number): TimeLeft {
  const diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    done: diff === 0,
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Keeps a countdown block up to date. Returns a function that stops it. */
export function bindCountdown(root: HTMLElement): () => void {
  const target = Date.parse(root.dataset.countdown ?? '');
  if (Number.isNaN(target)) return () => undefined;
  const cells = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-unit]').forEach((el) => {
    if (el.dataset.unit) cells.set(el.dataset.unit, el);
  });
  const label = root.querySelector<HTMLElement>('.countdown__label');

  const update = (): void => {
    const left = timeLeft(target, Date.now());
    cells.get('days')?.replaceChildren(String(left.days));
    cells.get('hours')?.replaceChildren(pad(left.hours));
    cells.get('minutes')?.replaceChildren(pad(left.minutes));
    cells.get('seconds')?.replaceChildren(pad(left.seconds));
    if (left.done && label && root.dataset.done) label.textContent = root.dataset.done;
  };
  update();
  const id = window.setInterval(update, 1000);
  return () => window.clearInterval(id);
}
