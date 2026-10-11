import { describe, expect, it } from 'vitest';

import { analyzeMessageUsage } from './source.js';

/**
 * Asserts correctness at scale, not a duration: an implementation that scanned the key array
 * once per usage (usages x keys) or re-parsed a file per key would be slow enough to hit
 * Vitest's own timeout long before an assertion could fail, which is a steadier signal than
 * asserting on elapsed milliseconds.
 */
describe('analyzeMessageUsage: performance at scale', () => {
  const keyCount = 800;
  const keys = Array.from({ length: keyCount }, (_, i) => `section${i % 40}.key${i}`);

  it('analyses hundreds of files and thousands of calls', () => {
    const fileCount = 300;
    const callsPerFile = 20;
    const unusedFrom = 700;

    const files = Array.from({ length: fileCount }, (_, f) => {
      const calls = Array.from({ length: callsPerFile }, (_, c) => {
        const key = keys[(f * callsPerFile + c) % unusedFrom];
        return `  t('${key ?? ''}');\n  t(dynamic${c});`;
      }).join('\n');

      return {
        path: `src/feature${f}.ts`,
        source: `import { injectT } from '@etyma/angular';\nconst t = injectT();\nexport function view() {\n${calls}\n}\n`,
      };
    });
    files.push({
      path: 'src/typo.ts',
      source: `import { injectT } from '@etyma/angular';\ninjectT()('nope');`,
    });

    const result = analyzeMessageUsage({ keys, files });

    expect(result.used).toHaveLength(unusedFrom);
    expect(result.unreferenced).toHaveLength(keyCount - unusedFrom);
    expect(result.diagnostics.filter(d => d.code === 'source.dynamic-key')).toHaveLength(
      fileCount * callsPerFile,
    );
    expect(result.diagnostics.filter(d => d.code === 'source.unknown-key')).toEqual([
      expect.objectContaining({ path: 'src/typo.ts', key: 'nope' }),
    ]);
  });

  it('analyses one file with many calls', () => {
    const calls = Array.from({ length: 5000 }, (_, i) => `t('${keys[i % keyCount] ?? ''}');`);
    const source = `import { injectT } from '@etyma/angular';\nconst t = injectT();\n${calls.join('\n')}`;

    const result = analyzeMessageUsage({ keys, files: [{ path: 'big.ts', source }] });

    expect(result.used).toHaveLength(keyCount);
    expect(result.unreferenced).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });
});

describe('analyzeMessageUsage: unknown-key suggestions at scale', () => {
  it('ranks many typos, with repeats, against a thousand-key catalog', () => {
    const keys = Array.from({ length: 1000 }, (_, i) => `section${i % 50}.message${i}`);
    const calls = Array.from({ length: 2000 }, (_, i) => {
      // A third are valid, a third repeat a handful of typos, a third are unrelated.
      const key = keys[i % keys.length] ?? '';
      if (i % 3 === 0) return `t('${key}');`;
      if (i % 3 === 1) return `t('${keys[i % 7]}x');`;
      return `t('unrelated.thing${i}');`;
    });
    const source = `import { injectT } from '@etyma/angular';\nconst t = injectT();\n${calls.join('\n')}`;

    const result = analyzeMessageUsage({ keys, files: [{ path: 'big.ts', source }] });
    const unknown = result.diagnostics.filter(d => d.code === 'source.unknown-key');

    expect(unknown).toHaveLength(calls.length - Math.ceil(calls.length / 3));
    const typos = unknown.filter(d => d.key?.endsWith('x'));
    expect(typos.length).toBeGreaterThan(600);
    for (const d of typos) {
      expect(d.suggestions?.[0]).toBe(d.key?.slice(0, -1));
    }
  });
});
