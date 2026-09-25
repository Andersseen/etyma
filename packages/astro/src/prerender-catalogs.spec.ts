import { describe, expect, it, vi } from 'vitest';
import {
  defineI18n,
  defineMessageContract,
  defineRemoteI18n,
  type Locale,
  type MessageSource,
} from '@etyma/core';

import { createAstroI18n } from './create-astro-i18n.js';
import type { AstroI18nContext } from './types.js';

const catalogs: Readonly<Record<Locale, MessageSource>> = {
  es: { home: { title: 'Inicio' }, blog: { title: 'Blog' } },
  // No `blog.title`: English falls back to the source locale for it.
  en: { home: { title: 'Home' } },
  uk: { home: { title: 'Головна' }, blog: { title: 'Блог' } },
};

const contract = defineMessageContract(['home.title', 'blog.title'] as const);

/** Where each locale is served, per the fake `astro:i18n` routing table (`uk` at `/ua`). */
const routes: Readonly<Record<Locale, string>> = { es: '', en: '/en', uk: '/ua' };

/**
 * A remote definition whose loaders count their calls. Every test builds its own, so the
 * process-lifetime prerender cache - keyed by definition identity - never carries one test's
 * catalogs into another.
 */
function remoteDefinition(options: { id?: string; fail?: Set<Locale>; gate?: Promise<void> } = {}) {
  const calls: Record<Locale, number> = { es: 0, en: 0, uk: 0 };

  const load = async (locale: Locale): Promise<MessageSource> => {
    calls[locale] = (calls[locale] ?? 0) + 1;

    await options.gate;

    if (options.fail?.delete(locale)) {
      throw new Error(`catalog server unavailable for ${locale}`);
    }

    const catalog = catalogs[locale];
    if (catalog === undefined) throw new Error(`no catalog for ${locale}`);

    return catalog;
  };

  const definition = defineRemoteI18n({
    ...(options.id === undefined ? {} : { id: options.id }),
    locales: ['es', 'en', 'uk'],
    sourceLocale: 'es',
    contract,
    loaders: { es: load, en: load, uk: load },
  });

  return { definition, calls };
}

function page(locale: Locale, path: string, isPrerendered: boolean | undefined): AstroI18nContext {
  const url = new URL(`https://example.com${routes[locale] ?? ''}${path}`);

  return isPrerendered === undefined
    ? { currentLocale: locale, url }
    : { currentLocale: locale, url, isPrerendered };
}

