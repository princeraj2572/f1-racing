// Captures the still images used by the static versions (reduced motion, no WebGL) and the Open
// Graph image, straight from the 3D scene. Usage: npm run capture
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const STILLS = join(ROOT, 'public', 'stills');

// Where in each chapter to take the picture (chapter coordinate: 2.55 is 55% through chapter 2).
const SHOTS = [
  ['hero', 0.3],
  ['track', 1.4],
  ['corner1', 2.55],
  ['straight', 3.6],
  ['schedule', 4.55],
  ['teams', 5.4],
  ['tickets', 6.5],
  ['finale', 7.95],
];

await build({ root: ROOT, logLevel: 'warn' });
const server = await preview({
  root: ROOT,
  logLevel: 'warn',
  preview: { port: 4179, strictPort: true, host: '127.0.0.1' },
});
const url = 'http://127.0.0.1:4179/?capture=1';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

async function open(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__apex, null, { timeout: 60_000 });
  await page.waitForFunction(() =>
    document.getElementById('loader')?.classList.contains('is-done'),
  );
  await page.waitForTimeout(1500);
  return page;
}

try {
  mkdirSync(STILLS, { recursive: true });

  // Scene only: hide the text layers so the stills work as pictures beside the text
  const page = await open(1280, 720);
  await page.addStyleTag({
    content:
      '.stage,.vignette,.track-nav,.sample-note,.speedlines,.loader{visibility:hidden!important}',
  });
  for (const [id, coord] of SHOTS) {
    await page.evaluate((c) => window.__apex.shoot(c), coord);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(STILLS, `${id}.jpg`), type: 'jpeg', quality: 82 });
    console.log(`still ${id}`);
  }
  await page.close();

  // Open Graph image: the hero shot with its title, at the standard 1200x630
  const og = await open(1200, 630);
  await og.evaluate(() => window.__apex.shoot(0.12));
  await og.waitForTimeout(2800);
  await og.screenshot({ path: join(ROOT, 'public', 'og.jpg'), type: 'jpeg', quality: 84 });
  console.log('og image');
  await og.close();
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
