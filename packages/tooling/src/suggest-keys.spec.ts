import { describe, expect, it } from 'vitest';

import { analyzeAngularMessageUsage } from './angular.js';
import { analyzeAstroMessageUsage } from './astro.js';
import { analyzeMessageUsage } from './source.js';
import { createKeySuggester, MAX_KEY_SUGGESTIONS } from './suggest-keys.js';

function suggest(unknown: string, catalog: readonly string[]): readonly string[] {
  return createKeySuggester(catalog)(unknown);
}

describe('createKeySuggester', () => {
  it('suggests a substituted, inserted, deleted and transposed character', () => {
    expect(suggest('nav.docz', ['nav.home', 'nav.docs', 'account.profile'])).toEqual(['nav.docs']);
    expect(suggest('settings.accoumt', ['settings.account'])).toEqual(['settings.account']);
    expect(suggest('settings.accunt', ['settings.account'])).toEqual(['settings.account']);
    expect(suggest('settings.accountt', ['settings.account'])).toEqual(['settings.account']);
    expect(suggest('nav.dcos', ['nav.docs'])).toEqual(['nav.docs']);
    expect(suggest('dashboard.settigns', ['dashboard.settings'])).toEqual(['dashboard.settings']);
  });

  it('suggests the right key for a case-only mistake', () => {
    expect(suggest('Settings.Account.Title', ['settings.account.title'])).toEqual([
      'settings.account.title',
    ]);
    expect(suggest('Nav.Home', ['nav.home', 'nav.hope'])).toEqual(['nav.home']);
  });

  it('treats a typo in the namespace as eligible', () => {
    expect(suggest('nva.docs', ['nav.docs', 'footer.rights'])).toEqual(['nav.docs']);
  });

  it('prefers the same namespace over a reversed one', () => {
    expect(suggest('nav.docz', ['nav.docs', 'docs.nav', 'nav.home'])).toEqual(['nav.docs']);
  });

  it('handles a missing or extra dot segment separator', () => {
    expect(suggest('settings.accounttitle', ['settings.account.title'])).toEqual([
      'settings.account.title',
    ]);
    expect(suggest('settings.account.ti.tle', ['settings.account.title'])).toEqual([
      'settings.account.title',
    ]);
  });

  it('returns nothing when no key is close', () => {
    expect(
      suggest('completely.other', [
        'checkout.payment.title',
        'profile.avatar.edit',
        'documentation.install',
      ]),
    ).toEqual([]);
    expect(suggest('nav.docz', ['nav.home', 'account.profile'])).toEqual([]);
  });

  it('does not guess among short keys', () => {
    expect(suggest('to', ['on', 'no', 'go'])).toEqual([]);
    expect(suggest('ab.c', ['ab.d', 'ab.e', 'ac.c', 'xb.c'])).toEqual([]);
    expect(suggest('TO', ['to', 'on'])).toEqual(['to']);
  });

  it('emits at most three suggestions, in a deterministic order', () => {
    const catalog = ['nav.docsa', 'nav.docsb', 'nav.docsc', 'nav.docsd', 'nav.docse'];
    const result = suggest('nav.docs', catalog);
    expect(result).toEqual(['nav.docsa', 'nav.docsb', 'nav.docsc']);
    expect(result.length).toBeLessThanOrEqual(MAX_KEY_SUGGESTIONS);
  });

  it('is independent of catalog order and duplicates', () => {
    const catalog = ['pages.title1', 'pages.title2', 'pages.title3', 'pages.title4', 'pages.tilte'];
    const expected = suggest('pages.titlx', catalog);
    expect(expected.length).toBeGreaterThan(0);
    // Rotations plus duplicates cover many distinct input orders without a random source.
    for (let shift = 1; shift < catalog.length; shift++) {
      const rotated = [...catalog.slice(shift), ...catalog.slice(0, shift), ...catalog];
      expect(suggest('pages.titlx', rotated)).toEqual(expected);
    }
    expect(suggest('pages.titlx', [...catalog].reverse())).toEqual(expected);
    expect(new Set(expected).size).toBe(expected.length);
  });

  it('caches by unknown key', () => {
    const suggester = createKeySuggester(['nav.docs']);
    expect(suggester('nav.docz')).toBe(suggester('nav.docz'));
  });
});

