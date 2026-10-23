import { expect, test } from '@playwright/test';
import { watchProblems } from './helpers';

// Browsers with the 3D APIs switched off get the static version of every chapter
const executablePath = process.env.CHROMIUM_PATH || undefined;
test.use({ launchOptions: { executablePath, args: ['--disable-3d-apis', '--disable-gpu'] } });

test('falls back to the static version of every chapter', async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-static/);
  await expect(page.locator('#sample-note')).toContainText('needs WebGL');
  await expect(page.locator('#stage')).toBeHidden();
  await expect(page.locator('#loader')).toHaveClass(/is-done/);
  await expect(page.locator('img[data-still]')).toHaveCount(8);
  await expect(page.locator('#finale-title')).toBeAttached();
  expect(problems.pageErrors).toEqual([]);
  expect(problems.failedRequests).toEqual([]);
});
