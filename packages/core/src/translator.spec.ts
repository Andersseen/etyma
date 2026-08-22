import { describe, expect, it, vi } from 'vitest';

import { createMessageFormatter } from './format.js';
import { flattenMessages } from './messages.js';
import { createTranslator } from './translator.js';

const SOURCE = flattenMessages({
  nav: { docs: 'Docs' },
  footer: { rights: 'MIT licensed. {$year :number useGrouping=never}' },
  onlyEnglish: 'Not translated anywhere',
  count: [
    '.input {$count :number}',
    '.match $count',
    'one {{{$count} item}}',
    '*   {{{$count} items}}',
  ].join('\n'),
});

const SPANISH = flattenMessages({
  nav: { docs: 'Documentación' },
  footer: { rights: 'Licencia MIT. {$year :number useGrouping=never}' },
  count: [
    '.input {$count :number}',
    '.match $count',
    'one {{{$count} elemento}}',
    '*   {{{$count} elementos}}',
  ].join('\n'),
});

function translator(locale: string, catalog = SPANISH, onMissingMessage?: () => string) {
  return createTranslator({
    locale,
    catalog: locale === 'en' ? SOURCE : catalog,
    sourceLocale: 'en',
    sourceCatalog: SOURCE,
    formatter: createMessageFormatter(),
    ...(onMissingMessage ? { onMissingMessage } : {}),
  });
}

describe('createTranslator', () => {
  it('resolves a nested key in the active locale', () => {
    expect(translator('es').translate('nav.docs')).toBe('Documentación');
  });

  it('substitutes parameters', () => {
    expect(translator('es').translate('footer.rights', { year: 2026 })).toBe('Licencia MIT. 2026');
  });

  it('falls back to the source locale for a key the translation lacks', () => {
    expect(translator('es').translate('onlyEnglish')).toBe('Not translated anywhere');
  });

  it('formats a fallback message in the source locale, not the active one', () => {
    // Only English has `count`, and its pattern defines `one` and `*`. Formatting it with
    // Ukrainian plural rules would select `few` or `many`, which the pattern does not have.
    const ukrainian = createTranslator({
      locale: 'uk',
      catalog: flattenMessages({ nav: { docs: 'Документація' } }),
      sourceLocale: 'en',
      sourceCatalog: SOURCE,
      formatter: createMessageFormatter(),
    });

    expect(ukrainian.translate('count', { count: 3 })).toBe('3 items');
  });

  it('falls back when the whole catalog is still loading', () => {
    const loading = createTranslator({
      locale: 'es',
      catalog: undefined,
      sourceLocale: 'en',
      sourceCatalog: SOURCE,
      formatter: createMessageFormatter(),
    });

    expect(loading.translate('nav.docs')).toBe('Docs');
  });

  it('returns the key for a message that exists in no catalog', () => {
    expect(translator('es').translate('nav.missing')).toBe('nav.missing');
  });

  it('hands a missing key to the configured handler', () => {
    const onMissingMessage = vi.fn(() => '[missing]');

    expect(translator('es', SPANISH, onMissingMessage).translate('nav.missing')).toBe('[missing]');
    expect(onMissingMessage).toHaveBeenCalledWith({
      key: 'nav.missing',
      locale: 'es',
      sourceLocale: 'en',
    });
  });

  it('reports which keys resolve', () => {
    const spanish = translator('es');

    expect(spanish.has('nav.docs')).toBe(true);
    expect(spanish.has('onlyEnglish')).toBe(true);
    expect(spanish.has('nav.missing')).toBe(false);
  });

  it('keeps two locales isolated from one another', () => {
    expect(translator('en').translate('nav.docs')).toBe('Docs');
    expect(translator('es').translate('nav.docs')).toBe('Documentación');
    expect(translator('en').translate('nav.docs')).toBe('Docs');
  });

  it('returns a missing message as a single text part', () => {
    expect(translator('es').translateToParts('nav.missing')).toEqual([
      { type: 'text', value: 'nav.missing' },
    ]);
  });
});
