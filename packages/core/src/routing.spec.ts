import { beforeEach, describe, expect, it } from 'vitest';

import { createLocaleRouter, type LocaleRouter } from './routing.js';

describe('createLocaleRouter', () => {
  let router: LocaleRouter;

  beforeEach(() => {
    router = createLocaleRouter({ locales: ['en', 'es', 'uk'], sourceLocale: 'en' });
  });

  it('serves the source locale without a prefix', () => {
    expect(router.localize('/docs/button', 'en')).toBe('/docs/button');
    expect(router.localize('/', 'en')).toBe('/');
  });

  it('prefixes every other locale', () => {
    expect(router.localize('/docs/button', 'es')).toBe('/es/docs/button');
    expect(router.localize('/', 'uk')).toBe('/uk');
  });

  it('reads the locale from the first segment, defaulting to the source', () => {
    expect(router.localeOf('/es/docs')).toBe('es');
    expect(router.localeOf('/docs')).toBe('en');
    expect(router.localeOf('/')).toBe('en');
  });

  it('does not mistake a page for a locale', () => {
    expect(router.localeOf('/docs/es')).toBe('en');
    expect(router.strip('/docs/es')).toBe('/docs/es');
  });

  it('switches locale while keeping the logical page', () => {
    const spanish = '/es/docs/button';

    expect(router.localize(spanish, 'uk')).toBe('/uk/docs/button');
    expect(router.localize(router.localize(spanish, 'uk'), 'en')).toBe('/docs/button');
  });

  it('round-trips through the source locale', () => {
    for (const path of ['/', '/docs', '/docs/button']) {
      expect(router.localize(router.localize(path, 'uk'), 'en')).toBe(path);
    }
  });

  it('keeps the query string and fragment attached to the page', () => {
    expect(router.localize('/docs?tab=api#usage', 'es')).toBe('/es/docs?tab=api#usage');
    expect(router.strip('/es/docs?tab=api#usage')).toBe('/docs?tab=api#usage');
    expect(router.localeOf('/es/docs?tab=api')).toBe('es');
  });

  it('normalises a path that does not start with a slash', () => {
    expect(router.localize('docs', 'es')).toBe('/es/docs');
  });

  it('recognises only configured locales', () => {
    expect(router.isLocale('es')).toBe(true);
    expect(router.isLocale('de')).toBe(false);
    expect(router.isLocale(undefined)).toBe(false);
  });
});
