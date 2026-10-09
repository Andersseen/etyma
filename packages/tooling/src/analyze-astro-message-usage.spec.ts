import { describe, expect, it } from 'vitest';

import { analyzeAstroMessageUsage } from './astro.js';

const KEYS = [
  'front.title',
  'page.title',
  'actions.save',
  'state.on',
  'state.off',
  'row.label',
  'rich.message',
  'nav.home',
];

describe('analyzeAstroMessageUsage', () => {
  it('combines proven frontmatter and template usages, including attributes and parts()', async () => {
    const source = `---
import { createAstroI18n as make } from '@etyma/astro';
const translations = await make(Astro, definition);
const t = translations.t;
const title = translations.t('front.title');
const brokenFrontmatterKey = translations.t('front.missing');
---
<h1>{translations.t('page.title')}</h1>
<button aria-label={translations.parts('actions.save')} />
{condition ? translations.t('state.on') : translations.t(\`state.off\`)}
{rows.map(row => (<span>{translations.t('row.label')}</span>))}
{t('nav.home')}
{rows.map(translations => translations.t('fake.shadow'))}
{rows.map(t => t('fake.callable-shadow'))}
`;

    const result = await analyzeAstroMessageUsage({
      keys: KEYS,
      files: [{ path: 'src/Page.astro', source }],
    });

    expect(result.used).toEqual([
      'actions.save',
      'front.title',
      'nav.home',
      'page.title',
      'row.label',
      'state.off',
      'state.on',
    ]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'source.unknown-key',
        path: 'src/Page.astro',
        line: 6,
        key: 'front.missing',
      }),
    ]);
    expect(result.unreferenced).toEqual(['rich.message']);
    expect(result.used).not.toContain('fake.shadow');
  });

  it('supports namespace imports, destructured members, and static template literals', async () => {
    const source = `---
import * as AstroEtyma from '@etyma/astro';
const i18n = await AstroEtyma.createAstroI18n(Astro, definition);
const { t, parts } = i18n;
---
{t(\`nav.home\`)}
{parts('rich.message')}
`;
    const result = await analyzeAstroMessageUsage({
      keys: KEYS,
      files: [{ path: 'Page.astro', source }],
    });

    expect(result.used).toEqual(['nav.home', 'rich.message']);
    expect(result.diagnostics).toEqual([]);
  });

  it('warns on dynamic keys and errors on unknown static keys with literal locations', async () => {
    const source = `---
import { createAstroI18n } from '@etyma/astro';
const etyma = await createAstroI18n(Astro, definition);
---
{etyma.t(prefix + '.title')}
<button aria-label={etyma.t('missing.key')} />
`;
    const result = await analyzeAstroMessageUsage({
      keys: KEYS,
      files: [{ path: 'real/Page.astro', source }],
    });
    const unknown = source.indexOf("'missing.key'");
    const dynamic = source.indexOf('prefix');

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'source.dynamic-key',
        severity: 'warning',
        path: 'real/Page.astro',
        line: 5,
        column: dynamic - source.lastIndexOf('\n', dynamic),
      }),
      expect.objectContaining({
        code: 'source.unknown-key',
        severity: 'error',
        path: 'real/Page.astro',
        line: 6,
        column: unknown - source.lastIndexOf('\n', unknown),
        key: 'missing.key',
      }),
    ]);
  });

  it('maps CRLF and UTF-16 locations to the original Astro document', async () => {
    const source =
      `---\r\nimport { createAstroI18n } from '@etyma/astro';\r\n` +
      `const etyma = await createAstroI18n(Astro, definition);\r\n---\r\n` +
      `<h1>🚀 {etyma.t('missing.key')}</h1>\r\n`;
    const keyOffset = source.indexOf("'missing.key'");
    const result = await analyzeAstroMessageUsage({
      keys: KEYS,
      files: [{ path: 'Page.astro', source }],
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'source.unknown-key',
        path: 'Page.astro',
        line: 5,
        column: keyOffset - source.lastIndexOf('\n', keyOffset),
        key: 'missing.key',
      }),
    );
  });

  it('does not infer provenance from a local object, wrong import, or Astro.props', async () => {
    const source = `---
const etyma = { t(key) { return key; } };
import { createAstroI18n } from '@other/package';
const fake = await createAstroI18n(Astro, definition);
const { t } = Astro.props;
---
{etyma.t('not.real')}{fake.t('not.real')}{t('not.real')}
`;
    const result = await analyzeAstroMessageUsage({
      keys: KEYS,
      files: [{ path: 'Fake.astro', source }],
    });

    expect(result.used).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('keeps valid file results when another Astro file has a parse error', async () => {
    const malformed = `---
import { createAstroI18n } from '@etyma/astro';
const etyma = await createAstroI18n(Astro, definition);
const broken = ;
---
`;
    const valid = `---
import { createAstroI18n } from '@etyma/astro';
const etyma = await createAstroI18n(Astro, definition);
---
{etyma.t('page.title')}
`;
    const result = await analyzeAstroMessageUsage({
      keys: KEYS,
      files: [
        { path: 'Broken.astro', source: malformed },
        { path: 'Valid.astro', source: valid },
      ],
    });

    expect(result.used).toEqual(['page.title']);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'source.parse-error', path: 'Broken.astro', line: 4 }),
    ]);
  });

  it('combines ordinary TypeScript and Astro files deterministically', async () => {
    const astro = `---
import { createAstroI18n } from '@etyma/astro';
const etyma = await createAstroI18n(Astro, definition);
---
{etyma.t('page.title')}
`;
    const files = [
      { path: 'Page.astro', source: astro },
      {
        path: 'copy.ts',
        source: `import { createAstroI18n } from '@etyma/astro';\nconst i18n = await createAstroI18n(Astro, def);\ni18n.t('nav.home');`,
      },
    ];
    const first = await analyzeAstroMessageUsage({ keys: KEYS, files });
    const shuffled = await analyzeAstroMessageUsage({
      keys: [...KEYS].reverse(),
      files: [...files].reverse(),
    });

    expect(shuffled).toEqual(first);
    expect(first.used).toEqual(['nav.home', 'page.title']);
  });

  it('follows an async project-local Astro wrapper into frontmatter and parts()', async () => {
    const result = await analyzeAstroMessageUsage({
      keys: KEYS,
      files: [
        {
          path: 'src/i18n/page.ts',
          source:
            `import { createAstroI18n } from '@etyma/astro';\n` +
            `export async function getPageI18n(astro: unknown) { return await createAstroI18n(astro, definition); }`,
        },
        {
          path: 'src/pages/index.astro',
          source:
            `---\nimport { getPageI18n } from '../i18n/page.js';\n` +
            `const etyma = await getPageI18n(Astro);\n---\n` +
            `<h1>{etyma.t('page.title')}</h1><div>{etyma.parts('rich.message')}</div>`,
        },
      ],
    });
    expect(result.used).toEqual(['page.title', 'rich.message']);
    expect(result.diagnostics).toEqual([]);
  });

  it('scales across hundreds of Astro files with many references', async () => {
    const keys = Array.from({ length: 400 }, (_, index) => `key${index}`);
    const files = Array.from({ length: 240 }, (_, fileIndex) => ({
      path: `src/Page${fileIndex}.astro`,
      source:
        `---\nimport { createAstroI18n } from '@etyma/astro';\n` +
        `const etyma = await createAstroI18n(Astro, def);\n---\n` +
        Array.from(
          { length: 12 },
          (_, callIndex) => `{etyma.t('key${(fileIndex * 12 + callIndex) % keys.length}')}`,
        ).join('\n'),
    }));

    const result = await analyzeAstroMessageUsage({ keys, files });
    expect(result.used).toHaveLength(keys.length);
    expect(result.diagnostics).toEqual([]);
    expect(result.unreferenced).toEqual([]);
  });
});
