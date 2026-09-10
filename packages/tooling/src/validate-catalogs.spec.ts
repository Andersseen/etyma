import { describe, expect, it } from 'vitest';

import { validateCatalogs } from './validate-catalogs.js';

function codes(result: ReturnType<typeof validateCatalogs>): string[] {
  return result.diagnostics.map(d => d.code);
}

describe('validateCatalogs: valid input', () => {
  it('accepts one source locale with no translations', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: { en: { nav: { docs: 'Docs' } } },
    });

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('accepts full key parity across several locales', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { nav: { docs: 'Docs' }, greeting: 'Hello {$name}' },
        es: { nav: { docs: 'Documentación' }, greeting: 'Hola {$name}' },
        uk: { nav: { docs: 'Документація' }, greeting: 'Привіт {$name}' },
      },
    });

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('accepts different plural category sets per locale', () => {
    const en =
      '.input {$count :number}\n.match $count\none {{{$count} item}}\n*   {{{$count} items}}';
    const uk =
      '.input {$count :number}\n' +
      '.match $count\n' +
      'one {{{$count} елемент}}\n' +
      'few {{{$count} елементи}}\n' +
      'many {{{$count} елементів}}\n' +
      '*    {{{$count} елемента}}';

    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: { en: { count: en }, uk: { count: uk } },
    });

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });
});

describe('validateCatalogs: key parity', () => {
  it('reports a key missing from a translation', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { nav: { docs: 'Docs' } },
        es: { nav: {} },
      },
    });

    expect(result.diagnostics).toEqual([
      {
        code: 'catalog.missing-key',
        severity: 'error',
        locale: 'es',
        key: 'nav.docs',
        message: '"nav.docs" exists in the source locale "en" but has no translation in "es".',
      },
    ]);
  });

  it('reports a key the translation has and the source does not', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { nav: { docs: 'Docs' } },
        es: { nav: { docs: 'Documentación', potato: 'Patata' } },
      },
    });

    expect(codes(result)).toEqual(['catalog.extra-key']);
    expect(result.diagnostics[0]).toMatchObject({ locale: 'es', key: 'nav.potato' });
  });

  it('does not compare the source catalog against itself', () => {
    const result = validateCatalogs({ sourceLocale: 'en', catalogs: { en: { a: 'A' } } });

    expect(codes(result)).toEqual([]);
  });
});

describe('validateCatalogs: variable parity', () => {
  it('reports a variable missing from a translation', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { greeting: 'Hello {$name}' },
        es: { greeting: 'Hola' },
      },
    });

    expect(result.diagnostics).toEqual([
      {
        code: 'message.missing-variable',
        severity: 'error',
        locale: 'es',
        key: 'greeting',
        message:
          'Variable "name" is used in the source message but missing from the "es" translation.',
      },
    ]);
  });

  it('reports a variable only the translation has', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { greeting: 'Hello {$name}' },
        es: { greeting: 'Hola {$name} {$surname}' },
      },
    });

    expect(codes(result)).toEqual(['message.extra-variable']);
    expect(result.diagnostics[0]).toMatchObject({
      locale: 'es',
      key: 'greeting',
      message: 'Variable "surname" is used in the "es" translation but not in the source message.',
    });
  });

  it('checks declaration and selector variables, not only bare placeholders', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: {
          count:
            '.input {$count :number}\n.match $count\none {{{$count} item}}\n*   {{{$count} items}}',
        },
        es: {
          // Drops the external variable entirely - no .input, no selector, no placeholder.
          count: 'algunos artículos',
        },
      },
    });

    expect(codes(result)).toContain('message.missing-variable');
    expect(result.diagnostics.find(d => d.code === 'message.missing-variable')).toMatchObject({
      message: expect.stringContaining('"count"'),
    });
  });

  it('does not compare variables when the translation fails to parse', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { greeting: 'Hello {$name}' },
        es: { greeting: 'Hola {$name' },
      },
    });

    expect(codes(result)).toEqual(['message.invalid-syntax']);
  });
});

