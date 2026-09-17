import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defineI18n,
  defineMessageContract,
  defineMessages,
  defineRemoteI18n,
  EtymaError,
  type MessageSource,
} from '@etyma/core';

import { createAstroI18n } from './create-astro-i18n.js';
import { setSite } from './__fixtures__/fake-astro-i18n.js';
import type { AstroI18nContext } from './types.js';

vi.mock('astro:i18n', async () => await import('./__fixtures__/fake-astro-i18n.js'));

const source = defineMessages({
  home: { title: 'Inicio' },
  blog: { title: 'Blog' },
  footer: { rights: 'Con licencia MIT. {$year :number useGrouping=never}' },
  posts: {
    count:
      '.input {$count :number}\n.match $count\none {{{$count} entrada}}\n*   {{{$count} entradas}}',
  },
});

const en = {
  home: { title: 'Home' },
  blog: { title: 'Blog' },
  footer: { rights: 'MIT licensed. {$year :number useGrouping=never}' },
  posts: {
    count: '.input {$count :number}\n.match $count\none {{{$count} post}}\n*   {{{$count} posts}}',
  },
};

const uk = {
  home: { title: 'Головна' },
  blog: { title: 'Блог' },
  footer: { rights: 'Ліцензія MIT. {$year :number useGrouping=never}' },
  posts: {
    count:
      '.input {$count :number}\n.match $count\none {{{$count} запис}}\n*   {{{$count} записів}}',
  },
};

function staticDefinition() {
  return defineI18n({
    locales: ['es', 'en', 'uk'],
    sourceLocale: 'es',
    source,
    loaders: {
      en: () => en,
      uk: () => uk,
    },
  });
}

function context(currentLocale: string | undefined, pathname: string): AstroI18nContext {
  return { currentLocale, url: new URL(`https://example.com${pathname}`) };
}

afterEach(() => {
  setSite(undefined);
});

