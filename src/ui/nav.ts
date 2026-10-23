export interface Nav {
  /** Moves the dot and fills the road to chapter coordinate `coord`, and marks the active chapter. */
  update(coord: number, active: number): void;
}

/**
 * Side navigation shaped like the track. Markers sit evenly round the lap, one per chapter, and a
 * dot travels the outline as the page scrolls. Markers are real links, so they work from the keyboard.
 */
export function bindNav(nav: HTMLElement, count: number, go: (index: number) => void): Nav {
  const svg = nav.querySelector<SVGSVGElement>('.track-nav__svg');
  const road = nav.querySelector<SVGPathElement>('.track-nav__road');
  const progress = nav.querySelector<SVGPathElement>('.track-nav__progress');
  const dot = nav.querySelector<SVGCircleElement>('.track-nav__dot');
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('[data-chapter-link]'));
  if (!svg || !road || !progress || !dot) return { update: () => undefined };

  const [vx = 0, vy = 0, vw = 1, vh = 1] = (svg.getAttribute('viewBox') ?? '')
    .split(' ')
    .map(Number);
  const total = road.getTotalLength();
  const pointAt = (fraction: number): DOMPoint =>
    road.getPointAtLength((((fraction % 1) + 1) % 1) * total);

  for (const link of links) {
    const p = pointAt(Number(link.dataset.fraction ?? 0));
    link.style.setProperty('--x', `${((p.x - vx) / vw) * 100}%`);
    link.style.setProperty('--y', `${((p.y - vy) / vh) * 100}%`);
  }

  links.forEach((link, i) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      go(i);
    });
    link.addEventListener('keydown', (event) => {
      const next =
        event.key === 'ArrowDown' || event.key === 'ArrowRight'
          ? i + 1
          : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
            ? i - 1
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? links.length - 1
                : null;
      if (next === null) return;
      event.preventDefault();
      links[Math.max(0, Math.min(links.length - 1, next))]?.focus();
    });
  });

  return {
    update(coord, active) {
      const fraction = Math.min(1, Math.max(0, coord / count));
      const p = pointAt(fraction >= 1 ? 0 : fraction);
      dot.setAttribute('cx', String(p.x));
      dot.setAttribute('cy', String(p.y));
      progress.style.strokeDashoffset = String(1 - fraction);
      links.forEach((link, i) => {
        if (i === active) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      });
    },
  };
}
