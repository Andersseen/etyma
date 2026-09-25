import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { etymaRemoteValidation } from '@etyma/tooling/vite';
import { defineConfig } from 'astro/config';

// Every request the catalog server below has answered, by consumer and locale.
const requests = { tooling: {}, render: {} };

// Stands in for a CDN or translation platform: serves this fixture's own catalogs over HTTP on
// a random loopback port, so a real `astro build` fetches remote catalogs without the
// compatibility check ever touching the public internet. `unref` lets the process exit once
// Astro is done.
//
// Two URL prefixes for the same files, so the two consumers are counted apart:
// `etymaRemoteValidation` fetches `/i18n/...`, and the pages' own `@etyma/astro` loaders fetch
// `/render/...`. Only the second is what `@etyma/astro`'s prerender reuse is about.
const catalogs = createServer((request, response) => {
  const match = /^\/(i18n|render)\/([\w-]+)\.json$/.exec(request.url ?? '');

  if (match === null) {
    response.writeHead(404).end();
    return;
  }

  const [, prefix, locale] = match;
  const bucket = requests[prefix === 'i18n' ? 'tooling' : 'render'];
  bucket[locale] = (bucket[locale] ?? 0) + 1;

  try {
    const body = readFileSync(new URL(`./src/i18n/${locale}.json`, import.meta.url), 'utf8');
    response.writeHead(200, { 'content-type': 'application/json' }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => catalogs.listen(0, '127.0.0.1', resolve));
catalogs.unref();

const origin = `http://127.0.0.1:${catalogs.address().port}`;

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
  // Several pages prerender at once, so catalog loads that are merely sequential-safe (and not
  // actually shared between concurrent renders) would show up as extra requests.
  build: { concurrency: 4 },
  integrations: [
    {
      name: 'etyma-compat-catalog-requests',
      hooks: {
        // Read back by `tools/scripts/verify-astro-fixture.mjs`.
        'astro:build:done': () => {
          writeFileSync(
            new URL('./catalog-requests.json', import.meta.url),
            `${JSON.stringify(requests, null, 2)}\n`,
          );
        },
      },
    },
  ],
  vite: {
    define: {
      __ETYMA_COMPAT_CATALOGS__: JSON.stringify(`${origin}/render`),
    },
    plugins: [
      // `@etyma/tooling/vite` declared where an Astro 6 site declares any Vite plugin: the
      // build fails if a remote catalog cannot be fetched or does not validate.
      etymaRemoteValidation({
        remote: `${origin}/i18n/{locale}.json`,
        locales: ['es', 'en', 'uk'],
        sourceLocale: 'es',
      }),
    ],
  },
});
