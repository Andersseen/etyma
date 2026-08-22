import { expect, test } from '@playwright/test';

/** The chunk `vite.config.ts` gives each non-source catalog a stable name. */
const localeChunk = (locale: string) => new RegExp(`/assets/etyma-locale-${locale}-[^/]+\\.js$`);

test.describe('hydration', () => {
  test('never renders the source language before the translation arrives', async ({ page }) => {
    const englishSeen: string[] = [];

    // Sampled while the page loads rather than after it: a flash of the source language is
    // over long before `waitForLoadState` returns, which is exactly why it is easy to ship.
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { __etymaSeen: string[] }).__etymaSeen = seen;

      const sample = () => {
        const heading = document.querySelector('[data-testid="title"]')?.textContent;

        if (heading && !seen.includes(heading)) {
          seen.push(heading);
        }
      };

      const observer = new MutationObserver(sample);
      document.addEventListener('DOMContentLoaded', () => {
        sample();
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      });
    });

    await page.goto('/es/docs');
    await expect(page.getByTestId('title')).toHaveText('Documentación');

    englishSeen.push(
      ...(await page.evaluate(() => (window as unknown as { __etymaSeen: string[] }).__etymaSeen)),
    );

    expect(englishSeen).not.toContain('Documentation');
    expect(englishSeen).toEqual(['Documentación']);
  });

  test('does not fetch a catalog the server already sent', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', request => requested.push(new URL(request.url()).pathname));

    await page.goto('/es/docs');
    await expect(page.getByTestId('title')).toHaveText('Documentación');
    await page.waitForLoadState('networkidle');

    expect(requested.filter(path => localeChunk('es').test(path))).toEqual([]);
  });

  test('fetches a catalog only when the visitor asks for that language', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', request => requested.push(new URL(request.url()).pathname));

    await page.goto('/docs');
    await page.waitForLoadState('networkidle');

    // Nothing but English is in the initial payload: that is the lazy-loading promise.
    expect(requested.filter(path => localeChunk('es').test(path))).toEqual([]);
    expect(requested.filter(path => localeChunk('uk').test(path))).toEqual([]);

    await page.getByTestId('switch-uk').click();
    await expect(page.getByTestId('title')).toHaveText('Документація');

    expect(requested.filter(path => localeChunk('uk').test(path))).toHaveLength(1);
    expect(requested.filter(path => localeChunk('es').test(path))).toEqual([]);
  });

  test('reports no hydration mismatch', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') {
        problems.push(message.text());
      }
    });
    page.on('pageerror', error => problems.push(error.message));

    await page.goto('/uk/docs/button');
    await expect(page.getByTestId('title')).toHaveText('Кнопка');
    await page.waitForLoadState('networkidle');

    expect(problems.filter(text => /NG0500|NG050[0-9]|hydration/i.test(text))).toEqual([]);
  });

  test('is interactive after hydration', async ({ page }) => {
    await page.goto('/es/docs');

    await page.getByTestId('switch-uk').click();

    await expect(page.getByTestId('title')).toHaveText('Документація');
  });
});
