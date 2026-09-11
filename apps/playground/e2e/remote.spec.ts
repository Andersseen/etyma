import { expect, test } from '@playwright/test';

/**
 * The dogfood case that motivated this milestone: a page whose i18n definition has no
 * static source catalog at all, built entirely from `defineRemoteI18n`. Its loaders simulate
 * an asynchronous remote load without real network I/O - see
 * `src/app/i18n/remote/remote-i18n.ts` - so these assertions exercise the same registry,
 * hydration and fallback code paths a real CDN-backed catalog would, deterministically.
 */
test.describe('remote catalog mode', () => {
  test('SSR loads the remote source and the active locale before rendering', async ({
    request,
  }) => {
    const html = await (await request.get('/remote-demo')).text();

    // The page's own definition activates Spanish on the server, which is only possible if
    // the remote source (English, for fallback) loaded too - see the doc comment on
    // `routeMeta` in remote-demo.page.ts.
    expect(html).toContain('Demostración de catálogo remoto');
    expect(html).toContain('Idioma activo: es');

    const state = /<script id="ng-state"[^>]*>(.*?)<\/script>/s.exec(html)?.[1] ?? '';

    // Unlike static mode - which never transfers the source catalog, since it already ships
    // in the bundle - remote mode's source was fetched on the server and has to be sent, or
    // hydration would fetch it again for nothing.
    expect(state).toContain('Remote docs');
    expect(state).toContain('Demostración de catálogo remoto');
  });

  test('reports no hydration mismatch', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') {
        problems.push(message.text());
      }
    });
    page.on('pageerror', error => problems.push(error.message));

    await page.goto('/remote-demo');
    await expect(page.getByTestId('remote-title')).toHaveText('Demostración de catálogo remoto');
    await page.waitForLoadState('networkidle');

    expect(problems.filter(text => /NG0500|NG050[0-9]|hydration/i.test(text))).toEqual([]);
  });

  test('is interactive after hydration, in the locale the server rendered', async ({ page }) => {
    await page.goto('/remote-demo');

    await expect(page.getByTestId('remote-nav-docs')).toHaveText('Documentos remotos');

    await page.getByTestId('remote-switch-en').click();
    await expect(page.getByTestId('remote-title')).toHaveText('Remote catalog demo');
    await expect(page.getByTestId('remote-active')).toHaveText('Active locale: en');
  });

  test('loads a locale that was never transferred from the server', async ({ page }) => {
    await page.goto('/remote-demo');
    await expect(page.getByTestId('remote-title')).toHaveText('Demostración de catálogo remoto');

    await page.getByTestId('remote-switch-uk').click();

    await expect(page.getByTestId('remote-title')).toHaveText('Демонстрація віддаленого каталогу');
    await expect(page.getByTestId('remote-active')).toHaveText('Активна мова: uk');
  });
});
