import { describe, expect, it } from 'vitest';

import { validateCatalog } from './validate-catalog.js';

function codes(result: ReturnType<typeof validateCatalog>): string[] {
  return result.diagnostics.map(d => d.code);
}

describe('validateCatalog: valid catalogs', () => {
  it('accepts a nested catalog of plain strings', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: { nav: { docs: 'Docs', components: 'Components' }, welcome: 'Hello' },
    });

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('accepts a simple external variable', () => {
    const result = validateCatalog({ locale: 'en', catalog: { greeting: 'Hello {$name}' } });

    expect(result.valid).toBe(true);
  });

  it('accepts a number and a date', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: {
        rights: '© {$year :number useGrouping=never}',
        published: 'Published {$when :date style=long}',
      },
    });

    expect(result.valid).toBe(true);
  });

  it('accepts an English one/other plural', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: {
        count:
          '.input {$count :number}\n.match $count\none {{{$count} item}}\n*   {{{$count} items}}',
      },
    });

    expect(result.valid).toBe(true);
  });

  it('accepts a Ukrainian one/few/many/other plural', () => {
    const result = validateCatalog({
      locale: 'uk',
      catalog: {
        count:
          '.input {$count :number}\n' +
          '.match $count\n' +
          'one {{{$count} елемент}}\n' +
          'few {{{$count} елементи}}\n' +
          'many {{{$count} елементів}}\n' +
          '*    {{{$count} елемента}}',
      },
    });

    expect(result.valid).toBe(true);
  });

  it('accepts a select', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: {
        pronoun:
          '.input {$gender :string}\n' +
          '.match $gender\n' +
          'male   {{he}}\n' +
          'female {{she}}\n' +
          '*      {{they}}',
      },
    });

    expect(result.valid).toBe(true);
  });

  it.each(['en', 'es', 'uk', 'es-MX', 'pt-BR', 'zh-Hant'])(
    'accepts the well-formed BCP 47 locale %s',
    locale => {
      const result = validateCatalog({ locale, catalog: { hello: 'Hello' } });

      expect(result.diagnostics.filter(d => d.code === 'config.invalid-locale')).toEqual([]);
    },
  );
});

describe('validateCatalog: invalid catalogs', () => {
  it('reports a malformed locale', () => {
    const result = validateCatalog({ locale: 'en_US', catalog: { hello: 'Hello' } });

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain('config.invalid-locale');
  });

  it('reports a malformed catalog root', () => {
    const result = validateCatalog({ locale: 'en', catalog: null as unknown as never });

    expect(codes(result)).toEqual(['catalog.invalid-root']);
  });

  it('reports a number leaf', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: { count: 3 as unknown as string },
    });

    expect(result.diagnostics).toEqual([
      {
        code: 'catalog.invalid-leaf',
        severity: 'error',
        locale: 'en',
        key: 'count',
        message:
          '"count" is a number; message values must be strings or nested objects of strings.',
      },
    ]);
  });

  it('reports a boolean leaf', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: { enabled: true as unknown as string },
    });

    expect(codes(result)).toEqual(['catalog.invalid-leaf']);
  });

  it('reports a null leaf', () => {
    const result = validateCatalog({ locale: 'en', catalog: { name: null as unknown as string } });

    expect(result.diagnostics[0]?.message).toMatch(/is null/);
  });

  it('reports an array leaf', () => {
    const result = validateCatalog({ locale: 'en', catalog: { items: [] as unknown as string } });

    expect(result.diagnostics[0]?.message).toMatch(/is an array/);
  });

  it('reports a dotted key', () => {
    const result = validateCatalog({ locale: 'en', catalog: { 'nav.docs': 'Docs' } });

    expect(codes(result)).toEqual(['catalog.dotted-key']);
  });

  it('reports an empty string message', () => {
    const result = validateCatalog({ locale: 'en', catalog: { label: '' } });

    expect(codes(result)).toEqual(['message.empty']);
  });

  it('reports a whitespace-only message', () => {
    const result = validateCatalog({ locale: 'en', catalog: { label: '   ' } });

    expect(codes(result)).toEqual(['message.whitespace-only']);
  });

  it('reports invalid MessageFormat 2 syntax', () => {
    const result = validateCatalog({ locale: 'en', catalog: { broken: 'Hello {$name' } });

    expect(codes(result)).toEqual(['message.invalid-syntax']);
    expect(result.diagnostics[0]?.message).toMatch(/Invalid MessageFormat 2 syntax/);
  });

  it('reports a missing fallback variant', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: {
        count: '.input {$count :number}\n.match $count\none {{one item}}',
      },
    });

    expect(codes(result)).toEqual(['message.mf2-missing-fallback']);
  });

  it('reports a selector with no function annotation', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: {
        count: '.match $count\none {{one item}}\n*   {{many items}}',
      },
    });

    expect(codes(result)).toEqual(['message.mf2-missing-selector-annotation']);
  });

  it('reports a variant key count that does not match the selector count', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: {
        count:
          '.input {$count :number}\n.input {$other :string}\n.match $count $other\none {{one}}\n*   {{many}}',
      },
    });

    expect(codes(result)).toContain('message.mf2-key-mismatch');
  });

  it('does not stop after the first problem', () => {
    const result = validateCatalog({
      locale: 'en',
      catalog: {
        ok: 'fine',
        count: 3 as unknown as string,
        empty: '',
        broken: 'Hello {$name',
      },
    });

    expect(codes(result).sort()).toEqual(
      ['catalog.invalid-leaf', 'message.empty', 'message.invalid-syntax'].sort(),
    );
  });
});
