import { describe, expect, it } from 'vitest';

import { defineMessageContract } from './messages.js';
import { defineRemoteI18n } from './remote-i18n.js';

const contract = defineMessageContract(['nav.docs', 'welcome']);
const loaders = {
  en: () => ({ nav: { docs: 'Docs' }, welcome: 'Hello' }),
  es: () => ({ nav: { docs: 'Documentación' }, welcome: 'Hola' }),
};

describe('defineRemoteI18n', () => {
  it('takes its keys from the contract, not from a static catalog', () => {
    const definition = defineRemoteI18n({
      locales: ['en', 'es'],
      sourceLocale: 'en',
      contract,
      loaders,
    });

    expect(definition.keys).toEqual(['nav.docs', 'welcome']);
    expect(definition.sourceCatalog).toBeUndefined();
  });

  it('builds a router that leaves the source locale unprefixed', () => {
    const definition = defineRemoteI18n({
      locales: ['en', 'es'],
      sourceLocale: 'en',
      contract,
      loaders,
    });

    expect(definition.router.localize('/docs', 'en')).toBe('/docs');
    expect(definition.router.localize('/docs', 'es')).toBe('/es/docs');
  });

  it('configures a loader for the source locale, unlike defineI18n', () => {
    const definition = defineRemoteI18n({
      locales: ['en', 'es'],
      sourceLocale: 'en',
      contract,
      loaders,
    });

    expect(definition.loaderFor('en')).toBe(loaders.en);
    expect(definition.loaderFor('es')).toBe(loaders.es);
  });

  it('rejects a source locale that is not one of the locales', () => {
    expect(() =>
      defineRemoteI18n({
        locales: ['es', 'uk'],
        sourceLocale: 'en' as 'es',
        contract,
        loaders: { es: loaders.es, uk: loaders.es },
      }),
    ).toThrow(/sourceLocale "en" is not in locales/);
  });

  it('rejects a malformed language tag', () => {
    expect(() =>
      defineRemoteI18n({
        locales: ['en_US'],
        sourceLocale: 'en_US',
        contract,
        loaders: { en_US: loaders.en },
      }),
    ).toThrow(/not a well-formed BCP 47 language tag/);
  });

  it('rejects a duplicate locale', () => {
    expect(() =>
      defineRemoteI18n({
        locales: ['en', 'es', 'es'],
        sourceLocale: 'en',
        contract,
        loaders,
      }),
    ).toThrow(/listed twice/);
  });

  it('rejects the source locale having no loader, the inverse of defineI18n', () => {
    expect(() =>
      defineRemoteI18n({
        locales: ['en', 'es'],
        sourceLocale: 'en',
        contract,
        loaders: { es: loaders.es } as never,
      }),
    ).toThrow(/locale "en" has no loader.*including the source locale/s);
  });

  it('rejects a non-source locale having no loader', () => {
    expect(() =>
      defineRemoteI18n({
        locales: ['en', 'es'],
        sourceLocale: 'en',
        contract,
        loaders: { en: loaders.en } as never,
      }),
    ).toThrow(/locale "es" has no loader/);
  });

  it('rejects a loader for an unknown locale', () => {
    expect(() =>
      defineRemoteI18n({
        locales: ['en'],
        sourceLocale: 'en',
        contract,
        loaders: { en: loaders.en, uk: loaders.es } as never,
      }),
    ).toThrow(/loader configured for unknown locale "uk"/);
  });

  it('rejects a non-function loader', () => {
    expect(() =>
      defineRemoteI18n({
        locales: ['en'],
        sourceLocale: 'en',
        contract,
        loaders: { en: 'not a function' } as never,
      }),
    ).toThrow(/loader for locale "en" is a string; expected a function/);
  });

  it('reports text direction, detected and overridden', () => {
    const definition = defineRemoteI18n({
      locales: ['en', 'he', 'uk'],
      sourceLocale: 'en',
      contract,
      loaders: { en: loaders.en, he: loaders.es, uk: loaders.es },
      textDirection: { uk: 'rtl' },
    });

    expect(definition.directionOf('en')).toBe('ltr');
    expect(definition.directionOf('he')).toBe('rtl');
    expect(definition.directionOf('uk')).toBe('rtl');
  });
});
