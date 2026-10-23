// Builds the page markup from src/content.ts and src/track.ts. It runs at build time (see
// vite.config.ts) so every word is real HTML before any script runs.
import { CHAPTER_ORDER, SAMPLE_NOTE, content as defaultContent } from './content';
import type { Content } from './content';
import { TRACK, tileWaypoints } from './track';
import type { TilePlacement } from './track';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const esc = (value: string): string => value.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Outline of the track for the side navigation, as an SVG path in a padded viewBox. */
export function trackOutline(
  track: readonly TilePlacement[] = TRACK,
  arcSteps = 8,
): { d: string; viewBox: string } {
  const points = track.flatMap((tile) => tileWaypoints(tile, arcSteps).slice(0, -1));
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const pad = 0.6;
  const minX = Math.min(...xs) - pad;
  const minZ = Math.min(...zs) - pad;
  const width = Math.max(...xs) + pad - minX;
  const height = Math.max(...zs) + pad - minZ;
  const r = (n: number): string => n.toFixed(3).replace(/\.?0+$/, '');
  const d = `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r(p.x)} ${r(p.z)}`).join(' ')} Z`;
  return { d, viewBox: `${r(minX)} ${r(minZ)} ${r(width)} ${r(height)}` };
}

/** Where chapter markers sit on the outline: evenly spaced round the lap, in driving order. */
export function markerFractions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i / count);
}

const split = (tag: string, cls: string, text: string, attrs = ''): string =>
  `<${tag} class="${cls}" data-split${attrs ? ` ${attrs}` : ''}>${esc(text)}</${tag}>`;

const stillFor = (id: string, alt: string): string =>
  `<figure class="still"><img data-still="${id}" width="1280" height="720" alt="${esc(alt)}" decoding="async"></figure>`;

export function renderMeta(c: Content = defaultContent): string {
  const m = c.meta;
  return [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}">`,
    `<meta name="theme-color" content="${esc(m.themeColour)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    `<meta property="og:image" content="${esc(m.ogImage)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="A low sun over a race track with a red race car on the start line.">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(m.title)}">`,
    `<meta name="twitter:description" content="${esc(m.description)}">`,
    `<meta name="twitter:image" content="${esc(m.ogImage)}">`,
  ].join('\n    ');
}

export function renderNav(c: Content = defaultContent): string {
  const { d, viewBox } = trackOutline();
  const fractions = markerFractions(CHAPTER_ORDER.length);
  const items = CHAPTER_ORDER.map((id, i) => {
    const ch = c.chapters[id];
    return `<li><a class="track-nav__marker" href="#${id}" data-chapter-link="${i}" data-fraction="${fractions[i]?.toFixed(5)}" aria-label="Chapter ${i + 1}: ${esc(ch.nav)}"><span class="track-nav__label">${esc(ch.nav)}</span></a></li>`;
  }).join('\n          ');
  return `<nav class="track-nav" aria-label="Chapters">
      <svg class="track-nav__svg" viewBox="${viewBox}" aria-hidden="true" focusable="false">
        <path class="track-nav__road" d="${d}" pathLength="1" />
        <path class="track-nav__progress" d="${d}" pathLength="1" />
        <circle class="track-nav__dot" r="0.28" cx="0" cy="0" />
      </svg>
      <ol class="track-nav__list">
          ${items}
      </ol>
    </nav>`;
}

export function renderChapters(c: Content = defaultContent): string {
  const ch = c.chapters;
  const sections: string[] = [];

  const open = (id: string, extra = ''): string => {
    const chapter = ch[id as keyof typeof ch];
    const index = CHAPTER_ORDER.indexOf(id as (typeof CHAPTER_ORDER)[number]);
    return `<section id="${id}" class="chapter chapter--${id}${extra}" data-index="${index}" style="--weight:${chapter.weight}" aria-labelledby="${id}-title">`;
  };

  sections.push(`${open('hero')}
      <div class="stage">
        ${split('p', 'kicker', ch.hero.kicker)}
        <h1 id="hero-title" class="display display--hero" aria-label="${esc(c.brand.name)} ${esc(c.brand.year)}"><span class="display__line" data-split aria-hidden="true">${esc(c.brand.name)}</span> <span class="display__line display__line--accent" data-split aria-hidden="true">${esc(c.brand.year)}</span></h1>
        ${split('p', 'lede', c.event.tagline)}
        <dl class="meta">
          <div><dt>Dates</dt><dd>${esc(c.event.dates)}</dd></div>
          <div><dt>Place</dt><dd>${esc(c.event.place)}</dd></div>
        </dl>
        <ul class="startup" aria-label="Start-up sequence">
          ${ch.hero.startUp.map((s) => `<li class="startup__item"><span class="startup__lamp" aria-hidden="true"></span>${esc(s)}</li>`).join('\n          ')}
        </ul>
        <p class="scroll-cue"><span>${esc(ch.hero.cue)}</span><span class="scroll-cue__line" aria-hidden="true"></span></p>
        ${stillFor('hero', 'A red race car on the start line at dawn, seen from behind.')}
      </div>
    </section>`);

  sections.push(`${open('track')}
      <div class="stage">
        ${split('p', 'kicker', ch.track.kicker)}
        ${split('h2', 'title', ch.track.heading, 'id="track-title"')}
        ${split('p', 'body', ch.track.body)}
        <dl class="facts">
          ${ch.track.facts
            .map(
              (f) =>
                `<div class="fact"><dt>${esc(f.label)}</dt><dd><span class="fact__value" data-count="${esc(f.value)}">${esc(f.value)}</span><span class="fact__unit">${esc(f.unit)}</span></dd></div>`,
            )
            .join('\n          ')}
        </dl>
        ${stillFor('track', 'The whole circuit seen from above: a clockwise loop of nine tiles.')}
      </div>
    </section>`);

  sections.push(`${open('corner1')}
      <div class="stage">
        <p class="ghost-numeral" aria-hidden="true">T1</p>
        ${split('p', 'kicker', ch.corner1.kicker)}
        ${split('h2', 'title', ch.corner1.heading, 'id="corner1-title"')}
        ${split('p', 'body', ch.corner1.body)}
        ${stillFor('corner1', 'The tight right-hand first corner, seen from outside the apex.')}
      </div>
    </section>`);

  sections.push(`${open('straight')}
      <div class="stage">
        ${split('p', 'kicker', ch.straight.kicker)}
        ${split('h2', 'title', ch.straight.heading, 'id="straight-title"')}
        ${split('p', 'body', ch.straight.body)}
        <div class="countdown" data-countdown="${esc(c.event.startsAt)}" data-done="${esc(ch.straight.countdownDone)}">
          <p class="countdown__label">${esc(ch.straight.countdownLabel)}</p>
          <p class="countdown__value" role="timer" aria-live="off">
            <span class="countdown__cell"><b data-unit="days">--</b><small>days</small></span>
            <span class="countdown__cell"><b data-unit="hours">--</b><small>hrs</small></span>
            <span class="countdown__cell"><b data-unit="minutes">--</b><small>min</small></span>
            <span class="countdown__cell"><b data-unit="seconds">--</b><small>sec</small></span>
          </p>
        </div>
        ${stillFor('straight', 'A red race car at full speed down the long back straight.')}
      </div>
    </section>`);

  sections.push(`${open('schedule')}
      <div class="stage">
        ${split('p', 'kicker', ch.schedule.kicker)}
        ${split('h2', 'title', ch.schedule.heading, 'id="schedule-title"')}
        <ol class="schedule">
          ${ch.schedule.blocks
            .map(
              (b, i) =>
                `<li class="schedule__row"><span class="schedule__index" aria-hidden="true">0${i + 1}</span><div class="schedule__main"><h3 class="schedule__name">${esc(b.name)}</h3><p class="schedule__note">${esc(b.note)}</p></div><p class="schedule__when"><span>${esc(b.day)}</span><b>${esc(b.time)}</b></p></li>`,
            )
            .join('\n          ')}
        </ol>
        ${stillFor('schedule', 'A race car side-on through the double bend of corners two and three.')}
      </div>
    </section>`);

  sections.push(`${open('teams')}
      <div class="stage">
        ${split('p', 'kicker', ch.teams.kicker)}
        ${split('h2', 'title', ch.teams.heading, 'id="teams-title"')}
        ${split('p', 'body', ch.teams.body)}
        <ul class="teams">
          ${ch.teams.teams
            .map(
              (t) =>
                `<li class="team" style="--team:${esc(t.colour)}" data-team-car="${esc(t.car)}"><span class="team__number">${esc(t.number)}</span><div><h3 class="team__name">${esc(t.name)}</h3><p class="team__tagline">${esc(t.tagline)}</p></div></li>`,
            )
            .join('\n          ')}
        </ul>
        ${stillFor('teams', 'Four race cars in different team colours lined up along the back straight.')}
      </div>
    </section>`);

  sections.push(`${open('tickets')}
      <div class="stage">
        ${split('p', 'kicker', ch.tickets.kicker)}
        ${split('h2', 'title', ch.tickets.heading, 'id="tickets-title"')}
        ${split('p', 'body', ch.tickets.body)}
        <ul class="tickets">
          ${ch.tickets.tiers
            .map(
              (t) =>
                `<li class="ticket"><h3 class="ticket__name">${esc(t.name)}</h3><p class="ticket__price"><b>${esc(formatInr(t.priceInr))}</b><small>${esc(ch.tickets.priceNote)}</small></p><ul class="ticket__perks">${t.perks.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></li>`,
            )
            .join('\n          ')}
        </ul>
        ${stillFor('tickets', 'A wide high view of the last corner and the grandstands at golden hour.')}
      </div>
    </section>`);

  const f = ch.finale.form;
  sections.push(`${open('finale')}
      <div class="stage">
        ${split('p', 'kicker', ch.finale.kicker)}
        ${split('h2', 'display', ch.finale.heading, 'id="finale-title"')}
        ${split('p', 'body', ch.finale.body)}
        <form class="notify" id="notify" novalidate>
          <label class="notify__label" for="notify-email">${esc(f.label)}</label>
          <div class="notify__row">
            <input class="notify__input" id="notify-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(f.placeholder)}" aria-describedby="notify-msg" required>
            <button class="button" type="submit">${esc(f.button)}</button>
          </div>
          <p class="notify__msg" id="notify-msg" role="status" aria-live="polite"></p>
        </form>
        ${stillFor('finale', 'Four race cars lined up on the grid, seen from directly above.')}
      </div>
    </section>`);

  return sections.join('\n    ');
}

export function renderFooter(c: Content = defaultContent): string {
  return `<footer class="footer">
      <p class="footer__note">${esc(SAMPLE_NOTE)}</p>
      <p class="footer__credit">${esc(c.footer.credit)}</p>
    </footer>`;
}
