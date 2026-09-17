import { defineConfig } from 'astro/config';

// The one intentional twist this fixture exists to prove: the Ukrainian route is served at
// "/ua", but its language code is "uk" - a route path that is not a BCP 47 language code.
// `@etyma/astro` must resolve the language ("uk"), not the path ("ua"), everywhere it
// matters: `Astro.currentLocale`, `etyma.locale`, `etyma.seo().lang` and every `hreflang`.
export default defineConfig({
  site: 'https://example.com',
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en', { path: 'ua', codes: ['uk'] }],
  },
});
