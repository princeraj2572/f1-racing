import type { ConsoleMessage, Page } from '@playwright/test';

export interface Problems {
  console: string[];
  failedRequests: string[];
  pageErrors: string[];
}

/** Collects console errors, failed requests and uncaught errors for the life of a page. */
export function watchProblems(page: Page): Problems {
  const problems: Problems = { console: [], failedRequests: [], pageErrors: [] };
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      problems.console.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    problems.failedRequests.push(`${request.method()} ${request.url()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      problems.failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => problems.pageErrors.push(error.message));
  return problems;
}

export async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.getElementById('loader')?.classList.contains('is-done'),
    null,
    {
      timeout: 60_000,
    },
  );
}

/** Scroll position (in px) that puts chapter `index` in its pinned reading state. */
export async function chapterScrollY(page: Page, index: number, fraction = 0.6): Promise<number> {
  return page.evaluate(
    ([i, f]) => {
      const section = document.querySelectorAll<HTMLElement>('.chapter')[i as number];
      if (!section) throw new Error(`No chapter ${i}`);
      const top = section.getBoundingClientRect().top + window.scrollY;
      const vh = window.innerHeight;
      const pinned = Math.max(0, section.offsetHeight - vh);
      return top + Math.max(0.05 * vh, pinned * (f as number)) + 0.05 * vh;
    },
    [index, fraction],
  );
}
