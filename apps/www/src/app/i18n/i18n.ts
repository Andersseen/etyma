import { defineI18n } from '@etyma/core';

import en from './en.json';
import contract from './etyma.generated';

/**
 * The application's i18n definition.
 *
 * `en.json` is the whole source catalog: its *value* is what a half-translated page falls
 * back to, and `contract` - generated from it by `etyma contract`, committed, and checked for
 * freshness in CI - is where exact keys and each message's param types come from. Regenerate
 * it after editing `en.json` with `pnpm --filter @etyma/www run i18n:contract`.
 *
 * The playground composes its source with `defineMessages` and has no generated contract;
 * the two apps deliberately cover both ways of authoring a source catalog.
 *
 * Spanish and Ukrainian are behind dynamic imports, so neither reaches the initial bundle -
 * see `localeChunk` in `vite.config.ts`, which is what lets the end-to-end suite check that.
 */
export const i18n = defineI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  source: en,
  contract,
  loaders: {
    es: () => import('./es.json'),
    uk: () => import('./uk.json'),
  },
});
