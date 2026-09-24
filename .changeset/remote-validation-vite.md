---
'@etyma/tooling': minor
---

`@etyma/tooling/vite` now exports `etymaRemoteValidation()`, which makes remote catalog correctness part of `vite build` / `vite dev` (and so `astro build` / `astro dev`).

A project whose catalogs live behind an HTTP endpoint could already generate its typed key contract with `etymaRemoteContract()` and validate by hand with `etyma validate --remote`, but the production build itself had no guarantee that every remote catalog was valid. Now it does:

```ts
import { etymaRemoteContract, etymaRemoteValidation } from '@etyma/tooling/vite';

plugins: [
  etymaRemoteContract({ source: 'https://cdn.example.com/i18n/en.json', output: './src/i18n/etyma.generated.ts' }),
  etymaRemoteValidation({
    remote: 'https://cdn.example.com/i18n/{locale}.json',
    locales: ['en', 'es', 'uk'],
    sourceLocale: 'en',
  }),
],
```

- Every locale is fetched concurrently with the platform `fetch` (no new dependency), each request with its own timeout (`timeout`, 10 seconds by default, covering a stalled body), and the parsed catalogs go to the same `validateCatalogs()` the main entry exports. No catalog semantic is reimplemented, and no diagnostic code is new.
- `vite build` fails with one error listing every diagnostic, grouped by locale in the engine's deterministic order, when any error diagnostic is found - or when a catalog cannot be obtained (network error, timeout, HTTP error status, body that is not JSON), naming the locale, URL and reason and never the response body.
- `vite dev` validates once at server start and logs the same report as a warning instead of stopping the server. Nothing is polled or watched, and nothing is written to disk.
- Configuration is checked when the plugin is created, before any request: `{locale}` present, a non-empty `locales` array without repeated entries that includes `sourceLocale`, `http:`/`https:` URLs without credentials, and a valid `timeout`.
- No provider-specific behaviour and no authentication options.

`etymaRemoteContract()` and the main `@etyma/tooling` entry point are unchanged; the main entry still never fetches, reads files, touches `process` or logs.
