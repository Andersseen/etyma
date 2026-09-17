import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { runValidateCommand } from './validate.js';

const fixturesRoot = fileURLToPath(new URL('../__fixtures__/', import.meta.url));

function fixture(name: string): string {
  return join(fixturesRoot, name);
}

describe('runValidateCommand', () => {
  it('exits 0 and reports success for a valid catalog set', async () => {
    const result = await runValidateCommand([fixture('valid'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('✓ 3 locales\n✓ 2 messages\n✓ Catalogs are valid\n');
  });

  it('resolves a relative directory against the given cwd', async () => {
    const result = await runValidateCommand(['./valid', '--source', 'en'], fixturesRoot);

    expect(result.exitCode).toBe(0);
  });

  it('exits 1 and reports catalog.missing-key for a locale missing a source key', async () => {
    const result = await runValidateCommand([fixture('missing-key'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('ES');
    expect(result.stdout).toContain('ERROR catalog.missing-key');
    expect(result.stdout).toContain('nav.components');
  });

  it('exits 1 and reports catalog.extra-key for a locale with an untranslatable key', async () => {
    const result = await runValidateCommand([fixture('extra-key'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('ERROR catalog.extra-key');
    expect(result.stdout).toContain('nav.extra');
  });

  it('exits 1 and reports message.invalid-syntax for malformed MessageFormat 2', async () => {
    const result = await runValidateCommand([fixture('malformed-mf2'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('ERROR message.invalid-syntax');
  });

  it('exits 1 and reports variable parity diagnostics for a renamed variable', async () => {
    const result = await runValidateCommand([fixture('variable-mismatch'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('message.missing-variable');
    expect(result.stdout).toContain('message.extra-variable');
  });

  it('exits 1 and reports config.invalid-locale for a non-BCP-47 filename', async () => {
    const result = await runValidateCommand(
      [fixture('invalid-locale-filename'), '--source', 'en'],
      '/',
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('ERROR config.invalid-locale');
  });

  it('exits 1 and reports config.duplicate-locale for tags that canonicalize the same', async () => {
    const result = await runValidateCommand(
      [fixture('canonical-duplicate'), '--source', 'en'],
      '/',
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('config.duplicate-locale');
    expect(result.stdout).toContain('HE');
    expect(result.stdout).toContain('IW');
  });

  it('exits 2 with a plain-text error for a malformed JSON file, without validating', async () => {
    const result = await runValidateCommand([fixture('malformed-json'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('es.json');
    expect(result.stderr).not.toContain('catalog.');
  });

  it('exits 2 when the source locale has no catalog file', async () => {
    const result = await runValidateCommand([fixture('missing-source'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('en.json');
  });

  it('exits 2 for a directory that does not exist', async () => {
    const result = await runValidateCommand([fixture('does-not-exist'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(2);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('exits 2 when --source is missing', async () => {
    const result = await runValidateCommand([fixture('valid')], '/');

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('--source');
  });

  it('exits 2 when the directory argument is missing', async () => {
    const result = await runValidateCommand(['--source', 'en'], '/');

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('<directory>');
  });

  it('exits 2 for an unknown --format value', async () => {
    const result = await runValidateCommand(
      [fixture('valid'), '--source', 'en', '--format', 'xml'],
      '/',
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('--format');
  });

  it('ignores unrelated non-json files without treating them as ambiguous', async () => {
    const result = await runValidateCommand([fixture('unrelated-files'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(0);
  });

  it('validates the moderate, Volt-inspired fixture cleanly, including the Ukrainian plural', async () => {
    const result = await runValidateCommand([fixture('volt-like'), '--source', 'en'], '/');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('3 locales');
  });

  it('shows help and exits 0 without touching the filesystem', async () => {
    const result = await runValidateCommand(['--help'], '/');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('etyma validate <directory>');
  });

  describe('--format json', () => {
    it('emits stable JSON on stdout and nothing else', async () => {
      const result = await runValidateCommand(
        [fixture('valid'), '--source', 'en', '--format', 'json'],
        '/',
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');

      const payload = JSON.parse(result.stdout) as {
        valid: boolean;
        diagnostics: unknown[];
        meta: { sourceLocale: string; locales: string[]; messageCount: number };
      };

      expect(payload.valid).toBe(true);
      expect(payload.diagnostics).toEqual([]);
      expect(payload.meta.sourceLocale).toBe('en');
      expect(payload.meta.locales).toEqual(['en', 'es', 'uk']);
      expect(payload.meta.messageCount).toBe(2);
    });

    it('reports a plain-text usage error on stderr, never as JSON, on stdout', async () => {
      const result = await runValidateCommand(
        [fixture('missing-source'), '--source', 'en', '--format', 'json'],
        '/',
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('en.json');
    });
  });

  describe('determinism', () => {
    it('produces identical output across repeated runs of the same input', async () => {
      const first = await runValidateCommand([fixture('missing-key'), '--source', 'en'], '/');
      const second = await runValidateCommand([fixture('missing-key'), '--source', 'en'], '/');

      expect(first).toEqual(second);
    });
  });
});
