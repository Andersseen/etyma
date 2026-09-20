import { afterEach, describe, expect, it } from 'vitest';

import {
  delayed,
  hang,
  json,
  rendezvous,
  stallBody,
  startFixtureServer,
  status,
  unusedOrigin,
} from '../__testing__/fixture-server.js';
import type { FixtureServer, RouteHandler } from '../__testing__/fixture-server.js';
import {
  DEFAULT_TIMEOUT_MS,
  fetchRemoteCatalogs,
  RemoteConfigError,
  resolveRemoteConfig,
} from './remote-catalogs.js';

const TEMPLATE = 'https://cdn.example.com/i18n/{locale}.json';

function resolve(overrides: Partial<Parameters<typeof resolveRemoteConfig>[0]> = {}) {
  return resolveRemoteConfig({
    template: TEMPLATE,
    locales: 'en,es,uk',
    sourceLocale: 'en',
    timeout: undefined,
    ...overrides,
  });
}

function failure(overrides: Partial<Parameters<typeof resolveRemoteConfig>[0]>): string {
  try {
    resolve(overrides);
  } catch (error) {
    expect(error).toBeInstanceOf(RemoteConfigError);
    return (error as Error).message;
  }

  throw new Error('expected resolveRemoteConfig to throw');
}

describe('resolveRemoteConfig', () => {
  it('resolves the {locale} template once per requested locale', () => {
    expect(resolve().targets).toEqual([
      { locale: 'en', url: 'https://cdn.example.com/i18n/en.json' },
      { locale: 'es', url: 'https://cdn.example.com/i18n/es.json' },
      { locale: 'uk', url: 'https://cdn.example.com/i18n/uk.json' },
    ]);
  });

  it('sorts targets by locale, whatever order --locales gave them in', () => {
    const targets = resolve({ locales: 'uk,en,es' }).targets;

    expect(targets.map(target => target.locale)).toEqual(['en', 'es', 'uk']);
  });

  it('keeps region and script subtags intact in the URL', () => {
    const urls = resolve({ locales: 'en,es-MX,pt-BR,zh-Hant' }).targets.map(target => target.url);

    expect(urls).toEqual([
      'https://cdn.example.com/i18n/en.json',
      'https://cdn.example.com/i18n/es-MX.json',
      'https://cdn.example.com/i18n/pt-BR.json',
      'https://cdn.example.com/i18n/zh-Hant.json',
    ]);
  });

  it('replaces every occurrence of the placeholder', () => {
    const { targets } = resolve({
      template: 'https://cdn.example.com/{locale}/messages.{locale}.json',
    });

    expect(targets[0]?.url).toBe('https://cdn.example.com/en/messages.en.json');
  });

  it('allows the placeholder in the host and in the query string', () => {
    expect(resolve({ template: 'https://{locale}.example.com/i18n.json' }).targets[1]?.url).toBe(
      'https://es.example.com/i18n.json',
    );
    expect(resolve({ template: 'https://example.com/i18n?lang={locale}' }).targets[2]?.url).toBe(
      'https://example.com/i18n?lang=uk',
    );
  });

  it('accepts http: as well as https:', () => {
    expect(resolve({ template: 'http://localhost:4321/{locale}.json' }).targets).toHaveLength(3);
  });

  it('trims whitespace around each locale', () => {
    expect(resolve({ locales: ' en , es,uk ' }).targets.map(target => target.locale)).toEqual([
      'en',
      'es',
      'uk',
    ]);
  });

  it('percent-encodes a locale so it cannot change the URL structure', () => {
    const { targets } = resolve({ locales: 'en,../x' });

    expect(targets.find(target => target.locale === '../x')?.url).toBe(
      'https://cdn.example.com/i18n/..%2Fx.json',
    );
  });

  it('leaves canonical-equivalent locales to @etyma/tooling instead of judging them', () => {
    // `en-US` and `en-us` are one BCP 47 tag; validateCatalogs reports that as
    // config.duplicate-locale, exactly as it does for local files. Not a second validator here.
    expect(resolve({ locales: 'en,en-US,en-us' }).targets).toHaveLength(3);
  });

  it('defaults the timeout, and accepts an explicit one', () => {
    expect(resolve().timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(resolve({ timeout: '2500' }).timeoutMs).toBe(2500);
  });

  it('echoes the template as typed', () => {
    expect(resolve().template).toBe(TEMPLATE);
  });

  describe('rejects, before any fetch,', () => {
    it('a template without {locale}', () => {
      expect(failure({ template: 'https://cdn.example.com/i18n/en.json' })).toContain('{locale}');
    });

    it('a missing --locales', () => {
      expect(failure({ locales: undefined })).toContain('--locales');
    });

    it('an empty --locales', () => {
      expect(failure({ locales: '' })).toContain('--locales is empty');
    });

    it('an empty entry in --locales', () => {
      expect(failure({ locales: 'en,,es' })).toContain('empty entry');
      expect(failure({ locales: 'en,es,' })).toContain('empty entry');
    });

    it('a duplicate locale', () => {
      expect(failure({ locales: 'en,es,en' })).toContain('"en" more than once');
    });

    it('a source locale that is not in --locales', () => {
      expect(failure({ sourceLocale: 'fr' })).toContain('"fr" is not in --locales');
    });

    it('a malformed URL', () => {
      expect(failure({ template: 'not a url/{locale}.json' })).toContain('not a valid URL');
      expect(failure({ template: '/i18n/{locale}.json' })).toContain('not a valid URL');
    });

    it.each([
      ['file', 'file:///etc/{locale}.json'],
      ['data', 'data:application/json,{locale}'],
      ['javascript', 'javascript:alert("{locale}")'],
      ['ftp', 'ftp://example.com/{locale}.json'],
    ])('a %s: URL', (protocol, template) => {
      expect(failure({ template })).toContain(`"${protocol}:"`);
    });

    it('credentials embedded in the URL, without echoing them', () => {
      const message = failure({ template: 'https://user:hunter2@example.com/{locale}.json' });

      expect(message).toContain('credentials');
      expect(message).not.toContain('hunter2');
    });

    it.each(['abc', '0', '-5', '1.5', '10s', '', '99999999999'])('--timeout "%s"', timeout => {
      expect(failure({ timeout })).toContain('--timeout');
    });
  });
});

describe('fetchRemoteCatalogs', () => {
  let server: FixtureServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function serve(routes: Record<string, RouteHandler>): Promise<FixtureServer> {
    server = await startFixtureServer(routes);
    return server;
  }

  function config(origin: string, locales = 'en,es,uk', timeout = '3000') {
    return resolve({ template: `${origin}/i18n/{locale}.json`, locales, timeout });
  }

  it('fetches every locale and parses each response as JSON', async () => {
    const { origin } = await serve({
      '/i18n/en.json': json({ hello: 'Hello' }),
      '/i18n/es.json': json({ hello: 'Hola' }),
      '/i18n/uk.json': json({ hello: 'Привіт' }),
    });

    const results = await fetchRemoteCatalogs(config(origin));

    expect(results.map(result => [result.locale, result.data, result.error])).toEqual([
      ['en', { hello: 'Hello' }, undefined],
      ['es', { hello: 'Hola' }, undefined],
      ['uk', { hello: 'Привіт' }, undefined],
    ]);
    expect(results[0]?.url).toBe(`${origin}/i18n/en.json`);
  });

  it('keeps target order even when the network answers in a different order', async () => {
    const { origin } = await serve({
      '/i18n/en.json': delayed(150, json({ n: 'en' })),
      '/i18n/es.json': json({ n: 'es' }),
      '/i18n/uk.json': delayed(50, json({ n: 'uk' })),
    });

    const results = await fetchRemoteCatalogs(config(origin));

    expect(results.map(result => result.locale)).toEqual(['en', 'es', 'uk']);
    expect(results.map(result => result.data)).toEqual([{ n: 'en' }, { n: 'es' }, { n: 'uk' }]);
  });

  it('fetches concurrently instead of one locale after another', async () => {
    // Nothing is answered until all three requests are in flight; a serial client deadlocks
    // here and only escapes through the timeout, which would surface as an error below.
    const barrier = rendezvous(3);
    const gate = (locale: string) => barrier(json({ locale }));
    const { origin } = await serve({
      '/i18n/en.json': gate('en'),
      '/i18n/es.json': gate('es'),
      '/i18n/uk.json': gate('uk'),
    });

    const results = await fetchRemoteCatalogs(config(origin, 'en,es,uk', '2000'));

    expect(results.map(result => result.error)).toEqual([undefined, undefined, undefined]);
  });

  it('reports an HTTP error status with the locale and URL, and never the body', async () => {
    const { origin } = await serve({
      '/i18n/en.json': json({ hello: 'Hello' }),
      '/i18n/es.json': status(500, `<html>${'x'.repeat(50_000)}</html>`, 'text/html'),
    });

    const results = await fetchRemoteCatalogs(config(origin, 'en,es,uk'));
    const es = results.find(result => result.locale === 'es');
    const uk = results.find(result => result.locale === 'uk');

    expect(es).toMatchObject({ locale: 'es', url: `${origin}/i18n/es.json` });
    expect(es?.error).toMatch(/^HTTP 500/);
    expect(es?.error).not.toContain('xxx');
    expect(uk?.error).toMatch(/^HTTP 404/);
    expect(uk?.data).toBeUndefined();
  });

  it('reports a body that is not JSON, with a bounded, body-free message', async () => {
    const { origin } = await serve({
      '/i18n/en.json': status(200, `<!DOCTYPE html>${'y'.repeat(50_000)}`, 'text/html'),
    });

    const [result] = await fetchRemoteCatalogs(config(origin, 'en'));

    expect(result?.data).toBeUndefined();
    expect(result?.error).toContain('not valid JSON');
    expect(result?.error).toBe('response is not valid JSON [text/html] (starts with "<")');
    expect(result?.error).not.toContain('DOCTYPE');
  });

  it('does not treat a JSON content-type as a hint worth printing', async () => {
    const { origin } = await serve({ '/i18n/en.json': status(200, '{oops', 'application/json') });

    const [result] = await fetchRemoteCatalogs(config(origin, 'en'));

    expect(result?.error).toBe('response is not valid JSON (starts with "{")');
  });

  it('describes an empty body without inventing a first character', async () => {
    const { origin } = await serve({ '/i18n/en.json': status(200, '', 'application/json') });

    const [result] = await fetchRemoteCatalogs(config(origin, 'en'));

    expect(result?.error).toBe('response is not valid JSON (empty body)');
  });

  it('reports a refused connection as a network error', async () => {
    const origin = await unusedOrigin();

    const [result] = await fetchRemoteCatalogs(config(origin, 'en'));

    expect(result?.data).toBeUndefined();
    expect(result?.error).toMatch(/^network error: .*ECONNREFUSED/);
  });

  it('gives up on a host that never answers, after the timeout', async () => {
    const { origin } = await serve({ '/i18n/en.json': hang() });

    const started = Date.now();
    const [result] = await fetchRemoteCatalogs(config(origin, 'en', '200'));

    expect(result?.error).toBe('timed out after 200ms');
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('also bounds a response body that stalls after the headers', async () => {
    const { origin } = await serve({ '/i18n/en.json': stallBody() });

    const [result] = await fetchRemoteCatalogs(config(origin, 'en', '200'));

    expect(result?.error).toBe('timed out after 200ms');
  });

  it('follows an ordinary redirect', async () => {
    const { origin } = await serve({
      '/i18n/en.json': (_request, response) => {
        response.writeHead(302, { location: '/moved/en.json' });
        response.end();
      },
      '/moved/en.json': json({ hello: 'Hello' }),
    });

    const [result] = await fetchRemoteCatalogs(config(origin, 'en'));

    expect(result?.data).toEqual({ hello: 'Hello' });
  });

  it('sends no request headers of its own beyond the platform defaults', async () => {
    let received: Record<string, string | string[] | undefined> = {};

    const { origin } = await serve({
      '/i18n/en.json': (request, response) => {
        received = request.headers;
        json({})(request, response);
      },
    });

    await fetchRemoteCatalogs(config(origin, 'en'));

    expect(received['authorization']).toBeUndefined();
    expect(received['cookie']).toBeUndefined();
  });
});
