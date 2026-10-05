import { execFile, execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { hang, serveDirectory, startFixtureServer } from './__testing__/fixture-server.js';
import type { FixtureServer } from './__testing__/fixture-server.js';

const execFileAsync = promisify(execFile);

/**
 * Proves the npm artifact actually works, not just the TypeScript source the rest of this
 * package's tests import directly.
 *
 * Builds @etyma/core, @etyma/tooling and @etyma/cli, packs each exactly as `pnpm publish`
 * would (`pnpm pack`), and installs the three tarballs into a throwaway npm project outside
 * the workspace - `file:` dependencies plus `overrides`, the same pattern `tools/compat`'s
 * fixtures use so a resolution failure can't hide behind a workspace symlink or the pnpm
 * store (see `tools/compat/consumer`'s sibling `package.json` files). `npm`, not `pnpm`, for
 * the same reason those fixtures use it: a fixture that resolved through the workspace store
 * would be testing the repository again instead of the package.
 *
 * This is what catches a missing shebang, a wrong `bin` path, an ESM packaging mistake, a
 * file missing from `files`, or a `workspace:` dependency that leaked in unrewritten - none
 * of which a test that only imports `src/*.ts` could ever see.
 *
 * Remote mode gets the same treatment: the real binary, run as a real process, fetching from
 * a throwaway HTTP server on loopback (never the public internet). That is what proves Node's
 * `fetch` and `AbortSignal.timeout` behave in the shipped ESM output, not just under Vitest.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const SETUP_TIMEOUT = 300_000;
/** Contract tests run real `tsc` compiles, which can exceed Vitest's 5s default on a busy runner. */
const COMPILE_TIMEOUT = 60_000;

describe('the packed etyma binary', () => {
  let consumerDir: string;
  let tarballsDir: string;
  let binPath: string;

  beforeAll(() => {
    execFileSync('pnpm', ['--filter', '@etyma/cli...', 'run', 'build'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });

    tarballsDir = mkdtempSync(join(tmpdir(), 'etyma-cli-tarballs-'));

    const tarballs: Record<string, string> = {};

    for (const name of ['core', 'tooling', 'cli']) {
      execFileSync('pnpm', ['pack', '--pack-destination', tarballsDir], {
        cwd: join(repoRoot, 'packages', name),
        stdio: 'pipe',
      });

      const file = readdirSync(tarballsDir).find(
        entry => entry.startsWith(`etyma-${name}-`) && entry.endsWith('.tgz'),
      );

      if (file === undefined) {
        throw new Error(`pnpm pack produced no tarball for @etyma/${name}`);
      }

      tarballs[name] = join(tarballsDir, file);
    }

    consumerDir = mkdtempSync(join(tmpdir(), 'etyma-cli-consumer-'));

    const dependencies = {
      '@etyma/core': `file:${tarballs['core']}`,
      '@etyma/tooling': `file:${tarballs['tooling']}`,
      '@etyma/cli': `file:${tarballs['cli']}`,
    };

    writeFileSync(
      join(consumerDir, 'package.json'),
      JSON.stringify(
        {
          name: 'etyma-cli-smoke-consumer',
          version: '0.0.0',
          private: true,
          dependencies,
          overrides: dependencies,
        },
        null,
        2,
      ),
    );

    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel', 'error'], {
      cwd: consumerDir,
      stdio: 'pipe',
    });

    binPath = join(consumerDir, 'node_modules', '.bin', 'etyma');
  }, SETUP_TIMEOUT);

  afterAll(() => {
    rmSync(consumerDir, { recursive: true, force: true });
    rmSync(tarballsDir, { recursive: true, force: true });
  });

  it('reports its version through the real npm bin shim', () => {
    const stdout = execFileSync(binPath, ['--version'], { encoding: 'utf8' });

    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints help through the real bin shim', () => {
    const stdout = execFileSync(binPath, ['validate', '--help'], { encoding: 'utf8' });

    expect(stdout).toContain('etyma validate <directory>');
  });

  it('validates a clean catalog directory and exits 0', () => {
    const i18nDir = join(consumerDir, 'i18n-ok');
    cpSync(join(here, '__fixtures__/volt-like'), i18nDir, { recursive: true });

    const stdout = execFileSync(binPath, ['validate', i18nDir, '--source', 'en'], {
      encoding: 'utf8',
    });

    expect(stdout).toContain('Catalogs are valid');
  });

  it('exits 1 through a real process for a catalog with validation errors', () => {
    const i18nDir = join(consumerDir, 'i18n-broken');
    cpSync(join(here, '__fixtures__/missing-key'), i18nDir, { recursive: true });

    expect.assertions(2);

    try {
      execFileSync(binPath, ['validate', i18nDir, '--source', 'en'], { encoding: 'utf8' });
    } catch (error) {
      const failure = error as { status: number; stdout: string };
      expect(failure.status).toBe(1);
      expect(failure.stdout).toContain('catalog.missing-key');
    }
  });

  describe('contract', { timeout: COMPILE_TIMEOUT }, () => {
    /**
     * The whole local-JSON path, from the packed artifacts only: the packed binary generates
     * the contract from a real `en.json`, and TypeScript - resolving `@etyma/core` from the
     * installed tarball, with the bundler resolution Vite, Angular and Astro projects use -
     * checks `t()` params against it through a plain `.json` import. `@ts-expect-error` lines
     * that no longer error fail the compile too, so this proves both directions.
     */
    it('generates a contract that types t() params for an imported JSON source', () => {
      const project = join(consumerDir, 'contract-app');
      const i18n = join(project, 'src', 'i18n');
      mkdirSync(i18n, { recursive: true });
      cpSync(join(here, '__fixtures__/contract/en.json'), join(i18n, 'en.json'));

      const stdout = execFileSync(
        binPath,
        ['contract', 'src/i18n/en.json', '--output', 'src/i18n/etyma.generated.ts'],
        { cwd: project, encoding: 'utf8' },
      );
      const output = join(i18n, 'etyma.generated.ts');
      const generated = readFileSync(output, 'utf8');

      expect(stdout).toBe('✓ Wrote src/i18n/etyma.generated.ts (6 keys)\n');
      expect(generated).toContain("import { defineMessageContract } from '@etyma/core';");
      expect(generated).toContain('"onboarding.steps.1": ["plan"],');
      expect(generated).toContain('"footer.rights": { "year": ["number"] },');
      expect(generated).not.toContain(consumerDir);
      expect(generated).not.toContain('Hello');

      const { mtimeMs } = statSync(output);
      const again = execFileSync(
        binPath,
        ['contract', 'src/i18n/en.json', '--output', 'src/i18n/etyma.generated.ts'],
        { cwd: project, encoding: 'utf8' },
      );

      expect(again).toBe('✓ src/i18n/etyma.generated.ts is up to date (6 keys)\n');
      expect(statSync(output).mtimeMs).toBe(mtimeMs);

      writeFileSync(
        join(project, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            resolveJsonModule: true,
            skipLibCheck: true,
            types: [],
          },
          include: ['src'],
        }),
      );
      writeFileSync(
        join(project, 'src', 'check.ts'),
        [
          "import { defineI18n, type I18nDefinition, type MessageParamsMap, type Translator } from '@etyma/core';",
          '',
          "import en from './i18n/en.json';",
          "import contract from './i18n/etyma.generated';",
          '',
          'declare function translatorFor<K extends string, P extends MessageParamsMap>(d: I18nDefinition<K, P>): Translator<K, P>;',
          '',
          "const t = translatorFor(defineI18n({ locales: ['en'], sourceLocale: 'en', source: en, contract }));",
          '',
          "t.translate('welcome', { name: 'Ada' });",
          "t.translate('footer.rights', { year: 2026 });",
          "t.translate('nav.docs');",
          "t.translate('onboarding.steps.1', { plan: 'Pro' });",
          '// @ts-expect-error - `welcome` needs `name`.',
          "t.translate('welcome');",
          '// @ts-expect-error - a misspelt param.',
          "t.translate('welcome', { nmae: 'Ada' });",
          '// @ts-expect-error - `footer.rights` needs `year`.',
          "t.translate('footer.rights');",
          '// @ts-expect-error - `onboarding.steps.1` needs `plan`.',
          "t.translate('onboarding.steps.1');",
          '// @ts-expect-error - the contract knows the array has two steps.',
          "t.translate('onboarding.steps.2');",
          '',
          '// Param values, narrowed by the built-in functions the source annotates them with.',
          "t.translate('footer.rights', { year: 2026n });",
          "t.translate('footer.rights', { year: '2026' });",
          "t.translate('activity.updated', { when: new Date() });",
          "t.translate('activity.updated', { when: Date.now() });",
          "t.translate('welcome', { name: true });",
          '// @ts-expect-error - :number does not take a Date.',
          "t.translate('footer.rights', { year: new Date() });",
          '// @ts-expect-error - :number does not take a boolean.',
          "t.translate('footer.rights', { year: true });",
          '// @ts-expect-error - :datetime does not take a bigint.',
          "t.translate('activity.updated', { when: 1n });",
          '',
          '// Without a contract: typed keys, optional untyped params, as before.',
          "const plain = translatorFor(defineI18n({ locales: ['en'], sourceLocale: 'en', source: en }));",
          "plain.translate('welcome');",
          "plain.translate('onboarding.steps.2');",
          '// @ts-expect-error - keys are still checked.',
          "plain.translate('nav.nope');",
          '',
        ].join('\n'),
      );

      const tsc = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
      const result = execFileSync(process.execPath, [tsc, '--project', project], {
        encoding: 'utf8',
      });

      expect(result).toBe('');
    });

    /**
     * `--check` from the packed binary: a same-key, same-variable change to one function
     * annotation - invisible to `defineI18n`'s key comparison - fails the check without
     * touching the committed contract, and regenerating makes TypeScript see the new type.
     */
    it('--check catches same-key function drift and never writes', () => {
      const project = join(consumerDir, 'contract-check');
      const i18n = join(project, 'src', 'i18n');
      const sourcePath = join(i18n, 'en.json');
      const output = join(i18n, 'etyma.generated.ts');
      const generate = ['contract', 'src/i18n/en.json', '--output', 'src/i18n/etyma.generated.ts'];
      const check = [...generate, '--check'];
      mkdirSync(i18n, { recursive: true });

      function etyma(args: readonly string[]): { status: number; stdout: string; stderr: string } {
        try {
          const stdout = execFileSync(binPath, [...args], {
            cwd: project,
            encoding: 'utf8',
            stdio: 'pipe',
          });

          return { status: 0, stdout, stderr: '' };
        } catch (error) {
          const failure = error as { status: number; stdout: string; stderr: string };

          return { status: failure.status, stdout: failure.stdout, stderr: failure.stderr };
        }
      }

      writeFileSync(sourcePath, JSON.stringify({ total: 'Total: {$count :number}' }));

      expect(etyma(check)).toMatchObject({ status: 1, stdout: expect.stringContaining('missing') });
      expect(readdirSync(i18n)).toEqual(['en.json']);

      expect(etyma(generate).status).toBe(0);
      expect(etyma(check)).toEqual({
        status: 0,
        stdout: '✓ src/i18n/etyma.generated.ts is up to date (1 key)\n',
        stderr: '',
      });

      writeFileSync(sourcePath, JSON.stringify({ total: 'Total: {$count :datetime}' }));
      const committed = readFileSync(output, 'utf8');
      const { mtimeMs } = statSync(output);

      expect(etyma(check)).toEqual({
        status: 1,
        stdout:
          '✗ src/i18n/etyma.generated.ts is out of date.\n' +
          '  Regenerate it with: etyma contract src/i18n/en.json --output src/i18n/etyma.generated.ts\n',
        stderr: '',
      });
      expect(readFileSync(output, 'utf8')).toBe(committed);
      expect(statSync(output).mtimeMs).toBe(mtimeMs);

      writeFileSync(sourcePath, '{"total": "{$count"}');
      expect(etyma(check).status).toBe(2);
      writeFileSync(sourcePath, JSON.stringify({ total: 'Total: {$count :datetime}' }));

      expect(etyma(generate).stdout).toBe('✓ Wrote src/i18n/etyma.generated.ts (1 key)\n');
      expect(etyma(check).status).toBe(0);
      expect(readFileSync(output, 'utf8')).toContain('"total": { "count": ["datetime"] },');

      writeFileSync(
        join(project, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            resolveJsonModule: true,
            skipLibCheck: true,
            types: [],
          },
          include: ['src'],
        }),
      );
      writeFileSync(
        join(project, 'src', 'check.ts'),
        [
          "import { defineI18n, type I18nDefinition, type MessageParamsMap, type Translator } from '@etyma/core';",
          '',
          "import en from './i18n/en.json';",
          "import contract from './i18n/etyma.generated';",
          '',
          'declare function translatorFor<K extends string, P extends MessageParamsMap>(d: I18nDefinition<K, P>): Translator<K, P>;',
          '',
          "const t = translatorFor(defineI18n({ locales: ['en'], sourceLocale: 'en', source: en, contract }));",
          '',
          '// The regenerated contract says :datetime now.',
          "t.translate('total', { count: new Date() });",
          '// @ts-expect-error - :datetime does not take a bigint, which :number did.',
          "t.translate('total', { count: 1n });",
          '',
        ].join('\n'),
      );

      const tsc = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
      const result = execFileSync(process.execPath, [tsc, '--project', project], {
        encoding: 'utf8',
      });

      expect(result).toBe('');
    });

    it('exits 2 through a real process for a source with invalid MessageFormat 2', () => {
      const project = join(consumerDir, 'contract-broken');
      mkdirSync(project, { recursive: true });
      writeFileSync(join(project, 'en.json'), '{"welcome": "Hello, {$name"}');

      expect.assertions(3);

      try {
        execFileSync(binPath, ['contract', 'en.json', '-o', 'contract.ts'], {
          cwd: project,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (error) {
        const failure = error as { status: number; stderr: string };
        expect(failure.status).toBe(2);
        expect(failure.stderr).toContain('welcome: Invalid MessageFormat 2 syntax');
        expect(readdirSync(project)).toEqual(['en.json']);
      }
    });
  });

  describe('remote mode', () => {
    let server: FixtureServer | undefined;

    afterEach(async () => {
      await server?.close();
      server = undefined;
    });

    /**
     * Runs the real binary asynchronously. `execFileSync` would block this process's event
     * loop, and with it the in-process HTTP server the binary is trying to fetch from.
     */
    async function etyma(
      args: readonly string[],
      cwd?: string,
    ): Promise<{ status: number; stdout: string; stderr: string }> {
      try {
        const { stdout, stderr } = await execFileAsync(binPath, [...args], {
          encoding: 'utf8',
          ...(cwd === undefined ? {} : { cwd }),
        });

        return { status: 0, stdout, stderr };
      } catch (error) {
        const failure = error as { code?: unknown; stdout?: string; stderr?: string };

        if (typeof failure.code !== 'number') {
          throw error;
        }

        return { status: failure.code, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
      }
    }

    async function serveFixture(name: string): Promise<FixtureServer> {
      server = await startFixtureServer(serveDirectory(join(here, '__fixtures__', name)));
      return server;
    }

    function remote(origin: string, extra: readonly string[] = []): string[] {
      return [
        'validate',
        '--remote',
        `${origin}/i18n/{locale}.json`,
        '--locales',
        'en,es,uk',
        '--source',
        'en',
        ...extra,
      ];
    }

    it('documents remote mode in --help', () => {
      const stdout = execFileSync(binPath, ['validate', '--help'], { encoding: 'utf8' });

      expect(stdout).toContain('etyma validate --remote <url-template>');
    });

    it('fetches, validates and exits 0 - without writing anything to disk', async () => {
      const { origin, requests } = await serveFixture('volt-like');
      const workingDir = mkdtempSync(join(tmpdir(), 'etyma-cli-remote-cwd-'));

      try {
        const result = await etyma(remote(origin), workingDir);

        expect(result.status).toBe(0);
        expect(result.stderr).toBe('');
        expect(result.stdout).toContain('3 locales');
        expect(result.stdout).toContain('Catalogs are valid');
        expect([...requests].sort()).toEqual(['/i18n/en.json', '/i18n/es.json', '/i18n/uk.json']);
        expect(readdirSync(workingDir)).toEqual([]);
      } finally {
        rmSync(workingDir, { recursive: true, force: true });
      }
    });

    it('exits 1 with machine-readable diagnostics for a catalog with validation errors', async () => {
      const { origin } = await serveFixture('missing-key');

      const result = await etyma([
        'validate',
        '--remote',
        `${origin}/i18n/{locale}.json`,
        '--locales',
        'en,es',
        '--source',
        'en',
        '--format',
        'json',
      ]);

      const payload = JSON.parse(result.stdout) as {
        valid: boolean;
        diagnostics: { code: string }[];
        meta: { mode: string; remote: string };
      };

      expect(result.status).toBe(1);
      expect(payload.valid).toBe(false);
      expect(payload.diagnostics.map(diagnostic => diagnostic.code)).toContain(
        'catalog.missing-key',
      );
      expect(payload.meta.mode).toBe('remote');
      expect(payload.meta.remote).toBe(`${origin}/i18n/{locale}.json`);
    });

    it('exits 2 for an HTTP error, naming the locale and URL', async () => {
      const { origin } = await serveFixture('missing-source');

      const result = await etyma(remote(origin));

      expect(result.status).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(`en (${origin}/i18n/en.json): HTTP 404`);
    });

    it('exits 2 for a host that never answers, within --timeout', async () => {
      server = await startFixtureServer({ '/i18n/en.json': hang() });
      const started = Date.now();

      const result = await etyma([
        'validate',
        '--remote',
        `${server.origin}/i18n/{locale}.json`,
        '--locales',
        'en',
        '--source',
        'en',
        '--timeout',
        '500',
      ]);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('timed out after 500ms');
      expect(Date.now() - started).toBeLessThan(10_000);
    });

    it('exits 2 for a configuration error, before making any request', async () => {
      server = await startFixtureServer({});

      const result = await etyma([
        'validate',
        '--remote',
        `${server.origin}/i18n/en.json`,
        '--locales',
        'en',
        '--source',
        'en',
      ]);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('{locale}');
      expect(server.requests).toEqual([]);
    });
  });
});
