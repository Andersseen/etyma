import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const SETUP_TIMEOUT = 300_000;

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
});
