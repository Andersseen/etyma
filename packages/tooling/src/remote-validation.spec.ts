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
} from './__testing__/fixture-server.js';
import type { FixtureServer, RouteHandler } from './__testing__/fixture-server.js';
import { validateCatalogs } from './validate-catalogs.js';
import { etymaRemoteValidation } from './vite.js';
import type { EtymaRemoteValidationOptions, EtymaRemoteValidationPlugin } from './vite.js';

const en = { nav: { docs: 'Docs' }, footer: { rights: '© {$year :number useGrouping=never}' } };
const es = {
  nav: { docs: 'Documentación' },
  footer: { rights: '© {$year :number useGrouping=never}' },
};
const uk = {
  nav: { docs: 'Документація' },
  footer: { rights: '© {$year :number useGrouping=never}' },
};

let server: FixtureServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function serve(routes: Record<string, RouteHandler>): Promise<FixtureServer> {
  server = await startFixtureServer(routes);
  return server;
}

function catalogs(overrides: Record<string, unknown> = {}): Record<string, RouteHandler> {
  const all: Record<string, unknown> = { en, es, uk, ...overrides };

  return Object.fromEntries(
    Object.entries(all).map(([locale, catalog]) => [`/i18n/${locale}.json`, json(catalog)]),
  );
}

function plugin(
  origin: string,
  overrides: Partial<EtymaRemoteValidationOptions> = {},
): EtymaRemoteValidationPlugin {
  return etymaRemoteValidation({
    remote: `${origin}/i18n/{locale}.json`,
    locales: ['en', 'es', 'uk'],
    sourceLocale: 'en',
    timeout: 3000,
    ...overrides,
  });
}

/** A Vite-shaped logger that records instead of printing. */
function recordingLogger() {
  const info: string[] = [];
  const warn: string[] = [];

  return {
    info,
    warn,
    logger: {
      info: (message: string) => info.push(message),
      warn: (message: string) => warn.push(message),
    },
  };
}

async function failureOf(target: EtymaRemoteValidationPlugin): Promise<string> {
  const error: unknown = await target.buildStart().then(
    () => undefined,
    (thrown: unknown) => thrown,
  );

  expect(error).toBeInstanceOf(Error);
  return (error as Error).message;
}

function configFailure(options: Partial<EtymaRemoteValidationOptions>): string {
  try {
    etymaRemoteValidation({
      remote: 'https://cdn.example.com/i18n/{locale}.json',
      locales: ['en', 'es', 'uk'],
      sourceLocale: 'en',
      ...options,
    });
  } catch (error) {
    return (error as Error).message;
  }

  throw new Error('expected etymaRemoteValidation to throw');
}

