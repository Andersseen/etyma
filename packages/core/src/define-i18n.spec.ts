import { describe, expect, it } from 'vitest';

import { defineI18n } from './define-i18n.js';
import { EtymaError } from './errors.js';

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
});
