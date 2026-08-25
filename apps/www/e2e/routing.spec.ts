import { expect, test, type Page } from '@playwright/test';

const title = (page: Page) => page.getByTestId('title');
const switchLocale = async (page: Page, locale: string) => {
  await page.getByTestId('language-trigger').click();
  await page.getByTestId(`switch-${locale}`).click();
};

test.describe('direct visits', () => {
  test('the source locale is served from the root', async ({ page }) => {
    await page.goto('/');

    await expect(title(page)).toHaveText('Typed i18n. Real SSR. Clean Angular APIs.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('a Spanish URL renders Spanish', async ({ page }) => {
    await page.goto('/es');

    await expect(title(page)).toHaveText('i18n tipado. SSR real. APIs limpias para Angular.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('a Ukrainian URL renders Ukrainian', async ({ page }) => {
    await page.goto('/uk');

    await expect(title(page)).toHaveText('Типізована i18n. Справжній SSR. Чисті Angular API.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });

  test('a deep localized URL renders in its own language', async ({ page }) => {
    await page.goto('/es/docs/button');

    await expect(title(page)).toHaveText('Bindings Angular con signals y sin ceremonia runtime.');
    await expect(page.getByTestId('status')).toHaveText('Estable y documentado');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('a page is not mistaken for a locale', async ({ page }) => {
    await page.goto('/docs/button');

    await expect(title(page)).toHaveText(
      'Signal-native Angular bindings without runtime ceremony.',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('navigation', () => {
  test('header navigation is landing-focused', async ({ page }) => {
    await page.goto('/uk');

    await page.getByTestId('nav-workflow').click();

    await expect(page).toHaveURL('/uk#workflow');
    await expect(page.locator('#workflow')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });

  test('navigating deeper keeps the locale', async ({ page }) => {
    await page.goto('/es/docs');

    await page.getByTestId('to-button').click();

    await expect(page).toHaveURL('/es/docs/button');
    await expect(title(page)).toHaveText('Bindings Angular con signals y sin ceremonia runtime.');
  });

  test('the primary navigation stays on landing sections', async ({ page }) => {
    await page.goto('/uk');

    await expect(page.getByTestId('nav-features')).toHaveAttribute('href', '/uk#features');
    await expect(page.getByTestId('nav-workflow')).toHaveAttribute('href', '/uk#workflow');
    await expect(page.getByTestId('nav-packages')).toHaveAttribute('href', '/uk#packages');
  });
});

test.describe('switching language', () => {
  test('stays on the same logical page', async ({ page }) => {
    await page.goto('/es/docs/button');

    await switchLocale(page, 'uk');

    await expect(page).toHaveURL('/uk/docs/button');
    await expect(title(page)).toHaveText('Angular bindings на signals без runtime-церемонії.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });

  test('drops the prefix when switching back to the source locale', async ({ page }) => {
    await page.goto('/uk/docs/button');

    await switchLocale(page, 'en');

    await expect(page).toHaveURL('/docs/button');
    await expect(title(page)).toHaveText(
      'Signal-native Angular bindings without runtime ceremony.',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('adds the prefix when leaving the source locale', async ({ page }) => {
    await page.goto('/docs');

    await switchLocale(page, 'es');

    await expect(page).toHaveURL('/es/docs');
    await expect(title(page)).toHaveText('Define i18n una vez y deja que la URL elija el idioma.');
  });

  test('preserves query strings and fragments when switching locale', async ({ page }) => {
    await page.goto('/es/docs?tab=api#example');

    await switchLocale(page, 'uk');

    await expect(page).toHaveURL('/uk/docs?tab=api#example');
    await expect(title(page)).toHaveText('Визнач i18n один раз і дай URL вибирати мову.');
  });

  test('switches between two secondary locales without losing the logical page', async ({
    page,
  }) => {
    await page.goto('/es/docs/themes');

    await switchLocale(page, 'uk');
    await expect(page).toHaveURL('/uk/docs/themes');
    await expect(title(page)).toHaveText('Маршрути, SEO і SSR AnalogJS навколо локалізованих URL.');

    await switchLocale(page, 'es');
    await expect(page).toHaveURL('/es/docs/themes');
    await expect(title(page)).toHaveText(
      'Rutas, SEO y SSR de AnalogJS alrededor de URLs localizadas.',
    );
  });

  test('marks the active language in the switcher', async ({ page }) => {
    await page.goto('/es');

    await page.getByTestId('language-trigger').click();

    await expect(page.getByTestId('switch-es')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('switch-en')).not.toHaveAttribute('aria-current', 'true');
  });
});
