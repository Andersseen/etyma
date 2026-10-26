import { expect, test } from '@playwright/test';

test.describe('landing page', () => {
  test('the live demo formats real MessageFormat 2 plurals per language', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/uk');

    const demo = page.getByTestId('live-demo');
    await expect(demo.getByTestId('demo-inbox')).toHaveText('У вас 3 нові повідомлення');
    await expect(demo.getByTestId('demo-url')).toContainText('/uk/inbox');

    await demo.getByTestId('demo-en').click();
    await expect(demo.getByTestId('demo-inbox')).toHaveText('You have 3 new messages');
    await expect(demo.getByTestId('demo-url')).not.toContainText('/en');
  });

  test('the quick start switches framework', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('start-astro').click();
    await expect(page.locator('#start')).toContainText('pnpm add @etyma/core @etyma/astro');
  });

  test('robots.txt and the sitemap are served as static files', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain('Sitemap:');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain('hreflang="x-default"');
  });
});
