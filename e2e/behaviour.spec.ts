import { expect, test } from '@playwright/test';
import { waitForReady, watchProblems } from './helpers';

test.describe('full experience', () => {
  test('navigates between chapters with the track markers', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const marker = page.locator('.track-nav [data-chapter-link="4"]');
    await marker.click();
    await expect(marker).toHaveAttribute('aria-current', 'step', { timeout: 15_000 });
    await expect(page).toHaveURL(/#schedule$/);
    await expect(page.locator('#schedule-title')).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  });

  test('moves between chapters from the keyboard', async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), 'keyboard shortcuts are a desktop feature');
    await page.goto('/');
    await waitForReady(page);
    await page.keyboard.press(']');
    await expect(page.locator('.track-nav [data-chapter-link="1"]')).toHaveAttribute(
      'aria-current',
      'step',
      {
        timeout: 15_000,
      },
    );
    await page.keyboard.press(']');
    await expect(page.locator('.track-nav [data-chapter-link="2"]')).toHaveAttribute(
      'aria-current',
      'step',
      {
        timeout: 15_000,
      },
    );
    await page.keyboard.press('[');
    await expect(page.locator('.track-nav [data-chapter-link="1"]')).toHaveAttribute(
      'aria-current',
      'step',
      {
        timeout: 15_000,
      },
    );
  });

  test('markers are reachable with the tab key and arrow keys move between them', async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), 'keyboard focus is a desktop feature');
    await page.goto('/');
    await waitForReady(page);
    const first = page.locator('.track-nav [data-chapter-link="0"]');
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.track-nav [data-chapter-link="1"]')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('.track-nav [data-chapter-link="7"]')).toBeFocused();
  });

  test('validates the notify-me email and shows a success state', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const input = page.locator('#notify-email');
    const message = page.locator('#notify-msg');
    await page.locator('#notify').scrollIntoViewIfNeeded();

    await page.getByRole('button', { name: 'Notify me' }).click();
    await expect(message).toContainText('Enter your email');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill('not-an-email');
    await page.getByRole('button', { name: 'Notify me' }).click();
    await expect(message).toContainText('does not look right');

    await input.fill('driver@example.com');
    await page.getByRole('button', { name: 'Notify me' }).click();
    await expect(message).toContainText('nothing was saved or sent');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  test('stores nothing and sends nothing when the form is submitted', async ({ page }) => {
    const requests: string[] = [];
    await page.goto('/');
    await waitForReady(page);
    page.on('request', (r) => requests.push(r.method()));
    await page.locator('#notify-email').fill('driver@example.com');
    await page.getByRole('button', { name: 'Notify me' }).click();
    await expect(page.locator('#notify-msg')).toContainText('nothing was saved');
    expect(requests.filter((m) => m !== 'GET')).toEqual([]);
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  });

  test('counts down to the event date', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const seconds = page.locator('[data-unit="seconds"]');
    const first = await seconds.textContent();
    await expect.poll(async () => seconds.textContent(), { timeout: 5000 }).not.toBe(first);
    await expect(page.locator('[data-unit="days"]')).not.toHaveText('--');
  });

  test('marks all event content as sample content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#sample-note')).toContainText('Sample content');
    await expect(page.locator('.footer__note')).toContainText('Sample content');
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the static version with stills and no canvas', async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/is-static/);
    await expect(page.locator('#stage')).toBeHidden();
    await expect(page.locator('.track-nav')).toBeHidden();
    const stills = page.locator('img[data-still]');
    await expect(stills).toHaveCount(8);
    for (const img of await stills.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
    // Every chapter is still there as real text
    for (const id of [
      'hero',
      'track',
      'corner1',
      'straight',
      'schedule',
      'teams',
      'tickets',
      'finale',
    ]) {
      await expect(page.locator(`#${id}-title`)).toBeAttached();
    }
    expect(problems.pageErrors).toEqual([]);
    expect(problems.failedRequests).toEqual([]);
    expect(problems.console).toEqual([]);
  });
});
