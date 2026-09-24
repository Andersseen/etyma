import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { etymaRemoteValidation } from '@etyma/tooling/vite';
import { defineConfig } from 'astro/config';

// Stands in for a CDN or translation platform: serves this fixture's own catalogs over HTTP on
// a random loopback port, so `etymaRemoteValidation` runs a real fetch inside a real
// `astro build` without the compatibility check ever touching the public internet. `unref`
// lets the process exit once Astro is done.
const catalogs = createServer((request, response) => {
  const locale = /^\/i18n\/([\w-]+)\.json$/.exec(request.url ?? '')?.[1];

  try {
    const body = readFileSync(new URL(`./src/i18n/${locale}.json`, import.meta.url), 'utf8');
    response.writeHead(200, { 'content-type': 'application/json' }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => catalogs.listen(0, '127.0.0.1', resolve));
catalogs.unref();

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
  vite: {
    plugins: [
      // `@etyma/tooling/vite` declared where an Astro 6 site declares any Vite plugin: the
      // build fails if a remote catalog cannot be fetched or does not validate.
      etymaRemoteValidation({
        remote: `http://127.0.0.1:${catalogs.address().port}/i18n/{locale}.json`,
        locales: ['es', 'en', 'uk'],
        sourceLocale: 'es',
      }),
    ],
  },
});