const CATALOG = ['nav.home', 'nav.docs', 'account.profile'];
const ANGULAR_IMPORTS = `import { Component } from '@angular/core';
import { injectT } from '@etyma/angular';`;

describe('unknown-key suggestions through every analyzer', () => {
  it('JS/TS', () => {
    const result = analyzeMessageUsage({
      keys: CATALOG,
      files: [
        {
          path: 'src/nav.ts',
          source: `import { injectT } from '@etyma/angular';\nconst t = injectT(d);\nt('nav.docz');\nt('nav.home');`,
        },
      ],
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'source.unknown-key',
        severity: 'error',
        key: 'nav.docz',
        suggestions: ['nav.docs'],
      }),
    ]);
    // Advice only: the suggested key is not usage.
    expect(result.used).toEqual(['nav.home']);
    expect(result.unreferenced).toEqual(['account.profile', 'nav.docs']);
  });

  it('Angular templates', () => {
    const result = analyzeAngularMessageUsage({
      keys: CATALOG,
      files: [
        {
          path: 'src/a.ts',
          source: `${ANGULAR_IMPORTS}\n@Component({ template: \`{{ t('nav.docz') }}\` })\nclass A { readonly t = injectT(d); }`,
        },
      ],
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'source.unknown-key', suggestions: ['nav.docs'] }),
    ]);
    expect(result.used).toEqual([]);
  });

  it('Astro components', async () => {
    const result = await analyzeAstroMessageUsage({
      keys: CATALOG,
      files: [
        {
          path: 'src/P.astro',
          source: `---\nimport { createAstroI18n } from '@etyma/astro';\nconst etyma = await createAstroI18n(Astro, d);\n---\n<p>{etyma.t('nav.docz')}</p>`,
        },
      ],
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'source.unknown-key', suggestions: ['nav.docs'] }),
    ]);
    expect(result.used).toEqual([]);
  });

  it('project-local wrappers', () => {
    const result = analyzeMessageUsage({
      keys: CATALOG,
      files: [
        {
          path: 'src/i18n.ts',
          source: `import { injectT } from '@etyma/angular';\nexport const injectAppT = () => injectT(def);`,
        },
        {
          path: 'src/page.ts',
          source: `import { injectAppT } from './i18n';\ninjectAppT()('nav.docz');`,
        },
      ],
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ key: 'nav.docz', suggestions: ['nav.docs'] }),
    ]);
  });

  it('keeps one ordered answer for repeated and several different typos', () => {
    const calls = ['nav.docz', 'nav.hoem', 'nav.docz', 'unrelated.thing'];
    const result = analyzeMessageUsage({
      keys: CATALOG,
      files: [
        ['src/a.ts', calls[0]],
        ['src/b.ts', calls[1]],
        ['src/c.ts', calls[2]],
        ['src/d.ts', calls[3]],
      ].map(([path, key]) => ({
        path: path ?? '',
        source: `import { injectT } from '@etyma/angular';\ninjectT(d)('${key}');`,
      })),
    });
    expect(result.diagnostics.map(d => [d.key, d.suggestions])).toEqual([
      ['nav.docz', ['nav.docs']],
      ['nav.hoem', ['nav.home']],
      ['nav.docz', ['nav.docs']],
      ['unrelated.thing', undefined],
    ]);
    expect('suggestions' in (result.diagnostics[3] ?? {})).toBe(false);
  });

  it('never suggests for dynamic, parse and template-missing diagnostics', () => {
    const dynamic = analyzeMessageUsage({
      keys: CATALOG,
      files: [
        { path: 'a.ts', source: `import { injectT } from '@etyma/angular';\ninjectT(d)(key);` },
      ],
    });
    const parse = analyzeMessageUsage({
      keys: CATALOG,
      files: [{ path: 'b.ts', source: `import { injectT } from '@etyma/angular'; injectT(` }],
    });
    const missing = analyzeAngularMessageUsage({
      keys: CATALOG,
      files: [
        {
          path: 'c.ts',
          source: `${ANGULAR_IMPORTS}\n@Component({ templateUrl: './nav.docz.html' }) class C { t = injectT(d); }`,
        },
      ],
    });
    const codes = [dynamic, parse, missing].flatMap(r => r.diagnostics);
    expect(codes.map(d => d.code)).toEqual([
      'source.dynamic-key',
      'source.parse-error',
      'source.template-missing',
    ]);
    for (const d of codes) expect('suggestions' in d).toBe(false);
  });
});
