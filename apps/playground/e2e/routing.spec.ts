import { expect, test, type Page } from '@playwright/test';

const title = (page: Page) => page.getByTestId('title');

test.describe('direct visits', () => {
  test('the source locale is served from the root', async ({ page }) => {
    await page.goto('/');

    await expect(title(page)).toHaveText('Etyma playground');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('a Spanish URL renders Spanish', async ({ page }) => {
    await page.goto('/es');

    await expect(title(page)).toHaveText('Campo de pruebas de Etyma');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('a Ukrainian URL renders Ukrainian', async ({ page }) => {
    await page.goto('/uk');

    await expect(title(page)).toHaveText('Майданчик Etyma');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });

  test('a deep localized URL renders in its own language', async ({ page }) => {
    await page.goto('/es/docs/button');

    await expect(title(page)).toHaveText('Botón');
    await expect(page.getByTestId('status')).toHaveText('Beta');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('a page is not mistaken for a locale', async ({ page }) => {
    await page.goto('/docs/button');

    await expect(title(page)).toHaveText('Button');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('navigation', () => {
  test('following a link keeps the locale and the prefix', async ({ page }) => {
    await page.goto('/uk');

    await page.getByTestId('nav-docs').click();

    await expect(page).toHaveURL('/uk/docs');
    await expect(title(page)).toHaveText('Документація');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });

  test('navigating deeper keeps the locale', async ({ page }) => {
    await page.goto('/es/docs');

    await page.getByTestId('to-button').click();

    await expect(page).toHaveURL('/es/docs/button');
    await expect(title(page)).toHaveText('Botón');
  });

  test('every navigation link is localized, not just the one that was clicked', async ({
    page,
  }) => {
    await page.goto('/uk/docs');

    await expect(page.getByTestId('nav-home')).toHaveAttribute('href', '/uk');
    await expect(page.getByTestId('nav-docs')).toHaveAttribute('href', '/uk/docs');
    await expect(page.getByTestId('nav-button')).toHaveAttribute('href', '/uk/docs/button');
    await expect(page.getByTestId('nav-themes')).toHaveAttribute('href', '/uk/docs/themes');
  });
});

test.describe('switching language', () => {
  test('stays on the same logical page', async ({ page }) => {
    await page.goto('/es/docs/button');

    await page.getByTestId('switch-uk').click();

    await expect(page).toHaveURL('/uk/docs/button');
    await expect(title(page)).toHaveText('Кнопка');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });

  test('drops the prefix when switching back to the source locale', async ({ page }) => {
    await page.goto('/uk/docs/button');

    await page.getByTestId('switch-en').click();

    await expect(page).toHaveURL('/docs/button');
    await expect(title(page)).toHaveText('Button');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('adds the prefix when leaving the source locale', async ({ page }) => {
    await page.goto('/docs');

    await page.getByTestId('switch-es').click();

    await expect(page).toHaveURL('/es/docs');
    await expect(title(page)).toHaveText('Documentación');
  });

  test('preserves query strings and fragments when switching locale', async ({ page }) => {
    await page.goto('/es/docs?tab=api#example');

    await page.getByTestId('switch-uk').click();

    await expect(page).toHaveURL('/uk/docs?tab=api#example');
    await expect(title(page)).toHaveText('Документація');
  });

  test('switches between two secondary locales without losing the logical page', async ({
    page,
  }) => {
    await page.goto('/es/docs/themes');

    await page.getByTestId('switch-uk').click();
    await expect(page).toHaveURL('/uk/docs/themes');
    await expect(title(page)).toHaveText('Теми');

    await page.getByTestId('switch-es').click();
    await expect(page).toHaveURL('/es/docs/themes');
    await expect(title(page)).toHaveText('Temas');
  });

  test('marks the active language in the switcher', async ({ page }) => {
    await page.goto('/es');

    await expect(page.getByTestId('switch-es')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('switch-en')).toHaveAttribute('aria-pressed', 'false');
  });
});
