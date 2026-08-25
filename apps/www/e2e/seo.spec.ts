import { expect, test, type Page } from '@playwright/test';

async function alternates(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from(document.head.querySelectorAll('link[rel="alternate"]')).map(link => [
        link.getAttribute('hreflang') ?? '',
        link.getAttribute('href') ?? '',
      ]),
    ),
  );
}

const canonical = (page: Page) => page.locator('link[rel="canonical"]');
const switchLocale = async (page: Page, locale: string) => {
  await page.getByTestId('language-trigger').click();
  await page.getByTestId(`switch-${locale}`).click();
};

test.describe('localized SEO metadata', () => {
  test('sets lang and dir on the document', async ({ page }) => {
    await page.goto('/es/docs');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('the canonical URL is absolute and names this page', async ({ page, baseURL }) => {
    await page.goto('/uk/docs/button');

    await expect(canonical(page)).toHaveAttribute('href', `${baseURL}/uk/docs/button`);
  });

  test('every translation of the page is listed, plus x-default', async ({ page, baseURL }) => {
    await page.goto('/es/docs');

    expect(await alternates(page)).toEqual({
      en: `${baseURL}/docs`,
      es: `${baseURL}/es/docs`,
      uk: `${baseURL}/uk/docs`,
      'x-default': `${baseURL}/docs`,
    });
  });

  test('x-default points at the unprefixed source locale', async ({ page, baseURL }) => {
    await page.goto('/uk/docs/button');

    expect((await alternates(page))['x-default']).toBe(`${baseURL}/docs/button`);
  });

  test('the alternates on the source-locale page are the same set', async ({ page, baseURL }) => {
    await page.goto('/docs');

    expect(await alternates(page)).toEqual({
      en: `${baseURL}/docs`,
      es: `${baseURL}/es/docs`,
      uk: `${baseURL}/uk/docs`,
      'x-default': `${baseURL}/docs`,
    });
  });

  test('metadata follows a navigation that stays in the same language', async ({
    page,
    baseURL,
  }) => {
    // The regression this exists for: metadata written once at bootstrap keeps describing
    // the page the visitor arrived on, forever, on every page after it.
    await page.goto('/es/docs');
    await expect(canonical(page)).toHaveAttribute('href', `${baseURL}/es/docs`);

    await page.getByTestId('to-button').click();
    await expect(page).toHaveURL('/es/docs/button');

    await expect(canonical(page)).toHaveAttribute('href', `${baseURL}/es/docs/button`);
    expect(await alternates(page)).toEqual({
      en: `${baseURL}/docs/button`,
      es: `${baseURL}/es/docs/button`,
      uk: `${baseURL}/uk/docs/button`,
      'x-default': `${baseURL}/docs/button`,
    });
  });

  test('metadata follows a language switch', async ({ page, baseURL }) => {
    await page.goto('/es/docs/button');

    await switchLocale(page, 'uk');
    await expect(page).toHaveURL('/uk/docs/button');

    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await expect(canonical(page)).toHaveAttribute('href', `${baseURL}/uk/docs/button`);
  });

  test('hydration does not duplicate what the server already rendered', async ({ page }) => {
    await page.goto('/es/docs');
    await page.waitForLoadState('networkidle');

    await expect(canonical(page)).toHaveCount(1);
    expect(Object.keys(await alternates(page))).toHaveLength(4);
  });

  test('the alternates are in the server response, not added by the browser', async ({
    request,
    baseURL,
  }) => {
    const html = await (await request.get('/es/docs')).text();

    expect(html).toContain(`<link rel="canonical" href="${baseURL}/es/docs"`);
    expect(html).toContain(`hreflang="x-default" href="${baseURL}/docs"`);
  });
});