describe('createAstroI18n', () => {
  describe('the source locale is unprefixed', () => {
    it('resolves, translates and formats MessageFormat 2', async () => {
      const etyma = await createAstroI18n(context('es', '/blog'), staticDefinition());

      expect(etyma.locale).toBe('es');
      expect(etyma.sourceLocale).toBe('es');
      expect(etyma.locales).toEqual(['es', 'en', 'uk']);
      expect(etyma.direction).toBe('ltr');
      expect(etyma.t('home.title')).toBe('Inicio');
      expect(etyma.t('footer.rights', { year: 2026 })).toBe('Con licencia MIT. 2026');
      expect(etyma.t('posts.count', { count: 1 })).toBe('1 entrada');
      expect(etyma.t('posts.count', { count: 3 })).toBe('3 entradas');
      expect(etyma.has('home.title')).toBe(true);
    });

    it('rejects a source locale served from a prefixed URL', async () => {
      await expect(createAstroI18n(context('es', '/es/blog'), staticDefinition())).rejects.toThrow(
        EtymaError,
      );
    });
  });

  describe('a plain non-default locale, `/en`', () => {
    it('loads the English catalog and localizes paths', async () => {
      const etyma = await createAstroI18n(context('en', '/en/blog'), staticDefinition());

      expect(etyma.locale).toBe('en');
      expect(etyma.t('home.title')).toBe('Home');
      expect(etyma.path('/blog')).toBe('/en/blog');
      expect(etyma.path('/blog', 'es')).toBe('/blog');
    });
  });

  describe('a custom route path whose language code differs from it, `/ua` for `uk`', () => {
    it('resolves the real BCP 47 locale, not the Astro route path', async () => {
      const etyma = await createAstroI18n(context('uk', '/ua/blog'), staticDefinition());

      // This is the release-blocking case: Astro's own currentLocale already resolves
      // "ua" to "uk", and Etyma must trust that instead of reading the path itself.
      expect(etyma.locale).toBe('uk');
      expect(etyma.locale).not.toBe('ua');
      expect(etyma.t('home.title')).toBe('Головна');
      expect(etyma.direction).toBe('ltr');
    });

    it('localizes paths through the "ua" route, in both directions', async () => {
      const etyma = await createAstroI18n(context('uk', '/ua/blog'), staticDefinition());

      expect(etyma.path('/blog')).toBe('/ua/blog');
      expect(etyma.path('/blog', 'uk')).toBe('/ua/blog');
      expect(etyma.path('/blog', 'es')).toBe('/blog');
      expect(etyma.path('/blog', 'en')).toBe('/en/blog');
    });

    it('preserves query strings and fragments when localizing a path', async () => {
      const etyma = await createAstroI18n(context('uk', '/ua/blog'), staticDefinition());

      expect(etyma.path('/blog?tag=angular#latest', 'uk')).toBe('/ua/blog?tag=angular#latest');
      expect(etyma.path('/blog?tag=angular#latest', 'es')).toBe('/blog?tag=angular#latest');
    });
  });

  describe('validation', () => {
    it('rejects a request Astro has not resolved a locale for', async () => {
      await expect(createAstroI18n(context(undefined, '/'), staticDefinition())).rejects.toThrow(
        EtymaError,
      );
    });

    it('rejects a locale Astro resolved that Etyma is not configured for', async () => {
      const definition = defineI18n({
        locales: ['es', 'en'],
        sourceLocale: 'es',
        source,
        loaders: { en: () => en },
      });

      // Astro's own config has a third locale ("uk"/"ua") that this Etyma definition was
      // never told about - the mismatch this package must surface, not silently ignore.
      await expect(createAstroI18n(context('uk', '/ua/blog'), definition)).rejects.toThrow(
        EtymaError,
      );
    });

    it('rejects an unknown target locale passed to path()', async () => {
      const etyma = await createAstroI18n(context('es', '/blog'), staticDefinition());

      expect(() => etyma.path('/blog', 'fr')).toThrow(EtymaError);
    });
  });

  describe('an RTL locale', () => {
    it('reports the correct text direction', async () => {
      const definition = defineI18n({
        locales: ['en', 'he'],
        sourceLocale: 'en',
        source: en,
        loaders: { he: () => ({ home: { title: 'בית' } }) },
      });

      const etyma = await createAstroI18n(context('he', '/he'), definition);

      expect(etyma.locale).toBe('he');
      expect(etyma.direction).toBe('rtl');
    });
  });

  describe('remote definitions', () => {
    it('works the same way as a static definition, unchanged', async () => {
      const contract = defineMessageContract(['home.title', 'blog.title'] as const);

      const definition = defineRemoteI18n({
        locales: ['es', 'en'],
        sourceLocale: 'es',
        contract,
        loaders: {
          es: (): MessageSource => ({ home: { title: 'Inicio' }, blog: { title: 'Blog' } }),
          en: (): MessageSource => ({ home: { title: 'Home' }, blog: { title: 'Blog' } }),
        },
      });

      const etyma = await createAstroI18n(context('en', '/en'), definition);

      expect(etyma.t('home.title')).toBe('Home');
      expect(etyma.path('/blog')).toBe('/en/blog');
    });
  });

  describe('seo()', () => {
    it('keys the alternate set by BCP 47 language code, never the Astro route path', async () => {
      const etyma = await createAstroI18n(context('uk', '/ua/blog'), staticDefinition());
      const seo = etyma.seo();

      expect(seo.lang).toBe('uk');
      expect(seo.direction).toBe('ltr');

      const hreflangs = seo.alternates.map(alternate => alternate.hreflang);
      expect(hreflangs).toEqual(['es', 'en', 'uk']);
      expect(hreflangs).not.toContain('ua');
    });

    it('resolves canonical, alternates and x-default against Astro.site', async () => {
      setSite('https://example.com');

      const etyma = await createAstroI18n(context('uk', '/ua/blog'), staticDefinition());
      const seo = etyma.seo();

      expect(seo.canonical).toBe('https://example.com/ua/blog');
      expect(seo.alternates).toEqual([
        { hreflang: 'es', href: 'https://example.com/blog' },
        { hreflang: 'en', href: 'https://example.com/en/blog' },
        { hreflang: 'uk', href: 'https://example.com/ua/blog' },
      ]);
      // x-default is the source locale's canonical equivalent, not a copy of the current page.
      expect(seo.xDefault).toBe('https://example.com/blog');
    });

    it('falls back to relative URLs when Astro.site is not configured', async () => {
      const etyma = await createAstroI18n(context('en', '/en/blog'), staticDefinition());
      const seo = etyma.seo();

      expect(seo.canonical).toBe('/en/blog');
      expect(seo.xDefault).toBe('/blog');
    });
  });
});
