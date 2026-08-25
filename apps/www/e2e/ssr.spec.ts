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
    expect(html).toContain('Define i18n una vez');
    expect(html).toContain('El idioma fuente queda');
    expect(html).not.toContain('The source locale stays unprefixed');
  });

  test('the response for a Ukrainian URL is already Ukrainian', async ({ request }) => {
    const html = await (await request.get('/uk/docs')).text();

    expect(html).toContain('Покрито');
    expect(html).not.toContain('production behaviors are covered');
  });

  test('the source locale is served from the unprefixed URL', async ({ request }) => {
    const html = await (await request.get('/docs')).text();

    expect(html).toContain('The source locale stays unprefixed');
  });

  test('the source-locale prefix redirects to the unprefixed canonical URL', async ({ page }) => {
    await page.goto('/en/docs?tab=api#example');

    await expect(page).toHaveURL('/docs?tab=api#example');
    await expect(page.getByTestId('title')).toHaveText(
      'Install one i18n definition and let the URL choose the locale.',
    );
  });

  test('the language attribute is on the html element in the response', async ({ request }) => {
    expect(await (await request.get('/es/docs')).text()).toMatch(/<html[^>]*lang="es"/);
    expect(await (await request.get('/uk/docs')).text()).toMatch(/<html[^>]*lang="uk"/);
    expect(await (await request.get('/docs')).text()).toMatch(/<html[^>]*lang="en"/);
  });

  test('a deep localized route is rendered in its own language', async ({ request }) => {
    const html = await (await request.get('/uk/docs/button')).text();

    expect(html).toContain('Angular bindings на signals без runtime-церемонії.');
    expect(html).toContain('2026');
  });

  test('plural categories are chosen by the language of the page', async ({ request }) => {
    const ukrainian = await (await request.get('/uk/docs')).text();

    // Ukrainian has one/few/many where English has one/other. Getting all three right is
    // what using MessageFormat 2 rather than a hand-rolled plural rule buys.
    expect(ukrainian).toContain('Покрито 1 production-поведінку.');
    expect(ukrainian).toContain('Покрито 3 production-поведінки.');
    expect(ukrainian).toContain('Покрито 12 production-поведінок.');
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
      '/docs': 'The source locale stays unprefixed',
      '/es/docs': 'El idioma fuente queda',
      '/uk/docs': 'Джерельна мова лишається',
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

    expect(state).toContain('Define i18n una vez');
    // The source catalog is in the JavaScript bundle already; sending it again would
    // double the payload of every English page for nothing.
    expect(state).not.toContain('The source locale stays unprefixed');
  });
});
