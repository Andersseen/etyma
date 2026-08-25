import { expect, test } from '@playwright/test';

test.describe('site chrome', () => {
  test('keeps the navbar fixed while scrolling and exposes GitHub', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('.site-header');
    await expect(header).toHaveCSS('position', 'fixed');

    const before = await header.boundingBox();
    await page.evaluate(() => {
      window.scrollTo(0, 900);
    });
    const after = await header.boundingBox();

    expect(before?.y).toBe(0);
    expect(after?.y).toBe(0);
    await expect(page.getByTestId('github-link')).toHaveAttribute(
      'href',
      'https://github.com/Andersseen/etyma',
    );
  });

  test('uses the site primary color for the hero CTA', async ({ page }) => {
    await page.goto('/');

    const colors = await page.getByTestId('hero-primary').evaluate(anchor => {
      const button = anchor.querySelector('button');
      const root = document.documentElement;
      const probe = document.createElement('span');

      probe.style.color = getComputedStyle(root).getPropertyValue('--accent').trim();
      document.body.append(probe);

      const result = {
        accent: getComputedStyle(probe).color,
        background: button === null ? '' : getComputedStyle(button).backgroundImage,
      };

      probe.remove();

      return result;
    });

    expect(colors.background).toContain(colors.accent);
  });

  test('switches between dark and light themes and persists the choice', async ({ page }) => {
    await page.goto('/');

    const initialTheme = (await page.locator('html').getAttribute('data-theme')) ?? 'dark';
    const nextTheme = initialTheme === 'dark' ? 'light' : 'dark';

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme);
  });

  test('serves the favicon before Angular routing sees the request', async ({ request }) => {
    const response = await request.get('/favicon.ico');

    expect(response.ok()).toBe(true);
  });

  test('shows back-to-top while scrolling down and hides it when scrolling up', async ({
    page,
  }) => {
    await page.goto('/');

    await page.mouse.wheel(0, 950);
    await expect(page.getByTestId('back-to-top')).toBeVisible();

    await page.mouse.wheel(0, -500);
    await expect(page.getByTestId('back-to-top')).toBeHidden();
  });
});
