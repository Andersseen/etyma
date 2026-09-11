import { afterEach, describe, expect, it, vi } from 'vitest';

import { EtymaError } from './errors.js';
import { createHttpMessageLoader, loadMessageCatalog, toMessageSource } from './loader.js';

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

describe('createHttpMessageLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(
    response: Partial<Response> & { readonly ok: boolean },
  ): ReturnType<typeof vi.fn> {
    const fetch = vi.fn(() => Promise.resolve(response as Response));

    vi.stubGlobal('fetch', fetch);

    return fetch;
  }

  it('resolves to the parsed body on a successful response', async () => {
    stubFetch({ ok: true, json: () => Promise.resolve({ nav: { docs: 'Docs' } }) });

    const catalog = await loadMessageCatalog(
      'en',
      createHttpMessageLoader('https://cdn.example.com/en.json'),
    );

    expect(catalog.get('nav.docs')).toBe('Docs');
  });

  it('accepts a per-locale URL function', async () => {
    const fetch = stubFetch({ ok: true, json: () => Promise.resolve({ a: 'x' }) });

    await loadMessageCatalog(
      'uk',
      createHttpMessageLoader(locale => `https://cdn.example.com/${locale}.json`),
    );

    expect(fetch).toHaveBeenCalledWith('https://cdn.example.com/uk.json', undefined);
  });

  it('passes init through to fetch', async () => {
    const fetch = stubFetch({ ok: true, json: () => Promise.resolve({ a: 'x' }) });
    const init = { headers: { Authorization: 'Bearer token' } };

    await loadMessageCatalog(
      'en',
      createHttpMessageLoader('https://cdn.example.com/en.json', init),
    );

    expect(fetch).toHaveBeenCalledWith('https://cdn.example.com/en.json', init);
  });

  it('rejects with an EtymaError naming the locale, URL and status on a non-OK response', async () => {
    stubFetch({ ok: false, status: 404, statusText: 'Not Found' });

    await expect(
      loadMessageCatalog('es', createHttpMessageLoader('https://cdn.example.com/es.json')),
    ).rejects.toThrow(/"es".*https:\/\/cdn\.example\.com\/es\.json.*HTTP 404/s);
  });

  it('rejects with an EtymaError on a fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );

    await expect(
      loadMessageCatalog('en', createHttpMessageLoader('https://cdn.example.com/en.json')),
    ).rejects.toThrow(EtymaError);
  });

  it('rejects with an EtymaError on invalid JSON', async () => {
    stubFetch({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token')) });

    await expect(
      loadMessageCatalog('en', createHttpMessageLoader('https://cdn.example.com/en.json')),
    ).rejects.toThrow(/not valid JSON/);
  });
});