describe('etymaRemoteValidation', () => {
  describe('success', () => {
    it('resolves buildStart when every remote catalog is valid, having fetched each once', async () => {
      const { origin, requests } = await serve(catalogs());

      await expect(plugin(origin).buildStart()).resolves.toBeUndefined();

      expect([...requests].sort()).toEqual(['/i18n/en.json', '/i18n/es.json', '/i18n/uk.json']);
    });

    it('logs one concise line through the Vite logger', async () => {
      const { origin } = await serve(catalogs());
      const target = plugin(origin);
      const log = recordingLogger();

      target.configResolved({ command: 'build', logger: log.logger });
      await target.buildStart();

      expect(log.info).toEqual(['[etyma] remote catalogs valid: en, es, uk']);
      expect(log.warn).toEqual([]);
    });

    it('passes a build whose only diagnostics are warnings, and shows them', async () => {
      const { origin } = await serve(catalogs({ es: { ...es, footer: { rights: '© {$year}' } } }));
      const target = plugin(origin);
      const log = recordingLogger();

      target.configResolved({ command: 'build', logger: log.logger });
      await expect(target.buildStart()).resolves.toBeUndefined();

      expect(log.warn).toHaveLength(1);
      expect(log.warn[0]).toContain('message.variable-function-mismatch  footer.rights');
    });

    it('validates once per plugin instance, however many builds call buildStart', async () => {
      const { origin, requests } = await serve(catalogs());
      const target = plugin(origin);

      await target.buildStart();
      await target.buildStart();
      await target.buildStart();

      expect(requests).toHaveLength(3);
    });
  });

  describe('fails the build on catalog diagnostics', () => {
    it.each([
      ['a missing key', { es: { nav: {}, footer: es.footer } }, 'catalog.missing-key  nav.docs'],
      [
        'an extra key',
        { es: { ...es, nav: { ...es.nav, home: 'Inicio' } } },
        'catalog.extra-key  nav.home',
      ],
      [
        'malformed MessageFormat 2',
        { es: { ...es, nav: { docs: 'Hola {$name' } } },
        'message.invalid-syntax  nav.docs',
      ],
      [
        'a missing variable',
        { es: { ...es, footer: { rights: '© todos los derechos' } } },
        'message.missing-variable  footer.rights',
      ],
      [
        'an extra variable',
        { es: { ...es, nav: { docs: 'Docs {$extra}' } } },
        'message.extra-variable  nav.docs',
      ],
      ['an invalid leaf', { es: { ...es, nav: { docs: 42 } } }, 'catalog.invalid-leaf  nav.docs'],
    ])('%s', async (_label, overrides, expected) => {
      const { origin } = await serve(catalogs(overrides));

      const message = await failureOf(plugin(origin));

      expect(message).toMatch(/^\[etyma\] remote catalog validation failed: \d+ errors?/);
      expect(message).toContain(`ES  ${origin}/i18n/es.json`);
      expect(message).toContain(`error ${expected}`);
    });

    it('reports every diagnostic from every locale in one error', async () => {
      const { origin } = await serve(
        catalogs({
          es: { nav: {}, footer: { rights: '©' } },
          uk: { ...uk, nav: { docs: '{$broken' }, extra: 'x' },
        }),
      );

      const message = await failureOf(plugin(origin));

      expect(message).toContain('failed: 4 errors');
      expect(message).toContain('ES  ');
      expect(message).toContain('UK  ');
      expect(message).not.toContain('EN  ');
      for (const code of [
        'catalog.missing-key  nav.docs',
        'message.missing-variable  footer.rights',
        'catalog.extra-key  extra',
        'message.invalid-syntax  nav.docs',
      ]) {
        expect(message).toContain(code);
      }
    });

    it('reports exactly what validateCatalogs() reports, in its order', async () => {
      const broken = {
        es: { nav: { docs: 'Docs {$x}' }, footer: {}, stray: 'x' },
        uk: { nav: { docs: '' }, footer: { rights: '{$year :number' } },
      };
      const { origin } = await serve(catalogs(broken));

      const message = await failureOf(plugin(origin));
      const direct = validateCatalogs({ sourceLocale: 'en', catalogs: { en, ...broken } });

      expect(direct.valid).toBe(false);

      let cursor = 0;
      for (const diagnostic of direct.diagnostics) {
        const line = `${diagnostic.severity} ${diagnostic.code}${diagnostic.key ? `  ${diagnostic.key}` : ''}\n      ${diagnostic.message}`;
        const at = message.indexOf(line, cursor);

        expect(at, `missing or out of order: ${line}`).toBeGreaterThanOrEqual(cursor);
        cursor = at + line.length;
      }
    });

    it('produces the same report whatever order `locales` and the network use', async () => {
      const bad = { es: { nav: {}, footer: es.footer }, uk: { ...uk, extra: 'x' } };
      const first = await serve(catalogs(bad));
      const a = await failureOf(plugin(first.origin, { locales: ['en', 'es', 'uk'] }));
      await first.close();

      const second = await serve({
        '/i18n/en.json': delayed(80, json(en)),
        '/i18n/es.json': delayed(40, json(bad.es)),
        '/i18n/uk.json': json(bad.uk),
      });
      const b = await failureOf(plugin(second.origin, { locales: ['uk', 'es', 'en'] }));

      expect(b.replaceAll(second.origin, 'ORIGIN')).toBe(a.replaceAll(first.origin, 'ORIGIN'));
      expect(b.indexOf('ES  ')).toBeLessThan(b.indexOf('UK  '));
    });

    it('lets validateCatalogs() judge locale identifiers - no second BCP 47 check here', async () => {
      const { origin } = await serve({
        ...catalogs(),
        '/i18n/en-US.json': json(en),
        '/i18n/en-us.json': json(en),
      });

      const message = await failureOf(
        plugin(origin, { locales: ['en', 'en-US', 'en-us', 'es', 'uk'] }),
      );

      expect(message).toContain('config.duplicate-locale');
    });
  });

  describe('fails the build when a catalog cannot be obtained', () => {
    it('HTTP 404, naming the locale and URL', async () => {
      const { origin } = await serve({ '/i18n/en.json': json(en), '/i18n/es.json': json(es) });

      const message = await failureOf(plugin(origin));

      expect(message).toContain('could not load 1 of 3 remote catalogs; nothing was validated');
      expect(message).toContain(`UK  ${origin}/i18n/uk.json\n    HTTP 404`);
    });

    it('HTTP 500, without echoing the response body', async () => {
      const { origin } = await serve({
        ...catalogs(),
        '/i18n/es.json': status(500, `<html>${'secret-page'.repeat(500)}</html>`, 'text/html'),
      });

      const message = await failureOf(plugin(origin));

      expect(message).toContain(`ES  ${origin}/i18n/es.json\n    HTTP 500`);
      expect(message).not.toContain('secret-page');
    });

    it('a body that is not JSON, without echoing it', async () => {
      const { origin } = await serve({
        ...catalogs(),
        '/i18n/es.json': status(200, '<html>login-wall</html>', 'text/html'),
        '/i18n/uk.json': status(200, '{"nav": ', 'application/json'),
      });

      const message = await failureOf(plugin(origin));

      expect(message).toContain('could not load 2 of 3');
      expect(message).toContain('response is not valid JSON [text/html] (starts with "<")');
      expect(message).toContain('response is not valid JSON (starts with "{")');
      expect(message).not.toContain('login-wall');
    });

    it('an unreachable host', async () => {
      const origin = await unusedOrigin();

      const message = await failureOf(plugin(origin));

      expect(message).toContain('could not load 3 of 3');
      expect(message).toMatch(
        /EN {2}http:\/\/127\.0\.0\.1:\d+\/i18n\/en\.json\n {4}network error:/,
      );
    });

    it('a host that accepts the request but never answers', async () => {
      const { origin } = await serve({ ...catalogs(), '/i18n/uk.json': hang() });

      const message = await failureOf(plugin(origin, { timeout: 200 }));

      expect(message).toContain(`UK  ${origin}/i18n/uk.json\n    timed out after 200ms`);
    });

    it('a response body that stalls after the headers', async () => {
      const { origin } = await serve({ ...catalogs(), '/i18n/es.json': stallBody() });

      const message = await failureOf(plugin(origin, { timeout: 200 }));

      expect(message).toContain(`ES  ${origin}/i18n/es.json\n    timed out after 200ms`);
    });
  });

  describe('rejects configuration before any request', () => {
    it('a template without {locale}', () => {
      expect(configFailure({ remote: 'https://cdn.example.com/i18n/en.json' })).toContain(
        '`remote` must be a URL template containing "{locale}"',
      );
    });

    it('empty locales', () => {
      expect(configFailure({ locales: [] })).toContain('`locales` is empty');
    });

    it('a comma-separated string instead of an array', () => {
      expect(configFailure({ locales: 'en,es,uk' as never })).toContain('not a comma-separated');
    });

    it('an empty entry', () => {
      expect(configFailure({ locales: ['en', '', 'es'] })).toContain('empty or non-string');
    });

    it('a duplicate locale', () => {
      expect(configFailure({ locales: ['en', 'es', 'en'] })).toContain('"en" more than once');
    });

    it('a source locale that is not in locales', () => {
      expect(configFailure({ sourceLocale: 'fr' })).toContain('`sourceLocale` "fr" is not in');
    });

    it('a malformed URL', () => {
      expect(configFailure({ remote: '/i18n/{locale}.json' })).toContain('is not a valid URL');
    });

    it.each([
      ['file', 'file:///etc/{locale}.json'],
      ['data', 'data:application/json,{locale}'],
      ['ftp', 'ftp://example.com/{locale}.json'],
    ])('a %s: URL', (protocol, remote) => {
      expect(configFailure({ remote })).toContain(`not "${protocol}:"`);
    });

    it('credentials embedded in the URL, without echoing them', () => {
      const message = configFailure({ remote: 'https://user:hunter2@example.com/{locale}.json' });

      expect(message).toContain('must not contain credentials');
      expect(message).not.toContain('hunter2');
    });

    it.each([0, -1, 1.5, Number.NaN, Infinity, 2 ** 31])('timeout %s', timeout => {
      expect(configFailure({ timeout })).toContain('`timeout` must be a whole number');
    });

    it('throws when the plugin is created, so a Vite config never loads with it', async () => {
      const { requests } = await serve(catalogs());

      expect(() =>
        etymaRemoteValidation({ remote: 'x', locales: ['en'], sourceLocale: 'en' }),
      ).toThrow(/etymaRemoteValidation:/);
      expect(requests).toEqual([]);
    });
  });

  describe('network behaviour', () => {
    it('fetches every locale concurrently', async () => {
      // No route answers until all three requests are in flight; a serial client would only
      // escape through the timeout and fail.
      const barrier = rendezvous(3);
      const { origin } = await serve({
        '/i18n/en.json': barrier(json(en)),
        '/i18n/es.json': barrier(json(es)),
        '/i18n/uk.json': barrier(json(uk)),
      });

      await expect(plugin(origin, { timeout: 2000 }).buildStart()).resolves.toBeUndefined();
    });

    it('percent-encodes a locale so it cannot change the URL structure', async () => {
      const { origin, requests } = await serve(catalogs());

      await failureOf(plugin(origin, { locales: ['en', 'es', '../uk'] }));

      expect(requests).toContain('/i18n/..%2Fuk.json');
    });
  });

  describe('during `serve`', () => {
    it('warns instead of failing, so the dev server still starts', async () => {
      const { origin } = await serve(catalogs({ es: { nav: {}, footer: es.footer } }));
      const target = plugin(origin);
      const log = recordingLogger();

      target.configResolved({ command: 'serve', logger: log.logger });
      await expect(target.buildStart()).resolves.toBeUndefined();

      expect(log.warn).toHaveLength(1);
      expect(log.warn[0]).toContain('catalog.missing-key  nav.docs');
      expect(log.warn[0]).toContain('a build fails on it');
    });

    it('warns about an unreachable catalog instead of failing', async () => {
      const target = plugin(await unusedOrigin());
      const log = recordingLogger();

      target.configResolved({ command: 'serve', logger: log.logger });
      await expect(target.buildStart()).resolves.toBeUndefined();

      expect(log.warn[0]).toContain('could not load 3 of 3');
    });

    it('still fails a later build that reuses the same plugin instance', async () => {
      const { origin, requests } = await serve(catalogs({ es: { nav: {}, footer: es.footer } }));
      const target = plugin(origin);
      const log = recordingLogger();

      target.configResolved({ command: 'serve', logger: log.logger });
      await target.buildStart();

      target.configResolved({ command: 'build', logger: log.logger });
      await expect(target.buildStart()).rejects.toThrow('catalog.missing-key');

      expect(requests).toHaveLength(3);
    });
  });
});
