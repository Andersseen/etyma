import { expect, test } from '@playwright/test';

/**
 * Assertions against the HTTP response itself, with no browser involved.
 *
 * Everything else in this suite runs after hydration, at which point a page that arrived in
 * English and was translated by JavaScript looks identical to one the server translated.
 * The difference matters to a search engine crawler, to a reader on a slow connection and
 * to anyone with JavaScript disabled, so it is checked where it is visible: in the bytes.
 */
test.describe('server-rendered HTML', () => {
  test('the response for a Spanish URL is already Spanish', async ({ request }) => {
    const response = await request.get('/es/docs');
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain('Documentación');
    expect(html).toContain('Dos páginas, tres idiomas');
    expect(html).not.toContain('Two pages, three languages');
  });

  test('the response for a Ukrainian URL is already Ukrainian', async ({ request }) => {
    const html = await (await request.get('/uk/docs')).text();

    expect(html).toContain('Задокументовано');
    expect(html).not.toContain('components are documented');
  });

  test('the source locale is served from the unprefixed URL', async ({ request }) => {
    const html = await (await request.get('/docs')).text();

    expect(html).toContain('Two pages, three languages');
  });

  test('the source-locale prefix redirects to the unprefixed canonical URL', async ({ page }) => {
    await page.goto('/en/docs?tab=api#example');

    await expect(page).toHaveURL('/docs?tab=api#example');
    await expect(page.getByTestId('title')).toHaveText('Documentation');
  });

  test('the language attribute is on the html element in the response', async ({ request }) => {
    expect(await (await request.get('/es/docs')).text()).toMatch(/<html[^>]*lang="es"/);
    expect(await (await request.get('/uk/docs')).text()).toMatch(/<html[^>]*lang="uk"/);
    expect(await (await request.get('/docs')).text()).toMatch(/<html[^>]*lang="en"/);
  });

  test('a deep localized route is rendered in its own language', async ({ request }) => {
    const html = await (await request.get('/uk/docs/button')).text();

    expect(html).toContain('Кнопка');
    expect(html).toContain('2026');
  });

  test('plural categories are chosen by the language of the page', async ({ request }) => {
    const ukrainian = await (await request.get('/uk/docs')).text();

    // Ukrainian has one/few/many where English has one/other. Getting all three right is
    // what using MessageFormat 2 rather than a hand-rolled plural rule buys.
    expect(ukrainian).toContain('Задокументовано 1 компонент.');
    expect(ukrainian).toContain('Задокументовано 3 компоненти.');
    expect(ukrainian).toContain('Задокументовано 12 компонентів.');
  });

  test('a key missing from a translation falls back to the source catalog', async ({ request }) => {
    const spanish = await (await request.get('/es/docs')).text();

    expect(spanish).toContain('This sentence exists only in the source catalog');
  });

  test('two requests in different languages do not see each other', async ({ request }) => {
    // The failure this guards against is a module-level `currentLocale` on the server:
    // it passes every sequential test and corrupts every page under real traffic. Ten
    // interleaved requests across three languages is enough to catch one.
    const wanted = ['/docs', '/es/docs', '/uk/docs', '/es/docs', '/uk/docs'];
    const expected: Record<string, string> = {
      '/docs': 'Two pages, three languages',
      '/es/docs': 'Dos páginas, tres idiomas',
      '/uk/docs': 'Дві сторінки, три мови',
    };

    const responses = await Promise.all(
      [...wanted, ...wanted].map(async path => ({
        path,
        html: await (await request.get(path)).text(),
      })),
    );

    for (const { path, html } of responses) {
      expect(html, `${path} was rendered in the wrong language`).toContain(expected[path]);
    }
  });

  test('the catalog the page was rendered with is transferred to the browser', async ({
    request,
  }) => {
    const html = await (await request.get('/es/docs')).text();
    const state = /<script id="ng-state"[^>]*>(.*?)<\/script>/s.exec(html)?.[1] ?? '';

    expect(state).toContain('Documentación');
    // The source catalog is in the JavaScript bundle already; sending it again would
    // double the payload of every English page for nothing.
    expect(state).not.toContain('Two pages, three languages');
  });
});
