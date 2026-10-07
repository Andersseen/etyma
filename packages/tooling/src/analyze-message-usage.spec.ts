import { describe, expect, it } from 'vitest';

import { analyzeMessageUsage } from './source.js';

const KEYS = ['nav.home', 'nav.docs', 'footer.rights'];

/** The distinct keys one TypeScript source references, whether or not the catalog has them. */
function referenced(source: string, path = 'src/app.ts'): string[] {
  const { used, diagnostics } = analyzeMessageUsage({
    // Every key the source could mention is "in" the catalog, so `used` is the full answer.
    keys: ['a', 'b', 'c', 'nav.home', 'nav.docs', 'x.y'],
    files: [{ path, source }],
  });

  expect(diagnostics).toEqual([]);
  return [...used];
}

const ANGULAR = `import { injectI18n, injectT } from '@etyma/angular';`;

describe('analyzeMessageUsage: Angular', () => {
  it('follows injectT()', () => {
    expect(referenced(`${ANGULAR}\nconst t = injectT(def);\nt('nav.home');`)).toEqual(['nav.home']);
  });

  it('follows an aliased injectT() by binding, not by name', () => {
    expect(
      referenced(
        `import { injectT as useTranslations } from '@etyma/angular';\n` +
          `const tr = useTranslations(def);\ntr('nav.docs');`,
      ),
    ).toEqual(['nav.docs']);
  });

  it('follows injectI18n() through a variable, t() and parts()', () => {
    expect(
      referenced(
        `${ANGULAR}\nconst i18n = injectI18n(def);\ni18n.t('nav.home');\ni18n.parts('a');`,
      ),
    ).toEqual(['a', 'nav.home']);
  });

  it('follows a direct injectI18n().t() chain', () => {
    expect(referenced(`${ANGULAR}\ninjectI18n(def).t('nav.home');`)).toEqual(['nav.home']);
  });

  it('follows class fields, including private ones and arrow functions', () => {
    expect(
      referenced(`${ANGULAR}
        class Nav {
          private readonly i18n = injectI18n(def);
          readonly t = injectT(def);
          readonly #own = injectI18n(def);
          title() { return this.i18n.t('nav.home'); }
          docs = () => this.t('nav.docs');
          other() { return this.#own.t('a'); }
        }`),
    ).toEqual(['a', 'nav.docs', 'nav.home']);
  });

  it('follows destructured members and member references', () => {
    expect(
      referenced(`${ANGULAR}
        const i18n = injectI18n(def);
        const { t, parts: p } = i18n;
        const direct = i18n.t;
        t('a'); p('b'); direct('c');`),
    ).toEqual(['a', 'b', 'c']);
  });

  it('follows a namespace import', () => {
    expect(
      referenced(`import * as etyma from '@etyma/angular';\netyma.injectT(def)('nav.home');`),
    ).toEqual(['nav.home']);
  });

  it('does not follow type-only imports', () => {
    expect(
      referenced(
        `import type { injectT } from '@etyma/angular';\nconst t = injectT(def);\nt('x.y');`,
      ),
    ).toEqual([]);
  });
});

describe('analyzeMessageUsage: Astro', () => {
  it('follows await createAstroI18n()', () => {
    expect(
      referenced(
        `import { createAstroI18n } from '@etyma/astro';\n` +
          `const etyma = await createAstroI18n(Astro, def);\netyma.t('nav.home');`,
      ),
    ).toEqual(['nav.home']);
  });

  it('follows an aliased createAstroI18n(), awaited inline', () => {
    expect(
      referenced(
        `import { createAstroI18n as make } from '@etyma/astro';\n` +
          `(await make(Astro, def)).t('nav.docs');`,
      ),
    ).toEqual(['nav.docs']);
  });
});

describe('analyzeMessageUsage: core', () => {
  it('follows createTranslator() translate() and translateToParts()', () => {
    expect(
      referenced(
        `import { createTranslator } from '@etyma/core';\n` +
          `const translator = createTranslator(input);\n` +
          `translator.translate('nav.home');\ntranslator.translateToParts('nav.docs');`,
      ),
    ).toEqual(['nav.docs', 'nav.home']);
  });

  it('does not count has(), which probes a key rather than rendering it', () => {
    expect(
      referenced(
        `import { createTranslator } from '@etyma/core';\n` +
          `createTranslator(input).has('nav.home');`,
      ),
    ).toEqual([]);
  });
});

