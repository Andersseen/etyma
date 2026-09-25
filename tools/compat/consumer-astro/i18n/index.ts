/**
 * A clean consumer of `@etyma/astro`, in the shape a real remote-catalog site uses: every
 * catalog, the source included, is fetched over HTTP while Astro prerenders. The Ukrainian
 * route is served at `/ua`, but its language code is `uk` - path and language code
 * deliberately differ.
 *
 * `astro.config.mjs` counts the requests these loaders make, so the build proves catalogs are
 * loaded once per locale, not once per page.
 */
import { createHttpMessageLoader, defineMessageContract, defineRemoteI18n } from '@etyma/core';

const contract = defineMessageContract([
  'nav.blog',
  'home.title',
  'home.greeting',
  'footer.rights',
  'posts.count',
  'about.title',
  'about.body',
] as const);

const load = createHttpMessageLoader(locale => `${__ETYMA_COMPAT_CATALOGS__}/${locale}.json`);

export const i18n = defineRemoteI18n({
  locales: ['es', 'en', 'uk'],
  sourceLocale: 'es',
  contract,
  loaders: { es: load, en: load, uk: load },
});
