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

// The same keys, variables and functions `etymaRemoteContract` generates into
// `contract.generated.ts` - `generated-contract-types.ts` checks the two type identically -
// written out so the pages do not depend on a file the build itself produces.
const contract = defineMessageContract(
  [
    'nav.blog',
    'home.title',
    'home.greeting',
    'footer.rights',
    'posts.count',
    'about.title',
    'about.body',
    'about.paragraphs.0',
    'about.paragraphs.1',
  ] as const,
  {
    'home.greeting': ['name'],
    'footer.rights': ['year'],
    'posts.count': ['count'],
    'about.body': ['topic'],
    'about.paragraphs.0': ['framework'],
    'about.paragraphs.1': ['author'],
  } as const,
  {
    'footer.rights': { year: ['number'] },
    'posts.count': { count: ['number'] },
  } as const,
);

const load = createHttpMessageLoader(locale => `${__ETYMA_COMPAT_CATALOGS__}/${locale}.json`);

export const i18n = defineRemoteI18n({
  locales: ['es', 'en', 'uk'],
  sourceLocale: 'es',
  contract,
  loaders: { es: load, en: load, uk: load },
});