describe('analyzeMessageUsage: literal forms', () => {
  it.each([
    ['single quotes', `t('nav.home')`],
    ['double quotes', `t("nav.home")`],
    ['a template without substitutions', 't(`nav.home`)'],
    ['parentheses', `t(('nav.home'))`],
    ['as const', `t('nav.home' as const)`],
    ['satisfies', `t('nav.home' satisfies string)`],
    ['a non-null assertion', `t('nav.home'!)`],
    ['an optional call', `t?.('nav.home')`],
    ['a trailing params argument', `t('nav.home', { n: 1 })`],
  ])('reads %s', (_label, call) => {
    expect(referenced(`${ANGULAR}\nconst t = injectT(def);\n${call};`)).toEqual(['nav.home']);
  });

  it('follows optional chaining on the receiver and the method', () => {
    expect(
      referenced(`${ANGULAR}\nconst i18n = injectI18n(def);\ni18n?.t('a');\ni18n.t?.('b');`),
    ).toEqual(['a', 'b']);
  });

  it('reads calls inside JSX expressions in a .tsx file', () => {
    expect(
      referenced(
        `${ANGULAR}\nconst t = injectT(def);\nconst view = <h1>{t('nav.home')}</h1>;`,
        'a.tsx',
      ),
    ).toEqual(['nav.home']);
  });

  it('reads plain JavaScript', () => {
    expect(
      referenced(
        `import { injectT } from '@etyma/angular';\nconst t = injectT();\nt('nav.home');`,
        'a.mjs',
      ),
    ).toEqual(['nav.home']);
  });
});

describe('analyzeMessageUsage: dynamic keys', () => {
  it.each([
    ['a variable', 't(key)'],
    ['a concatenation', `t(prefix + '.title')`],
    ['a template with substitutions', 't(`docs.${section}`)'],
    ['a call', 't(getKey())'],
    ['a constant, which is not propagated', `t(KEY)`],
    ['a spread', 't(...args)'],
  ])('reports %s as a warning, not an error', (_label, call) => {
    const result = analyzeMessageUsage({
      keys: KEYS,
      files: [
        {
          path: 'a.ts',
          source: `${ANGULAR}\nconst KEY = 'nav.home';\nconst t = injectT(def);\n${call};`,
        },
      ],
    });

    expect(result.used).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'source.dynamic-key',
        severity: 'warning',
        path: 'a.ts',
        line: 4,
        column: 3,
      }),
    ]);
    expect(result.diagnostics[0]).not.toHaveProperty('key');
  });
});

describe('analyzeMessageUsage: no false positives', () => {
  it.each([
    ['a locally declared t()', `function t(v: string) { return v; }\nt('a');`],
    ['an arbitrary object.t()', `const o = { t(v: string) { return v; } };\no.t('a');`],
    [
      'createTranslator from another package',
      `import { createTranslator } from 'other-i18n';\nconst tr = createTranslator();\ntr.translate('a');`,
    ],
    [
      'injectT from another package',
      `import { injectT } from 'other-i18n';\nconst t = injectT();\nt('a');`,
    ],
    [
      'a similarly named factory in the same file',
      `const injectT = () => (k: string) => k;\nconst t = injectT();\nt('a');`,
    ],
    [
      'a factory from a different Etyma package',
      `import { injectT } from '@etyma/core';\nconst t = injectT();\nt('a');`,
    ],
    [
      'a prop-drilled translator',
      `function view({ t }: { t: (k: string) => string }) { return t('a'); }`,
    ],
    ['an undeclared t', `t('a');`],
    ['a wrapper', `${ANGULAR}\nconst tr = wrap(injectT(def));\ntr('a');`],
    ['t.call()', `${ANGULAR}\nconst t = injectT(def);\nt.call(null, 'a');`],
    ['a let binding, which may be reassigned', `${ANGULAR}\nlet t = injectT(def);\nt('a');`],
    ['a tagged template', `${ANGULAR}\nconst t = injectT(def);\nt\`a\`;`],
  ])('ignores %s', (_label, source) => {
    expect(referenced(source)).toEqual([]);
  });

  it('respects shadowing by parameters, locals, catch clauses and loops', () => {
    expect(
      referenced(`${ANGULAR}
        const t = injectT(def);
        function a(t: (k: string) => string) { return t('a'); }
        const b = (t: unknown) => (t as (k: string) => string)('b');
        function c() { const t = (k: string) => k; return t('c'); }
        function d() { var t = (k: string) => k; return t('x.y'); }
        try {} catch (t) { (t as (k: string) => string)('a'); }
        for (const t of []) { (t as (k: string) => string)('b'); }
        function e({ t }: { t: (k: string) => string }) { return t('c'); }
        t('nav.home');`),
    ).toEqual(['nav.home']);
  });

  it('still sees the module translator from nested scopes that do not shadow it', () => {
    expect(
      referenced(`${ANGULAR}
        const t = injectT(def);
        function view(n: number) { if (n) { return () => t('nav.docs'); } return null; }`),
    ).toEqual(['nav.docs']);
  });

  it('does not take this.t from a plain function, a static member or an object literal', () => {
    expect(
      referenced(`${ANGULAR}
        class A {
          readonly t = injectT(def);
          static s() { return this.t('a'); }
          m() { return function () { return this.t('b'); }; }
          o = { n() { return this.t('c'); } };
        }`),
    ).toEqual([]);
  });
});

