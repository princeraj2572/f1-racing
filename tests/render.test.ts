import { describe, expect, it } from 'vitest';
import { CHAPTER_ORDER, SAMPLE_NOTE, content } from '../src/content';
import {
  esc,
  formatInr,
  markerFractions,
  renderChapters,
  renderFooter,
  renderMeta,
  renderNav,
  trackOutline,
} from '../src/render';

describe('render', () => {
  const html = renderChapters();

  it('renders one labelled section per chapter, in order', () => {
    let last = -1;
    for (const id of CHAPTER_ORDER) {
      const at = html.indexOf(`<section id="${id}"`);
      expect(at, id).toBeGreaterThan(last);
      expect(html).toContain(`aria-labelledby="${id}-title"`);
      expect(html).toContain(`id="${id}-title"`);
      last = at;
    }
  });

  it('has exactly one h1', () => {
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it('keeps all copy as real text', () => {
    expect(html).toContain(content.chapters.track.heading);
    expect(html).toContain(content.event.place);
    for (const team of content.chapters.teams.teams) expect(html).toContain(team.name);
    for (const block of content.chapters.schedule.blocks) expect(html).toContain(block.time);
  });

  it('labels every ticket price as a sample', () => {
    const labels = html.match(new RegExp(content.chapters.tickets.priceNote, 'g')) ?? [];
    expect(labels).toHaveLength(content.chapters.tickets.tiers.length);
  });

  it('gives every still an alt text', () => {
    const stills = html.match(/<img data-still="[^"]+"[^>]*>/g) ?? [];
    expect(stills).toHaveLength(CHAPTER_ORDER.length);
    for (const img of stills) expect(img).toMatch(/alt="[^"]{10,}"/);
  });

  it('escapes html in copy', () => {
    expect(esc(`<b a="1">&'`)).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  });

  it('formats prices in INR', () => {
    expect(formatInr(1200)).toBe('₹1,200');
    expect(formatInr(8000)).toBe('₹8,000');
  });

  it('builds a closed nav outline and one marker per chapter', () => {
    const { d, viewBox } = trackOutline();
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(viewBox.split(' ')).toHaveLength(4);
    const nav = renderNav();
    expect(nav.match(/data-chapter-link=/g)).toHaveLength(CHAPTER_ORDER.length);
    expect(markerFractions(4)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it('puts the sample content note in the footer and the meta in the head', () => {
    expect(renderFooter()).toContain(SAMPLE_NOTE);
    expect(renderMeta()).toContain('og:image');
  });
});
