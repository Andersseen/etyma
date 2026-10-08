import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { discoverSourceFiles } from './source-files.js';

describe('discoverSourceFiles', () => {
  let root: string;

  afterEach(async () => {
    if (root !== undefined) await rm(root, { recursive: true, force: true });
  });

  it('recurses deterministically, filters extensions/declarations, ignores generated trees and applies repeated globs', async () => {
    root = await mkdtemp(join(tmpdir(), 'etyma-source-files-'));
    const files = [
      'z.ts',
      'a.mts',
      'ui/view.tsx',
      'js/app.jsx',
      'js/runtime.cjs',
      'js/module.mjs',
      'js/plain.js',
      'js/common.cts',
      'types/index.d.ts',
      'types/index.d.mts',
      'types/index.d.cts',
      'view.html',
      'page.astro',
      'src/app.spec.ts',
      '__fixtures__/sample.ts',
      'node_modules/pkg/index.ts',
      'dist/generated.ts',
      '.git/ignored.ts',
      'coverage/report.ts',
    ];
    for (const file of files) {
      const path = join(root, file);
      await mkdir(join(path, '..'), { recursive: true });
      await writeFile(path, '');
    }

    const discovered = await discoverSourceFiles(root, ['**/*.spec.ts', '**/__fixtures__/**']);

    expect(discovered.map(file => file.path)).toEqual([
      'a.mts',
      'js/app.jsx',
      'js/common.cts',
      'js/module.mjs',
      'js/plain.js',
      'js/runtime.cjs',
      'ui/view.tsx',
      'z.ts',
    ]);
  });

  it('does not follow directory symlinks', async () => {
    root = await mkdtemp(join(tmpdir(), 'etyma-source-files-'));
    const outside = await mkdtemp(join(tmpdir(), 'etyma-source-outside-'));
    try {
      await writeFile(join(outside, 'linked.ts'), '');
      await symlink(outside, join(root, 'linked'), 'dir');
      expect(await discoverSourceFiles(root, [])).toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('includes HTML only when requested and applies excludes to templates', async () => {
    root = await mkdtemp(join(tmpdir(), 'etyma-source-files-'));
    await writeFile(join(root, 'app.ts'), '');
    await writeFile(join(root, 'app.html'), '');

    expect((await discoverSourceFiles(root, [])).map(file => file.path)).toEqual(['app.ts']);
    expect((await discoverSourceFiles(root, [], true)).map(file => file.path)).toEqual([
      'app.html',
      'app.ts',
    ]);
    expect((await discoverSourceFiles(root, ['**/*.html'], true)).map(file => file.path)).toEqual([
      'app.ts',
    ]);
  });
});
