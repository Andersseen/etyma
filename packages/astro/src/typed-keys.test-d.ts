import { describe, expectTypeOf, it } from 'vitest';
import { defineI18n, defineMessages } from '@etyma/core';

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

    expectTypeOf(etyma).toEqualTypeOf<AstroI18n<'home.title' | 'footer.rights'>>();

    etyma.t('home.title');
    etyma.parts('footer.rights', { year: 2026 });
    etyma.has('home.title');

    // @ts-expect-error - the source catalog has no `home.titel`.
    etyma.t('home.titel');
    // @ts-expect-error - `nav` was never a key in this catalog at all.
    etyma.t('nav.docs');
  });

  it('leaves keys as plain strings when the definition is untyped', () => {
    expectTypeOf<AstroI18n['t']>().parameter(0).toEqualTypeOf<string>();
  });
});
