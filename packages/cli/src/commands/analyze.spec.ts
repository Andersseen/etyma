import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runAnalyzeCommand } from './analyze.js';

describe('runAnalyzeCommand', () => {
  let root: string;

  afterEach(async () => {
    if (root !== undefined) await rm(root, { recursive: true, force: true });
  });

  async function fixture(): Promise<{ cwd: string; source: string }> {
    root = await mkdtemp(join(tmpdir(), 'etyma-analyze-'));
    const cwd = join(root, 'project');
    const source = join(cwd, 'src');
    await mkdir(source, { recursive: true });
    await mkdir(join(cwd, 'i18n'), { recursive: true });
    await writeFile(
      join(cwd, 'i18n/en.json'),
      JSON.stringify({ nav: { home: 'Home', docs: 'Docs' }, footer: { rights: 'Rights' } }),
    );
    return { cwd, source };
  }

  it('prints referenced and unreferenced candidates, and dynamic keys remain warnings', async () => {
    const { cwd } = await fixture();
    await writeFile(
      join(cwd, 'src/app.ts'),
      `import { injectT } from '@etyma/angular';\nconst t = injectT(i18n);\nt('nav.home');\nt(key);`,
    );

    const result = await runAnalyzeCommand(
      ['src', '--catalog', 'i18n/en.json', '--format', 'json'],
      cwd,
    );
    const output = JSON.parse(result.stdout) as {
      used: string[];
      unreferenced: string[];
      diagnostics: { code: string; severity: string; path: string }[];
      meta: { directory: string; catalog: string; fileCount: number; catalogKeyCount: number };
    };

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(output.used).toEqual(['nav.home']);
    expect(output.unreferenced).toEqual(['footer.rights', 'nav.docs']);
    expect(output.diagnostics).toMatchObject([
      { code: 'source.dynamic-key', severity: 'warning', path: 'app.ts' },
    ]);
    expect(output.meta).toEqual({
      command: 'analyze',
      directory: 'src',
      catalog: 'i18n/en.json',
      fileCount: 1,
      catalogKeyCount: 3,
    });
  });

  it('returns 1 for unknown keys and parse errors while retaining pretty diagnostics', async () => {
    const { cwd } = await fixture();
    await writeFile(
      join(cwd, 'src/app.ts'),
      `import { injectT } from '@etyma/angular';\nconst t = injectT(i18n);\nt('nav.typo');\nconst broken = ;`,
    );

    const result = await runAnalyzeCommand(['src', '--catalog', 'i18n/en.json'], cwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('source.unknown-key');
    expect(result.stdout).toContain('source.parse-error');
    expect(result.stdout).toContain('app.ts:3:3');
    expect(result.stdout).toContain('Unreferenced candidates:');
  });

  it('runs successfully with no discovered files and lists all keys as candidates', async () => {
    const { cwd } = await fixture();
    const result = await runAnalyzeCommand(['src', '--catalog', 'i18n/en.json'], cwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('○ 3 unreferenced candidates');
    expect(result.stdout).toContain('✓ 0 files analyzed');
  });

  it('combines source and external-template references in opt-in Angular mode', async () => {
    const { cwd } = await fixture();
    await writeFile(
      join(cwd, 'src/app.ts'),
      `import { Component } from '@angular/core';\n` +
        `import { injectT } from '@etyma/angular';\n` +
        `@Component({ templateUrl: './app.html' })\n` +
        `export class App { readonly t = injectT(definition); }\n` +
        `const t = injectT(definition); t('nav.docs');`,
    );
    await writeFile(
      join(cwd, 'src/app.html'),
      `{{ t('nav.home') }} {{ t('nav.typo') }} {{ t(key) }}`,
    );

    const result = await runAnalyzeCommand(
      ['src', '--catalog', 'i18n/en.json', '--angular', '--format', 'json'],
      cwd,
    );
    const output = JSON.parse(result.stdout) as {
      used: string[];
      unreferenced: string[];
      diagnostics: { code: string; severity: string; path: string }[];
      meta: { mode?: string; fileCount: number };
    };

    expect(result.exitCode).toBe(1);
    expect(output.used).toEqual(['nav.docs', 'nav.home']);
    expect(output.unreferenced).toEqual(['footer.rights']);
    expect(output.diagnostics).toMatchObject([
      { code: 'source.unknown-key', severity: 'error', path: 'app.html' },
      { code: 'source.dynamic-key', severity: 'warning', path: 'app.html' },
    ]);
    expect(output.meta).toMatchObject({ mode: 'angular', fileCount: 2 });
  });

  it('applies excludes to external templates in Angular mode', async () => {
    const { cwd } = await fixture();
    await writeFile(
      join(cwd, 'src/app.ts'),
      `import { Component } from '@angular/core';\n` +
        `import { injectT } from '@etyma/angular';\n` +
        `@Component({ templateUrl: './app.html' })\n` +
        `export class App { readonly t = injectT(definition); }`,
    );
    await writeFile(join(cwd, 'src/app.html'), `{{ t('nav.home') }}`);

    const result = await runAnalyzeCommand(
      [
        'src',
        '--catalog',
        'i18n/en.json',
        '--angular',
        '--exclude',
        '**/*.html',
        '--format',
        'json',
      ],
      cwd,
    );
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'source.template-missing', templatePath: 'app.html' }),
    );
  });

  it('reports operational and usage failures with exit 2', async () => {
    const { cwd } = await fixture();
    const cases: readonly (readonly string[])[] = [
      [],
      ['src', 'other', '--catalog', 'i18n/en.json'],
      ['src'],
      ['src', '--catalog', 'i18n/en.json', '--exclude'],
      ['src', '--catalog', 'i18n/en.json', '--unexpected'],
      ['src', '--catalog', 'i18n/en.json', '--format', 'yaml'],
      ['src', '--catalog', 'missing.json'],
      ['missing', '--catalog', 'i18n/en.json'],
    ];

    for (const args of cases) {
      const result = await runAnalyzeCommand(args, cwd);
      expect(result.exitCode, args.join(' ')).toBe(2);
      expect(result.stderr).toContain('etyma analyze:');
    }

    await writeFile(join(cwd, 'i18n/bad.json'), '{');
    const malformed = await runAnalyzeCommand(['src', '--catalog', 'i18n/bad.json'], cwd);
    expect(malformed.exitCode).toBe(2);

    await writeFile(join(cwd, 'i18n/invalid.json'), JSON.stringify({ title: 42 }));
    const invalid = await runAnalyzeCommand(['src', '--catalog', 'i18n/invalid.json'], cwd);
    expect(invalid.exitCode).toBe(2);
  });

  it('shows command help without requiring a directory or catalog', async () => {
    const result = await runAnalyzeCommand(['--help'], '/');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('etyma analyze <directory>');
  });
});
