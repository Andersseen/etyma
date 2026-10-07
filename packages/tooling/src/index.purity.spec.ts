/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as main from './index.js';
import * as source from './source.js';

/**
 * `import { validateCatalogs } from '@etyma/tooling'` must never fetch, read files, touch
 * `process` or log - that is what lets a browser editor or an edge function use it. Network
 * access lives only behind `@etyma/tooling/vite`; this walks the main entry's real relative
 * import graph to prove none of it leaks in through a convenient re-export.
 */
function importGraph(entry: string): Map<string, string> {
  const seen = new Map<string, string>();
  const pending = [entry];

  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) {
      continue;
    }

    const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
    // Comments describe what the code must not do; only the code itself is checked.
    seen.set(file, source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''));

    for (const [, specifier] of source.matchAll(/from '(\.\/[^']+)\.js'/g)) {
      pending.push(`${specifier}.ts`);
    }
  }

  return seen;
}

describe('the main @etyma/tooling entry point', () => {
  const graph = importGraph('./index.ts');

  it('never reaches the Vite adapter, remote acquisition or source analysis', () => {
    expect([...graph.keys()].sort()).not.toContainEqual(
      expect.stringMatching(/vite|remote|source/),
    );
  });

  it('never loads the TypeScript parser', () => {
    const offenders = [...graph].filter(([, text]) => text.includes("from 'typescript'"));

    expect(offenders).toEqual([]);
  });

  it.each([
    ['fetch', /\bfetch\(/],
    ['Node built-ins', /from 'node:/],
    ['process', /\bprocess\./],
    ['console', /\bconsole\./],
  ])('uses no %s', (_label, pattern) => {
    const offenders = [...graph].filter(([, source]) => pattern.test(source)).map(([f]) => f);

    expect(offenders).toEqual([]);
  });

  it('does not export the Vite plugins', () => {
    expect(Object.keys(main)).not.toContain('etymaRemoteValidation');
    expect(Object.keys(main)).not.toContain('etymaRemoteContract');
  });
});

/**
 * `@etyma/tooling/source` needs the TypeScript parser, and that is all it may reach: it is
 * still an in-memory engine, so a future CLI hands it files rather than it finding them.
 */
describe('the @etyma/tooling/source entry point', () => {
  const graph = importGraph('./source.ts');

  it('is the only entry that loads the TypeScript parser', () => {
    const loaders = [...graph].filter(([, text]) => text.includes("from 'typescript'"));

    expect(loaders.map(([file]) => file)).toEqual(['./source-scan.ts']);
  });

  it('never reaches the Vite adapter or remote acquisition', () => {
    expect([...graph.keys()].sort()).not.toContainEqual(expect.stringMatching(/vite|remote/));
  });

  it.each([
    ['fetch', /\bfetch\(/],
    ['Node built-ins', /from 'node:/],
    ['process', /\bprocess\./],
    ['console', /\bconsole\./],
    ['eval', /\beval\(|new Function\(/],
    ['a TypeScript program or host', /\bcreateProgram\b|\bsys\./],
  ])('uses no %s', (_label, pattern) => {
    const offenders = [...graph].filter(([, text]) => pattern.test(text)).map(([f]) => f);

    expect(offenders).toEqual([]);
  });

  it('exports only the analysis API', () => {
    expect(Object.keys(source)).toEqual(['analyzeMessageUsage']);
  });
});