describe('analyzeMessageUsage: catalog comparison', () => {
  it('reports used keys, unknown literals and unreferenced candidates', () => {
    const result = analyzeMessageUsage({
      keys: ['nav.home', 'nav.docs'],
      files: [
        {
          path: 'src/app.ts',
          source: `${ANGULAR}\nconst t = injectT(def);\nt('nav.home');\n  t('nav.typo');`,
        },
      ],
    });

    expect(result).toEqual({
      used: ['nav.home'],
      unreferenced: ['nav.docs'],
      diagnostics: [
        {
          code: 'source.unknown-key',
          severity: 'error',
          path: 'src/app.ts',
          line: 4,
          column: 5,
          key: 'nav.typo',
          message: expect.stringContaining('nav.typo') as string,
        },
      ],
    });
  });

  it('points at the key argument, in 1-based line and column', () => {
    const { diagnostics } = analyzeMessageUsage({
      keys: [],
      files: [{ path: 'a.ts', source: `${ANGULAR}\nconst t = injectT();\nfoo(1); t( 'x' );` }],
    });

    expect(diagnostics).toEqual([expect.objectContaining({ line: 3, column: 12 })]);
  });

  it('lists a key used ten times once', () => {
    const calls = Array.from({ length: 10 }, () => `t('nav.home');`).join('\n');
    const result = analyzeMessageUsage({
      keys: KEYS,
      files: [{ path: 'a.ts', source: `${ANGULAR}\nconst t = injectT();\n${calls}` }],
    });

    expect(result.used).toEqual(['nav.home']);
  });

  it('normalises duplicate catalog keys', () => {
    const result = analyzeMessageUsage({ keys: ['b', 'a', 'b', 'a'], files: [] });

    expect(result).toEqual({ used: [], unreferenced: ['a', 'b'], diagnostics: [] });
  });

  it.each([
    ['no keys and no files', [], []],
    ['keys and no files', ['a'], []],
    ['files and no keys', [], [{ path: 'a.ts', source: 'export {};' }]],
  ])('handles %s', (_label, keys, files) => {
    expect(analyzeMessageUsage({ keys, files })).toEqual({
      used: [],
      unreferenced: keys,
      diagnostics: [],
    });
  });
});

describe('analyzeMessageUsage: determinism', () => {
  const files = [
    {
      path: 'src/z.ts',
      source: `${ANGULAR}\nconst t = injectT();\nt('footer.rights'); t('z.bad'); t(k);`,
    },
    { path: 'src/a.ts', source: `${ANGULAR}\nconst t = injectT();\nt('nav.home'); t('a.bad');` },
    {
      path: 'src/m.tsx',
      source: `${ANGULAR}\nconst t = injectT();\nconst v = <i>{t('m.bad')}</i>;`,
    },
    { path: 'src/broken.ts', source: `${ANGULAR}\nconst t = injectT();\nt('nav.docs'` },
  ];

  it('does not depend on the order of files or keys', () => {
    const forward = analyzeMessageUsage({ keys: KEYS, files });
    const shuffled = analyzeMessageUsage({
      keys: [...KEYS].reverse(),
      files: [files[2], files[0], files[3], files[1]] as typeof files,
    });

    expect(shuffled).toEqual(forward);
    expect(forward.diagnostics.map(d => `${d.path}:${d.line}:${d.column}:${d.code}`)).toEqual(
      [...forward.diagnostics.map(d => `${d.path}:${d.line}:${d.column}:${d.code}`)].sort(),
    );
    // The broken file's unterminated call is still recovered by the parser.
    expect(forward.used).toEqual(['footer.rights', 'nav.docs', 'nav.home']);
    expect(forward.unreferenced).toEqual([]);
  });
});

describe('analyzeMessageUsage: malformed source', () => {
  it('reports a parse error at its position and still analyses the other files', () => {
    const result = analyzeMessageUsage({
      keys: ['nav.home'],
      files: [
        { path: 'src/bad.ts', source: `const x = ;\nconst y = (1 +;\n` },
        { path: 'src/good.ts', source: `${ANGULAR}\nconst t = injectT();\nt('nav.home');` },
      ],
    });

    expect(result.used).toEqual(['nav.home']);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic).toEqual({
        code: 'source.parse-error',
        severity: 'error',
        path: 'src/bad.ts',
        line: expect.any(Number) as number,
        column: expect.any(Number) as number,
        message: expect.any(String) as string,
      });
    }
    expect(result.diagnostics[0]).toMatchObject({ line: 1, column: 11 });
  });

  it('keeps analysing what a recovering parser still understands', () => {
    const result = analyzeMessageUsage({
      keys: ['nav.home'],
      files: [
        { path: 'a.ts', source: `${ANGULAR}\nconst t = injectT();\nt('nav.home');\nconst = ;` },
      ],
    });

    expect(result.used).toEqual(['nav.home']);
    expect(result.diagnostics.every(d => d.code === 'source.parse-error')).toBe(true);
  });

  it('chooses the parser from the extension and falls back to TypeScript', () => {
    const jsx = `${ANGULAR}\nconst t = injectT();\nconst v = <b>{t('a')}</b>;`;
    const parse = (path: string) =>
      analyzeMessageUsage({ keys: ['a'], files: [{ path, source: jsx }] }).diagnostics.length;

    expect(parse('a.tsx')).toBe(0);
    expect(parse('a.jsx')).toBe(0);
    expect(parse('a.ts')).toBeGreaterThan(0);
    expect(parse('a.unknown')).toBeGreaterThan(0);
  });
});
