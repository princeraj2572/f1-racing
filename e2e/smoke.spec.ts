import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { chapterScrollY, waitForReady, watchProblems } from './helpers';

const CHAPTER_IDS = [
  'hero',
  'track',
  'corner1',
  'straight',
  'schedule',
  'teams',
  'tickets',
  'finale',
];

test('scrolls through every chapter with no errors and saves a screenshot of each', async ({
  page,
}, testInfo) => {
  const problems = watchProblems(page);
  const device = testInfo.project.name;
  mkdirSync('screenshots', { recursive: true });

  await page.goto('/');
  await waitForReady(page);
  await expect(page.locator('html')).not.toHaveClass(/is-static/);
  await expect(page.locator('#stage')).toBeVisible();
  await page.waitForTimeout(1500);

  for (const [index, id] of CHAPTER_IDS.entries()) {
    await page.evaluate((y) => window.scrollTo(0, y), await chapterScrollY(page, index));
    // Let the camera ease in and the reveal play
    await page.waitForTimeout(2600);
    await expect(page.locator(`#${id}-title`)).toBeVisible();
    await expect(page.locator(`.track-nav [data-chapter-link="${index}"]`)).toHaveAttribute(
      'aria-current',
      'step',
    );
    await page.screenshot({
      path: `screenshots/${device}-${String(index + 1).padStart(2, '0')}-${id}.jpg`,
      type: 'jpeg',
      quality: 80,
    });
  }

  expect(problems.pageErrors).toEqual([]);
  expect(problems.failedRequests).toEqual([]);
  expect(problems.console).toEqual([]);
});
