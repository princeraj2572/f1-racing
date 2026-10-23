import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { SAMPLE_NOTE } from './src/content.ts';
import { renderChapters, renderFooter, renderMeta, renderNav } from './src/render.ts';

/** Fills index.html from src/content.ts and src/track.ts so the page is real HTML before JS runs. */
function eventPage(): Plugin {
  return {
    name: 'event-page',
    transformIndexHtml(html) {
      return html
        .replace('<!--meta-->', renderMeta())
        .replace('<!--sample-note-->', SAMPLE_NOTE)
        .replace('<!--nav-->', renderNav())
        .replace('<!--chapters-->', renderChapters())
        .replace('<!--footer-->', renderFooter());
    },
  };
}

export default defineConfig({
  plugins: [eventPage()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
