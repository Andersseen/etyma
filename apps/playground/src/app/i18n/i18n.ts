import { defineI18n, defineMessages } from '@etyma/core';

import en from './en.json';

/**
 * The same catalog, authored in TypeScript instead of JSON.
 *
 * Here to prove the two authoring styles are one runtime: this object is spread into the
 * source catalog and comes out the other side indistinguishable from the keys that came
 * from `en.json`. Spanish and Ukrainian translate these keys in their own JSON files.
 */
const seo = defineMessages({
  siteName: 'Etyma playground',
  tagline: 'Internationalization for Angular and AnalogJS',
});

/**
 * The application's i18n contract.
 *
 * `en.json` is imported statically because its *type* is where typed keys come from and its
 * *value* is what a half-translated page falls back to. Spanish and Ukrainian are behind
 * dynamic imports, so neither reaches the initial bundle - see `localeChunk` in
 * `vite.config.ts`, which is what lets the end-to-end suite check that.
 */
export const i18n = defineI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  source: { ...en, seo },
  loaders: {
    es: () => import('./es.json'),
    uk: () => import('./uk.json'),
  },
});

/** Every message key the source catalog defines. */
export type MessageId = (typeof i18n.keys)[number];