describe('validateCatalogs: variable function parity (best-effort)', () => {
  it('warns when a translation drops a variable’s function annotation', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { rights: '© {$year :number useGrouping=never}' },
        es: { rights: '© {$year}' },
      },
    });

    expect(result.diagnostics).toEqual([
      {
        code: 'message.variable-function-mismatch',
        severity: 'warning',
        locale: 'es',
        key: 'rights',
        message:
          'Variable "year" is formatted with ":number" in the source message but has no ' +
          'function annotation in the "es" translation.',
      },
    ]);
    // A warning alone does not fail validation.
    expect(result.valid).toBe(true);
  });

  it('warns when a translation uses a different function', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { published: '{$when :date}' },
        es: { published: '{$when :string}' },
      },
    });

    expect(codes(result)).toEqual(['message.variable-function-mismatch']);
  });

  it('does not warn when both sides use the same function', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { rights: '{$year :number}' },
        es: { rights: '{$year :number}' },
      },
    });

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('skips the comparison when the source annotates a variable ambiguously', () => {
    // $count is annotated :number in one branch's local and :string nowhere consistent -
    // constructed so the source itself carries two distinct annotations for the same
    // variable, which is exactly the case narrow validation should decline to judge.
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: {
          count:
            '.local $asNumber = {$count :number}\n' +
            '.local $asString = {$count :string}\n' +
            '{{{$asNumber} {$asString}}}',
        },
        es: { count: '{$count}' },
      },
    });

    expect(codes(result)).toEqual([]);
  });
});

describe('validateCatalogs: configuration', () => {
  it('reports no source locale', () => {
    const result = validateCatalogs({ catalogs: { en: { a: 'A' } } });

    expect(codes(result)).toEqual(['config.no-source-locale']);
  });

  it('reports no catalogs', () => {
    const result = validateCatalogs({ sourceLocale: 'en' });

    expect(result.diagnostics).toEqual([
      { code: 'config.no-catalogs', severity: 'error', message: 'No catalogs were given.' },
    ]);
  });

  it('reports a source locale absent from the catalogs', () => {
    const result = validateCatalogs({ sourceLocale: 'en', catalogs: { es: { a: 'A' } } });

    expect(codes(result)).toContain('config.source-catalog-missing');
  });

  it('reports two locale keys that canonicalize to the same BCP 47 tag', () => {
    const result = validateCatalogs({
      sourceLocale: 'en-US',
      catalogs: { 'en-US': { a: 'A' }, 'en-us': { a: 'A' } },
    });

    const duplicate = result.diagnostics.filter(d => d.code === 'config.duplicate-locale');

    expect(duplicate.map(d => d.locale).sort()).toEqual(['en-US', 'en-us']);
  });
});

describe('validateCatalogs: determinism', () => {
  it('sorts diagnostics by locale, then key, then code', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { b: 'B', a: 'A' },
        uk: {},
        es: {},
      },
    });

    const seen = result.diagnostics.map(d => `${d.locale ?? ''}:${d.key ?? ''}:${d.code}`);

    expect(seen).toEqual([...seen].sort());
  });

  it('produces the same diagnostics, in the same order, on every call', () => {
    const input = {
      sourceLocale: 'en',
      catalogs: {
        en: { nav: { docs: 'Docs' }, greeting: 'Hello {$name}' },
        es: { nav: {}, greeting: 'Hola {$surname}' },
      },
    };

    const first = validateCatalogs(input);
    const second = validateCatalogs(input);

    expect(second).toEqual(first);
  });
});

describe('validateCatalogs: multiple errors per run', () => {
  it('collects every problem instead of stopping at the first', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: { nav: { docs: 'Docs' }, greeting: 'Hello {$name}', empty: 'not empty' },
        es: {
          nav: {},
          greeting: 'Hola {$surname}',
          empty: '',
          extra: 'unexpected',
        },
      },
    });

    expect(result.valid).toBe(false);
    expect(codes(result).sort()).toEqual(
      [
        'catalog.extra-key',
        'catalog.missing-key',
        'message.empty',
        'message.extra-variable',
        'message.missing-variable',
      ].sort(),
    );
  });
});
