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
