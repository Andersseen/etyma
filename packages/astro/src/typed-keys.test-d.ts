import type { APIContext } from 'astro';
import { describe, expectTypeOf, it } from 'vitest';
import { defineI18n, defineMessages, type NumericMessageParam } from '@etyma/core';

import { createAstroI18n } from './create-astro-i18n.js';
import type { AstroI18n, AstroI18nContext } from './types.js';

const source = defineMessages({
  home: { title: 'Inicio' },
  footer: { rights: 'Con licencia MIT. {$year :number useGrouping=never}' },
});

const definition = defineI18n({
  locales: ['es', 'en'],
  sourceLocale: 'es',
  source,
  loaders: { en: () => ({ home: { title: 'Home' }, footer: { rights: 'MIT licensed.' } }) },
});

declare const astro: AstroI18nContext;

describe('AstroI18n typed keys', () => {
  it('types t(), parts() and has() against the source catalog', async () => {
    const etyma = await createAstroI18n(astro, definition);

    expectTypeOf(etyma).toEqualTypeOf<
      AstroI18n<
        'home.title' | 'footer.rights',
        { 'footer.rights': { readonly year: NumericMessageParam } }
      >
    >();

    etyma.t('home.title');
    etyma.parts('footer.rights', { year: 2026 });
    etyma.has('home.title');

    // @ts-expect-error - the source catalog has no `home.titel`.
    etyma.t('home.titel');
    // @ts-expect-error - `nav` was never a key in this catalog at all.
    etyma.t('nav.docs');
  });

  it('requires the params a literal source message declares', async () => {
    const etyma = await createAstroI18n(astro, definition);

    etyma.t('footer.rights', { year: 2026 });

    // @ts-expect-error - `footer.rights` needs `year`.
    etyma.t('footer.rights');
    // @ts-expect-error - and nothing but `year`.
    etyma.parts('footer.rights', { year: 2026, month: 9 });
  });

  it('narrows a param value by its built-in function, for t() and parts()', async () => {
    const etyma = await createAstroI18n(astro, definition);

    etyma.t('footer.rights', { year: 2026n });
    etyma.parts('footer.rights', { year: '2026' });

    // @ts-expect-error - `{$year :number}` does not take a Date.
    etyma.t('footer.rights', { year: new Date() });
    // @ts-expect-error - nor a boolean.
    etyma.parts('footer.rights', { year: true });
  });

  it('leaves keys as plain strings when the definition is untyped', () => {
    expectTypeOf<AstroI18n['t']>().parameter(0).toEqualTypeOf<string>();
  });
});

describe('AstroI18nContext', () => {
  it("accepts Astro's own context, which always says whether the page is prerendered", () => {
    expectTypeOf<APIContext>().toExtend<AstroI18nContext>();
  });

  it('still accepts a hand-built context without isPrerendered', () => {
    expectTypeOf({
      currentLocale: 'es',
      url: new URL('https://example.com/'),
    }).toExtend<AstroI18nContext>();
    expectTypeOf<AstroI18nContext['isPrerendered']>().toEqualTypeOf<boolean | undefined>();
  });
});
