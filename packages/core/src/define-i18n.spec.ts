import { describe, expect, it } from 'vitest';

import { defineI18n } from './define-i18n.js';
import { EtymaError } from './errors.js';
import { defineMessageContract } from './messages.js';

const source = { nav: { docs: 'Docs' }, welcome: 'Hello, {$name}!' };
const loaders = { es: () => ({ nav: { docs: 'Documentación' } }) };

describe('defineI18n', () => {
  it('flattens the source catalog and exposes its keys', () => {
    const definition = defineI18n({ locales: ['en', 'es'], sourceLocale: 'en', source, loaders });

    expect(definition.keys).toEqual(['nav.docs', 'welcome']);
    expect(definition.sourceCatalog.get('nav.docs')).toBe('Docs');
  });

  it('builds a router that leaves the source locale unprefixed', () => {
    const definition = defineI18n({ locales: ['en', 'es'], sourceLocale: 'en', source, loaders });

    expect(definition.router.localize('/docs', 'en')).toBe('/docs');
    expect(definition.router.localize('/docs', 'es')).toBe('/es/docs');
  });

  it('rejects a source locale that is not one of the locales', () => {
    expect(() =>
      defineI18n({ locales: ['es', 'uk'], sourceLocale: 'en' as 'es', source, loaders }),
    ).toThrow(/sourceLocale "en" is not in locales/);
  });

  it('rejects a malformed language tag', () => {
    expect(() => defineI18n({ locales: ['en_US'], sourceLocale: 'en_US', source })).toThrow(
      /not a well-formed BCP 47 language tag/,
    );
  });

  it('rejects a duplicate locale', () => {
    expect(() =>
      defineI18n({ locales: ['en', 'es', 'es'], sourceLocale: 'en', source, loaders }),
    ).toThrow(/listed twice/);
  });

  it('rejects a locale with no way to load its catalog', () => {
    expect(() => defineI18n({ locales: ['en', 'uk'], sourceLocale: 'en', source })).toThrow(
      /locale "uk" has no loader/,
    );
  });

  it('rejects a loader for an unknown locale', () => {
    expect(() =>
      defineI18n({
        locales: ['en', 'es'],
        sourceLocale: 'en',
        source,
        loaders: { es: () => source, uk: () => source } as never,
      }),
    ).toThrow(/loader configured for unknown locale "uk"/);
  });

  it('rejects a loader for the source locale', () => {
    expect(() =>
      defineI18n({
        locales: ['en', 'es'],
        sourceLocale: 'en',
        source,
        loaders: { en: () => source, es: () => source },
      }),
    ).toThrow(/source locale "en" must not have a loader/);
  });

  it('does not require a loader for the source locale', () => {
    expect(() => defineI18n({ locales: ['en'], sourceLocale: 'en', source })).not.toThrow();
  });

  it('rejects an empty source catalog', () => {
    expect(() => defineI18n({ locales: ['en'], sourceLocale: 'en', source: {} })).toThrow(
      EtymaError,
    );
  });

  it('accepts a source made only of an array of messages, keyed by index', () => {
    const definition = defineI18n({
      locales: ['en'],
      sourceLocale: 'en',
      source: { steps: ['One', 'Two'] },
    });

    expect(definition.keys).toEqual(['steps.0', 'steps.1']);
  });

  it('rejects a source whose only value is an empty array, naming the array', () => {
    expect(() =>
      defineI18n({ locales: ['en'], sourceLocale: 'en', source: { steps: [] } }),
    ).toThrow(/"steps" is an empty array/);
  });

  it('reports text direction, detected and overridden', () => {
    const definition = defineI18n({
      locales: ['en', 'he', 'uk'],
      sourceLocale: 'en',
      source,
      loaders: { he: () => source, uk: () => source },
      textDirection: { uk: 'rtl' },
    });

    expect(definition.directionOf('en')).toBe('ltr');
    expect(definition.directionOf('he')).toBe('rtl');
    expect(definition.directionOf('uk')).toBe('rtl');
  });

  describe('with a contract', () => {
    const contract = defineMessageContract(['nav.docs', 'welcome'], { welcome: ['name'] });

    it('accepts a contract whose keys match the source exactly', () => {
      const definition = defineI18n({ locales: ['en'], sourceLocale: 'en', source, contract });

      expect(definition.keys).toEqual(['nav.docs', 'welcome']);
    });

    it('keeps the source as the runtime catalog', () => {
      const definition = defineI18n({ locales: ['en'], sourceLocale: 'en', source, contract });

      expect(definition.sourceCatalog.get('welcome')).toBe('Hello, {$name}!');
      expect(definition).not.toHaveProperty('contract');
    });

    it('rejects a stale contract missing a key the source has added', () => {
      expect(() =>
        defineI18n({
          locales: ['en'],
          sourceLocale: 'en',
          source: { ...source, nav: { docs: 'Docs', home: 'Home' } },
          contract: contract,
        }),
      ).toThrow(
        'defineI18n: `contract` does not match the source catalog - it was probably generated ' +
          'from an older version of it. Regenerate it (for example with `etyma contract`).\n' +
          '  In the source catalog but not the contract: nav.home',
      );
    });

    it('rejects a contract naming a key the source does not have', () => {
      expect(() =>
        defineI18n({
          locales: ['en'],
          sourceLocale: 'en',
          source,
          contract: defineMessageContract(['nav.docs', 'old.key', 'welcome']) as never,
        }),
      ).toThrow(/In the contract but not the source catalog: old\.key$/);
    });

    it('reports both directions, each sorted, source-only keys first', () => {
      const error = captureError(() =>
        defineI18n({
          locales: ['en'],
          sourceLocale: 'en',
          source: { b: 'B', a: 'A', keep: 'K' },
          contract: defineMessageContract(['z', 'keep', 'y']) as never,
        }),
      );

      expect(error).toBeInstanceOf(EtymaError);
      expect(error.message.split('\n').slice(1)).toEqual([
        '  In the source catalog but not the contract: a, b',
        '  In the contract but not the source catalog: y, z',
      ]);
    });

    it('names at most ten keys of each kind', () => {
      const keys = Array.from({ length: 12 }, (_, index) => `k${String(index).padStart(2, '0')}`);
      const error = captureError(() =>
        defineI18n({
          locales: ['en'],
          sourceLocale: 'en',
          source: Object.fromEntries(keys.map(key => [key, key])),
          contract: defineMessageContract(['other']),
        }),
      );

      expect(error.message).toContain(
        'k00, k01, k02, k03, k04, k05, k06, k07, k08, k09 (and 2 more)',
      );
    });

    it('matches array elements by their indexed keys', () => {
      expect(() =>
        defineI18n({
          locales: ['en'],
          sourceLocale: 'en',
          source: { steps: ['One', 'Two'] },
          contract: defineMessageContract(['steps.0', 'steps.1']),
        }),
      ).not.toThrow();

      expect(() =>
        defineI18n({
          locales: ['en'],
          sourceLocale: 'en',
          source: { steps: ['One', 'Two', 'Three'] },
          contract: defineMessageContract(['steps.0', 'steps.1']),
        }),
      ).toThrow(/In the source catalog but not the contract: steps\.2$/);
    });
  });
});

function captureError(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected a throw');
}
