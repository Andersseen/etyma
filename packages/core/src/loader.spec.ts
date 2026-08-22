import { describe, expect, it } from 'vitest';

import { EtymaError } from './errors.js';
import { loadMessageCatalog, toMessageSource } from './loader.js';

describe('toMessageSource', () => {
  it('accepts a plain catalog', () => {
    const source = { nav: { docs: 'Docs' } };

    expect(toMessageSource(source, 'en')).toBe(source);
  });

  it('unwraps a module namespace, which is what a dynamic JSON import resolves to', () => {
    const namespace = Object.defineProperty(
      { default: { nav: { docs: 'Docs' } } },
      Symbol.toStringTag,
      {
        value: 'Module',
      },
    );

    expect(toMessageSource(namespace, 'es')).toEqual({ nav: { docs: 'Docs' } });
  });

  it('unwraps an interop namespace flagged by a bundler', () => {
    const interop = { __esModule: true, default: { nav: { docs: 'Docs' } } };

    expect(toMessageSource(interop, 'es')).toEqual({ nav: { docs: 'Docs' } });
  });

  it('keeps a catalog whose own top-level key happens to be "default"', () => {
    const source = { default: { label: 'Default' } };

    expect(toMessageSource(source, 'en')).toBe(source);
  });

  it('rejects a loader that resolved to nothing useful', () => {
    expect(() => toMessageSource(null, 'es')).toThrow(EtymaError);
    expect(() => toMessageSource('nope', 'es')).toThrow(/expected an object/);
  });
});

describe('loadMessageCatalog', () => {
  it('flattens whatever the loader returns', async () => {
    const catalog = await loadMessageCatalog('es', () => ({ nav: { docs: 'Documentación' } }));

    expect(catalog.get('nav.docs')).toBe('Documentación');
  });

  it('awaits an asynchronous loader', async () => {
    const catalog = await loadMessageCatalog('es', async () => {
      await Promise.resolve();

      return { nav: { docs: 'Documentación' } };
    });

    expect(catalog.get('nav.docs')).toBe('Documentación');
  });

  it('passes the locale to the loader, so one function can serve every locale', async () => {
    const seen: string[] = [];

    await loadMessageCatalog('uk', locale => {
      seen.push(locale);

      return { a: 'x' };
    });

    expect(seen).toEqual(['uk']);
  });
});
