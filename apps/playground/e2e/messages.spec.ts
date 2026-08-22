import { expect, test } from '@playwright/test';

test.describe('messages', () => {
  test('renders plain and parameterised messages', async ({ page }) => {
    await page.goto('/es');

    await expect(page.getByTestId('lede')).toContainText('Una aplicación Analog real');
    await expect(page.getByTestId('greeting')).toHaveText('¡Hola, Etyma!');
  });

  test('renders a message authored with defineMessages next to the JSON ones', async ({ page }) => {
    await page.goto('/uk');

    await expect(page.getByTestId('tagline')).toHaveText(
      'Інтернаціоналізація для Angular та AnalogJS',
    );
  });

  test('chooses the plural category of the language on screen', async ({ page }) => {
    await page.goto('/uk/docs');

    await expect(page.getByTestId('plural-one')).toHaveText('Задокументовано 1 компонент.');
    await expect(page.getByTestId('plural-few')).toHaveText('Задокументовано 3 компоненти.');
    await expect(page.getByTestId('plural-many')).toHaveText('Задокументовано 12 компонентів.');
  });

  test('has one plural category fewer in English, and picks correctly there too', async ({
    page,
  }) => {
    await page.goto('/docs');

    await expect(page.getByTestId('plural-one')).toHaveText('1 component is documented.');
    await expect(page.getByTestId('plural-many')).toHaveText('12 components are documented.');
  });

  test('resolves a select message', async ({ page }) => {
    await page.goto('/uk/docs/button');

    await expect(page.getByTestId('status')).toHaveText('Бета');
  });

  test('formats a date in the language of the page', async ({ page }) => {
    await page.goto('/es/docs/button');
    const spanish = await page.getByTestId('released').textContent();

    await page.goto('/uk/docs/button');
    const ukrainian = await page.getByTestId('released').textContent();

    expect(spanish).toContain('2026');
    expect(ukrainian).toContain('2026');
    expect(spanish).not.toBe(ukrainian);
  });

  test('falls back to the source catalog for an untranslated key', async ({ page }) => {
    await page.goto('/uk/docs');

    await expect(page.getByTestId('fallback')).toHaveText(
      'This sentence exists only in the source catalog, so Spanish and Ukrainian fall back to it.',
    );
  });

  test('formats a year without a thousands separator', async ({ page }) => {
    await page.goto('/docs');

    await expect(page.getByTestId('footer')).toHaveText(/MIT licensed\. \d{4}$/);
    await expect(page.getByTestId('footer')).not.toHaveText(/,/);
  });
});