describe('catalog reuse across prerendered pages', () => {
  it('loads each locale once, however many pages render it', async () => {
    const { definition, calls } = remoteDefinition();

    for (const locale of ['es', 'en', 'uk']) {
      for (const path of ['/', '/blog', '/about']) {
        await createAstroI18n(page(locale, path, true), definition);
      }
    }

    expect(calls).toEqual({ es: 1, en: 1, uk: 1 });
  });

  it('loads the source catalog once for secondary-locale pages, and still falls back to it', async () => {
    const { definition, calls } = remoteDefinition();

    const first = await createAstroI18n(page('en', '/', true), definition);
    const second = await createAstroI18n(page('en', '/blog', true), definition);
    const ukrainian = await createAstroI18n(page('uk', '/', true), definition);

    expect(calls).toEqual({ es: 1, en: 1, uk: 1 });
    expect(first.t('home.title')).toBe('Home');
    // English has no `blog.title`; the source locale's is used, exactly as without reuse.
    expect(second.t('blog.title')).toBe('Blog');
    expect(second.has('blog.title')).toBe(true);
    expect(ukrainian.t('blog.title')).toBe('Блог');
  });

  it('shares one in-flight load between pages prerendering at the same time', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const { definition, calls } = remoteDefinition({ gate });

    const rendering = Promise.all([
      ...['/', '/a', '/b', '/c', '/d'].map(path =>
        createAstroI18n(page('es', path, true), definition),
      ),
      createAstroI18n(page('en', '/', true), definition),
      createAstroI18n(page('en', '/blog', true), definition),
      createAstroI18n(page('uk', '/', true), definition),
    ]);

    // Every render has started and is waiting on a load; none of those loads has finished.
    await vi.waitFor(() => {
      expect(calls).toEqual({ es: 1, en: 1, uk: 1 });
    });
    release();
    const pages = await rendering;

    expect(calls).toEqual({ es: 1, en: 1, uk: 1 });
    expect(pages.map(etyma => etyma.t('home.title'))).toEqual([
      'Inicio',
      'Inicio',
      'Inicio',
      'Inicio',
      'Inicio',
      'Home',
      'Home',
      'Головна',
    ]);
  });

  it('retries a catalog whose load failed instead of caching the failure', async () => {
    const { definition, calls } = remoteDefinition({ fail: new Set(['uk']) });

    await expect(createAstroI18n(page('uk', '/', true), definition)).rejects.toThrow(
      'catalog server unavailable for uk',
    );

    const retried = await createAstroI18n(page('uk', '/blog', true), definition);
    await createAstroI18n(page('uk', '/about', true), definition);

    expect(retried.t('home.title')).toBe('Головна');
    // One failed attempt, one successful retry, then reuse - and the source catalog, which
    // loaded fine the first time, is not fetched again.
    expect(calls).toEqual({ es: 1, en: 0, uk: 2 });
  });

  it('keeps definitions apart even when they share an id', async () => {
    const a = remoteDefinition({ id: 'etyma' });
    const b = remoteDefinition({ id: 'etyma' });

    expect(a.definition.id).toBe(b.definition.id);

    await createAstroI18n(page('en', '/', true), a.definition);
    await createAstroI18n(page('en', '/', true), b.definition);
    await createAstroI18n(page('en', '/blog', true), a.definition);
    await createAstroI18n(page('en', '/blog', true), b.definition);

    expect(a.calls).toEqual({ es: 1, en: 1, uk: 0 });
    expect(b.calls).toEqual({ es: 1, en: 1, uk: 0 });
  });

  it('keeps locale, paths and SEO per page', async () => {
    const { definition } = remoteDefinition();

    await createAstroI18n(page('es', '/blog', true), definition);
    const etyma = await createAstroI18n(page('uk', '/blog', true), definition);

    expect(etyma.locale).toBe('uk');
    expect(etyma.t('home.title')).toBe('Головна');
    expect(etyma.path('/about')).toBe('/ua/about');
    expect(etyma.seo().canonical).toBe('/ua/blog');
    expect(etyma.seo().xDefault).toBe('/blog');
  });

  it('loads a static definition’s lazy catalogs once, and its source never', async () => {
    const calls: Record<Locale, number> = { en: 0, uk: 0 };
    const count = (locale: Locale): MessageSource => {
      calls[locale] = (calls[locale] ?? 0) + 1;
      return catalogs[locale] ?? {};
    };

    const definition = defineI18n({
      locales: ['es', 'en', 'uk'],
      sourceLocale: 'es',
      source: { home: { title: 'Inicio' }, blog: { title: 'Blog' } },
      loaders: { en: () => count('en'), uk: () => count('uk') },
    });

    for (const locale of ['es', 'en', 'uk']) {
      for (const path of ['/', '/blog']) {
        await createAstroI18n(page(locale, path, true), definition);
      }
    }

    const english = await createAstroI18n(page('en', '/about', true), definition);

    expect(calls).toEqual({ en: 1, uk: 1 });
    expect(english.t('blog.title')).toBe('Blog');
  });
});

describe('on-demand renders stay isolated', () => {
  it.each([
    ['false', false],
    ['absent', undefined],
  ])('loads catalogs per request when isPrerendered is %s', async (_, isPrerendered) => {
    const { definition, calls } = remoteDefinition();

    await createAstroI18n(page('es', '/', isPrerendered), definition);
    await createAstroI18n(page('es', '/blog', isPrerendered), definition);
    await createAstroI18n(page('en', '/', isPrerendered), definition);

    expect(calls).toEqual({ es: 3, en: 1, uk: 0 });
  });

  it('gives two concurrent requests in different locales nothing in common', async () => {
    const { definition, calls } = remoteDefinition();

    const [a, b] = await Promise.all([
      createAstroI18n(page('es', '/blog', false), definition),
      createAstroI18n(page('uk', '/blog', false), definition),
    ]);

    // Request B's own source fallback is a second `es` load: nothing was shared with A.
    expect(calls).toEqual({ es: 2, en: 0, uk: 1 });
    expect(a.locale).toBe('es');
    expect(a.t('home.title')).toBe('Inicio');
    expect(b.locale).toBe('uk');
    expect(b.t('home.title')).toBe('Головна');
  });

  it('neither fills nor reads the prerender cache', async () => {
    const { definition, calls } = remoteDefinition();

    await createAstroI18n(page('en', '/', false), definition);
    await createAstroI18n(page('en', '/', true), definition);
    await createAstroI18n(page('en', '/blog', false), definition);

    // One load each for the first request, the first prerendered page and the second request:
    // the prerender cache was neither seeded by the request before it nor used by the one after.
    expect(calls).toEqual({ es: 3, en: 3, uk: 0 });
  });
});
