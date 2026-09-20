import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  hang,
  json,
  serveDirectory,
  stallBody,
  startFixtureServer,
  status,
  unusedOrigin,
} from '../__testing__/fixture-server.js';
import type { FixtureServer, RouteHandler } from '../__testing__/fixture-server.js';
import { runValidateCommand } from './validate.js';

const fixturesRoot = fileURLToPath(new URL('../__fixtures__/', import.meta.url));

function fixture(name: string): string {
  return join(fixturesRoot, name);
}

function localesOf(name: string): string {
  return readdirSync(fixture(name))
    .filter(file => file.endsWith('.json'))
    .map(file => file.slice(0, -'.json'.length))
    .join(',');
}

function remoteArgs(origin: string, locales: string, extra: readonly string[] = []): string[] {
  return [
    '--remote',
    `${origin}/i18n/{locale}.json`,
    '--locales',
    locales,
    '--source',
    'en',
    ...extra,
  ];
}

interface JsonPayload {
  valid: boolean;
  diagnostics: { code: string }[];
  meta: Record<string, unknown>;
}

describe('runValidateCommand --remote', () => {
  let server: FixtureServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function serve(routes: Record<string, RouteHandler>): Promise<FixtureServer> {
    server = await startFixtureServer(routes);
    return server;
  }

  async function serveFixture(name: string): Promise<FixtureServer> {
    return serve(serveDirectory(fixture(name)));
  }

  describe('catalog validation (exit 0 / exit 1)', () => {
    it('fetches en, es and uk and reports success in the same format as local mode', async () => {
      const { origin } = await serveFixture('valid');

      const result = await runValidateCommand(remoteArgs(origin, 'en,es,uk'), '/');

      expect(result).toEqual({
        exitCode: 0,
        stdout: '✓ 3 locales\n✓ 2 messages\n✓ Catalogs are valid\n',
        stderr: '',
      });
    });

    it('exits 1 and reports catalog.missing-key', async () => {
      const { origin } = await serveFixture('missing-key');

      const result = await runValidateCommand(remoteArgs(origin, 'en,es'), '/');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('ES');
      expect(result.stdout).toContain('ERROR catalog.missing-key');
      expect(result.stdout).toContain('nav.components');
    });

    it('exits 1 and reports catalog.extra-key', async () => {
      const { origin } = await serveFixture('extra-key');

      const result = await runValidateCommand(remoteArgs(origin, 'en,es'), '/');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('ERROR catalog.extra-key');
      expect(result.stdout).toContain('nav.extra');
    });

    it('exits 1 and reports message.invalid-syntax for malformed MessageFormat 2', async () => {
      const { origin } = await serveFixture('malformed-mf2');

      const result = await runValidateCommand(remoteArgs(origin, 'en,es'), '/');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('ERROR message.invalid-syntax');
    });

    it('exits 1 and reports variable parity diagnostics', async () => {
      const { origin } = await serveFixture('variable-mismatch');

      const result = await runValidateCommand(remoteArgs(origin, 'en,es'), '/');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('message.missing-variable');
      expect(result.stdout).toContain('message.extra-variable');
    });

    it.each([
      ['an array', '[]'],
      ['null', 'null'],
      ['a string', '"hello"'],
      ['a nested array leaf', '{"nav":["a"]}'],
    ])('exits 1, not 2, for valid JSON that is %s instead of a catalog', async (_name, body) => {
      const { origin } = await serve({
        '/i18n/en.json': json({ nav: { docs: 'Docs' } }),
        '/i18n/es.json': status(200, body, 'application/json'),
      });

      const result = await runValidateCommand(remoteArgs(origin, 'en,es'), '/');

      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(1);
    });

    it('treats canonical-equivalent locales the way tooling does: config.duplicate-locale', async () => {
      const catalog = json({ nav: { docs: 'Docs' } });
      const { origin } = await serve({
        '/i18n/en.json': catalog,
        '/i18n/en-US.json': catalog,
        '/i18n/en-us.json': catalog,
      });

      const result = await runValidateCommand(remoteArgs(origin, 'en,en-US,en-us'), '/');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('config.duplicate-locale');
    });

    it('leaves a malformed locale tag to tooling too: config.invalid-locale', async () => {
      const catalog = json({ nav: { docs: 'Docs' } });
      const { origin } = await serve({ '/i18n/en.json': catalog, '/i18n/en_us.json': catalog });

      const result = await runValidateCommand(remoteArgs(origin, 'en,en_us'), '/');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('config.invalid-locale');
    });

    it('is not confused by a locale spelled __proto__', async () => {
      const catalog = json({ nav: { docs: 'Docs' } });
      const { origin } = await serve({ '/i18n/en.json': catalog, '/i18n/__proto__.json': catalog });

      const result = await runValidateCommand(remoteArgs(origin, 'en,__proto__'), '/');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('config.invalid-locale');
    });

    it('supports region and script locales', async () => {
      const catalog = json({ nav: { docs: 'Docs' } });
      const { origin } = await serve({
        '/i18n/en.json': catalog,
        '/i18n/es-MX.json': catalog,
        '/i18n/pt-BR.json': catalog,
        '/i18n/zh-Hant.json': catalog,
      });

      const result = await runValidateCommand(remoteArgs(origin, 'en,es-MX,pt-BR,zh-Hant'), '/');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('4 locales');
    });

    it.each([
      'valid',
      'missing-key',
      'extra-key',
      'malformed-mf2',
      'variable-mismatch',
      'volt-like',
      'invalid-locale-filename',
      'canonical-duplicate',
    ])('produces exactly the diagnostics local mode does for the "%s" fixture', async name => {
      const { origin } = await serveFixture(name);
      const locales = localesOf(name);

      const local = await runValidateCommand([fixture(name), '--source', 'en'], '/');
      const remote = await runValidateCommand(remoteArgs(origin, locales), '/');

      expect(remote.exitCode).toBe(local.exitCode);
      expect(remote.stdout).toBe(local.stdout);

      const localJson = await runValidateCommand(
        [fixture(name), '--source', 'en', '--format', 'json'],
        '/',
      );
      const remoteJson = await runValidateCommand(
        remoteArgs(origin, locales, ['--format', 'json']),
        '/',
      );

      const a = JSON.parse(localJson.stdout) as JsonPayload;
      const b = JSON.parse(remoteJson.stdout) as JsonPayload;

      expect(b.valid).toBe(a.valid);
      expect(b.diagnostics).toEqual(a.diagnostics);
      expect(b.meta['locales']).toEqual(a.meta['locales']);
      expect(b.meta['messageCount']).toBe(a.meta['messageCount']);
    });
  });

  describe('operational failures (exit 2, nothing validated)', () => {
    async function expectInputError(
      routes: Record<string, RouteHandler>,
      extra: readonly string[] = [],
    ): Promise<{ stderr: string; origin: string }> {
      const { origin } = await serve(routes);
      const result = await runValidateCommand(remoteArgs(origin, 'en,es', extra), '/');

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).not.toContain('catalog.');

      return { stderr: result.stderr, origin };
    }

    it('exits 2 for an HTTP 404, naming the locale, URL and status', async () => {
      const { stderr, origin } = await expectInputError({ '/i18n/en.json': json({ a: 'A' }) });

      expect(stderr).toContain('Could not load 1 of 2 remote catalog(s)');
      expect(stderr).toContain(`es (${origin}/i18n/es.json): HTTP 404`);
      expect(stderr).not.toContain('<html>');
    });

    it('exits 2 for an HTTP 500, without printing the response body', async () => {
      const { stderr } = await expectInputError({
        '/i18n/en.json': json({ a: 'A' }),
        '/i18n/es.json': status(500, `<html>${'boom '.repeat(5000)}</html>`, 'text/html'),
      });

      expect(stderr).toContain('HTTP 500');
      expect(stderr).not.toContain('boom');
      expect(stderr.length).toBeLessThan(500);
    });

    it('exits 2 for a body that is not JSON', async () => {
      const { stderr } = await expectInputError({
        '/i18n/en.json': json({ a: 'A' }),
        '/i18n/es.json': status(200, '<html>Sign in</html>', 'text/html'),
      });

      expect(stderr).toContain('es (');
      expect(stderr).toContain('not valid JSON');
      expect(stderr).not.toContain('Sign in');
    });

    it('exits 2 when the host refuses the connection', async () => {
      const origin = await unusedOrigin();

      const result = await runValidateCommand(remoteArgs(origin, 'en,es'), '/');

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Could not load 2 of 2 remote catalog(s)');
      expect(result.stderr).toContain('ECONNREFUSED');
    });

    it('exits 2 when a host never answers, after --timeout', async () => {
      const started = Date.now();

      const { stderr } = await expectInputError(
        { '/i18n/en.json': json({ a: 'A' }), '/i18n/es.json': hang() },
        ['--timeout', '250'],
      );

      expect(stderr).toContain('timed out after 250ms');
      expect(Date.now() - started).toBeLessThan(5000);
    });

    it('exits 2 when a response body stalls', async () => {
      const { stderr } = await expectInputError(
        { '/i18n/en.json': json({ a: 'A' }), '/i18n/es.json': stallBody() },
        ['--timeout', '250'],
      );

      expect(stderr).toContain('timed out after 250ms');
    });

    it('lists every failing locale in one run, in locale order', async () => {
      const { origin } = await serve({
        '/i18n/en.json': json({ a: 'A' }),
        '/i18n/es.json': status(500, 'x'),
      });

      const result = await runValidateCommand(remoteArgs(origin, 'uk,es,en'), '/');
      const lines = result.stderr.split('\n');

      expect(result.exitCode).toBe(2);
      expect(lines[0]).toContain('Could not load 2 of 3 remote catalog(s)');
      expect(lines[1]).toContain('es (');
      expect(lines[2]).toContain('uk (');
    });

    it('does not report a source catalog failure as a catalog diagnostic', async () => {
      const { stderr } = await expectInputError({ '/i18n/es.json': json({ a: 'A' }) });

      expect(stderr).toContain('en (');
      expect(stderr).toContain('HTTP 404');
    });

    it('never writes JSON to stdout for an operational failure, even with --format json', async () => {
      const { origin } = await serve({ '/i18n/en.json': json({ a: 'A' }) });

      const result = await runValidateCommand(
        remoteArgs(origin, 'en,es', ['--format', 'json']),
        '/',
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
    });
  });

  describe('configuration errors (exit 2, before any request)', () => {
    async function expectConfigError(
      args: (origin: string) => string[],
      message: string | RegExp,
    ): Promise<void> {
      const { origin, requests } = await serve({ '/i18n/en.json': json({ a: 'A' }) });

      const result = await runValidateCommand(args(origin), '/');

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toMatch(message);
      expect(requests).toEqual([]);
    }

    it('rejects a template without {locale}', async () => {
      await expectConfigError(
        origin => ['--remote', `${origin}/i18n/en.json`, '--locales', 'en,es', '--source', 'en'],
        '{locale}',
      );
    });

    it('rejects a missing --locales', async () => {
      await expectConfigError(
        origin => ['--remote', `${origin}/i18n/{locale}.json`, '--source', 'en'],
        '--locales',
      );
    });

    it('rejects an empty --locales', async () => {
      await expectConfigError(origin => remoteArgs(origin, ''), '--locales is empty');
    });

    it('rejects duplicate locales', async () => {
      await expectConfigError(origin => remoteArgs(origin, 'en,es,en'), 'more than once');
    });

    it('rejects a source locale that is not in --locales', async () => {
      await expectConfigError(origin => remoteArgs(origin, 'es,uk'), '"en" is not in --locales');
    });

    it('rejects a missing --source', async () => {
      await expectConfigError(
        origin => ['--remote', `${origin}/i18n/{locale}.json`, '--locales', 'en,es'],
        '--source',
      );
    });

    it.each([
      'file:///tmp/{locale}.json',
      'data:application/json,{locale}',
      'ftp://x/{locale}.json',
    ])('rejects the unsupported URL %s', async template => {
      await expectConfigError(
        () => ['--remote', template, '--locales', 'en,es', '--source', 'en'],
        /http: or https:/,
      );
    });

    it('rejects a malformed URL', async () => {
      await expectConfigError(
        () => ['--remote', 'cdn.example.com/{locale}.json', '--locales', 'en', '--source', 'en'],
        'not a valid URL',
      );
    });

    it('rejects an invalid --timeout', async () => {
      await expectConfigError(
        origin => remoteArgs(origin, 'en,es', ['--timeout', 'soon']),
        '--timeout',
      );
    });

    it('rejects a <directory> alongside --remote instead of guessing which is meant', async () => {
      await expectConfigError(
        origin => [fixture('valid'), ...remoteArgs(origin, 'en,es')],
        'not a <directory>',
      );
    });
  });

  describe('--format json', () => {
    it('emits one JSON value with remote metadata and nothing else', async () => {
      const { origin } = await serveFixture('valid');
      const template = `${origin}/i18n/{locale}.json`;

      const result = await runValidateCommand(
        ['--remote', template, '--locales', 'en,es,uk', '--source', 'en', '--format', 'json'],
        '/',
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        valid: true,
        diagnostics: [],
        meta: {
          command: 'validate',
          mode: 'remote',
          remote: template,
          sourceLocale: 'en',
          locales: ['en', 'es', 'uk'],
          messageCount: 2,
        },
      });
    });

    it('carries catalog diagnostics with exit 1', async () => {
      const { origin } = await serveFixture('missing-key');

      const result = await runValidateCommand(
        remoteArgs(origin, 'en,es', ['--format', 'json']),
        '/',
      );
      const payload = JSON.parse(result.stdout) as JsonPayload;

      expect(result.exitCode).toBe(1);
      expect(payload.valid).toBe(false);
      expect(payload.diagnostics.map(diagnostic => diagnostic.code)).toContain(
        'catalog.missing-key',
      );
      expect(payload.meta['mode']).toBe('remote');
    });

    it('puts mode: "local" on local runs and keeps their directory', async () => {
      const result = await runValidateCommand(
        [fixture('valid'), '--source', 'en', '--format', 'json'],
        '/',
      );
      const { meta } = JSON.parse(result.stdout) as JsonPayload;

      expect(meta).toEqual({
        command: 'validate',
        mode: 'local',
        directory: fixture('valid'),
        sourceLocale: 'en',
        locales: ['en', 'es', 'uk'],
        messageCount: 2,
      });
    });
  });

  describe('determinism', () => {
    it('produces identical output whatever order --locales lists the locales in', async () => {
      const { origin } = await serveFixture('missing-key');

      const forward = await runValidateCommand(
        remoteArgs(origin, 'en,es', ['--format', 'json']),
        '/',
      );
      const reverse = await runValidateCommand(
        remoteArgs(origin, 'es,en', ['--format', 'json']),
        '/',
      );

      expect(reverse).toEqual(forward);
    });
  });

  describe('mixing modes', () => {
    it('rejects --locales without --remote', async () => {
      const result = await runValidateCommand(
        [fixture('valid'), '--source', 'en', '--locales', 'en,es'],
        '/',
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('--locales can only be used with --remote');
    });

    it('rejects --timeout without --remote', async () => {
      const result = await runValidateCommand(
        [fixture('valid'), '--source', 'en', '--timeout', '500'],
        '/',
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('--timeout can only be used with --remote');
    });

    it('does not treat a URL passed as <directory> as remote', async () => {
      const result = await runValidateCommand(
        ['https://example.com/i18n/{locale}.json', '--source', 'en'],
        '/',
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Cannot read directory');
    });
  });

  it('documents both modes in --help', async () => {
    const result = await runValidateCommand(['--help'], '/');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('etyma validate <directory> --source <locale>');
    expect(result.stdout).toContain('etyma validate --remote <url-template> --locales <list>');
    expect(result.stdout).toContain('--timeout <ms>');
  });
});
