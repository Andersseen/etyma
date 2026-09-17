import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { runCli } from './cli.js';
import { readOwnVersion } from './version.js';

const fixturesRoot = fileURLToPath(new URL('__fixtures__/', import.meta.url));

describe('runCli', () => {
  it('shows top-level help and exits 0 when called with no arguments', async () => {
    const result = await runCli([], '/');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('etyma validate --help');
  });

  it('shows top-level help for --help and -h', async () => {
    const long = await runCli(['--help'], '/');
    const short = await runCli(['-h'], '/');

    expect(long.stdout).toBe(short.stdout);
    expect(long.exitCode).toBe(0);
  });

  it('reports the real installed version for --version and -v', async () => {
    const version = readOwnVersion();

    const long = await runCli(['--version'], '/');
    const short = await runCli(['-v'], '/');

    expect(long.stdout).toBe(`${version}\n`);
    expect(short.stdout).toBe(`${version}\n`);
    expect(long.exitCode).toBe(0);
  });

  it('exits 2 with a usage error for an unknown command', async () => {
    const result = await runCli(['translate'], '/');

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('unknown command "translate"');
  });

  it('dispatches "validate" to the validate command', async () => {
    const result = await runCli(['validate', fixturesRoot + 'valid', '--source', 'en'], '/');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Catalogs are valid');
  });
});
