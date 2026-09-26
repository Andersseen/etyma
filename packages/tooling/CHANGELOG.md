# @etyma/tooling

## 0.2.1

### Patch Changes

- [#74](https://github.com/Andersseen/etyma/pull/74) [`347e657`](https://github.com/Andersseen/etyma/commit/347e657ccdd47b5feb97a429c0122d7045912dbe) Thanks [@Andersseen](https://github.com/Andersseen)! - `etymaRemoteContract` now loads its source catalog once per plugin instance, as documented,
  instead of on every `buildStart`.
  
  Astro runs several Vite passes per `astro build` with the same plugin objects, and each pass
  called `buildStart` again, so one build fetched the source catalog (or called `load()`) three
  times and repeated its comparison and fallback warning. Every pass - including passes starting
  concurrently - now shares the first one's result:
  
  - **One acquisition.** The source URL is fetched, or `load()` called, once per plugin instance.
  - **One warning.** When the load fails and a generated contract already exists, the fallback
    warns once and keeps the file, however many passes follow.
  - **One failure.** When the load fails and there is no contract to fall back to, every pass of
    that build rejects with the same error instead of fetching again. The next build or
    dev-server start creates a new plugin instance and retries.
  
  Nothing is cached across plugin instances or processes, and the options are unchanged.
  `etymaRemoteValidation` already behaved this way and is unchanged.
  
  Measured with the packed Astro 6 compatibility fixture: source-catalog requests from
  `etymaRemoteContract` per `astro build` went from 3 to 1.

## 0.2.0

### Minor Changes

- [#69](https://github.com/Andersseen/etyma/pull/69) [`3023a86`](https://github.com/Andersseen/etyma/commit/3023a86f5ca7fc0db4cc2eb45cb1ada50f6fb751) Thanks [@Andersseen](https://github.com/Andersseen)! - `@etyma/tooling/vite` now exports `etymaRemoteValidation()`, which makes remote catalog correctness part of `vite build` / `vite dev` (and so `astro build` / `astro dev`).
  
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

## 0.1.0

### Minor Changes

- [#37](https://github.com/Andersseen/etyma/pull/37) [`219a7dd`](https://github.com/Andersseen/etyma/commit/219a7ddd08a724f998e9453659c66eda732f046e) Thanks [@Andersseen](https://github.com/Andersseen)! - First release.
  
  `@etyma/tooling` is Etyma's static catalog validator — a programmatic engine, not a CLI, for
  the checks a future `@etyma/cli`, an MCP tool, a Vite plugin and Forge CMS's editor can all
  build on instead of validating catalogs their own separate ways.
  
  - `validateCatalog(options)` — one catalog on its own: shape, empty and whitespace-only
    messages, and MessageFormat 2 syntax and data model, checked through the same
    `messageformat` reference implementation `@etyma/core` formats messages with.
  - `validateCatalogs(options)` — a source catalog and every locale's catalog, keyed by locale.
    Adds key parity against the source contract and external variable parity (declarations and
    selectors included, not only `{$placeholder}`), plus a best-effort warning when a shared
    variable's `:function` annotation differs between source and translation.
  
  Every problem comes back as a structured, deterministically ordered `CatalogDiagnostic` with
  a stable machine-readable `code` — never a thrown exception, never a boolean, and a run never
  stops at the first problem it finds.
  
  A development dependency: `@etyma/tooling` depends on `@etyma/core` and nothing else in the
  runtime trio depends on it. It has no filesystem access, no CLI, and does not scan source
  code for hardcoded copy or unused keys — see the package README for what is deliberately not
  in this first release.

- [#39](https://github.com/Andersseen/etyma/pull/39) [`bc323da`](https://github.com/Andersseen/etyma/commit/bc323da957475af6a22654715907f174a6a19ee6) Thanks [@Andersseen](https://github.com/Andersseen)! - Add remote message contract generation, for `@etyma/core`'s new `defineRemoteI18n` mode.
  
  - `extractContractKeys(source)` / `renderContractModule(keys)` — exported from the main entry
    point, pure and Node-free like the rest of this package. Extraction reuses `@etyma/core`'s
    own `flattenMessages`, so a malformed remote catalog is rejected exactly the same way a
    malformed local one is. Rendering is byte-stable for a given key set — no timestamp, no
    random id, no machine-specific path — so the file it produces is safe to commit and diffs
    only when the remote catalog's keys actually change.
  - `@etyma/tooling/vite` — a new subpath, kept separate from the main entry point because it's
    the one place in this package that touches the filesystem or the network. Exports
    `etymaRemoteContract({ source | load, output })`, a Vite plugin that generates the contract
    automatically as part of `vite dev` and `vite build`, before anything else needs the file.
    Fails loudly if the source is unreachable and no valid contract already exists; falls back
    to an existing one with a warning otherwise. Declared structurally rather than typed
    against `vite`'s own `Plugin` — this package still ships zero peer dependencies.

### Patch Changes

- Updated dependencies [[`bc323da`](https://github.com/Andersseen/etyma/commit/bc323da957475af6a22654715907f174a6a19ee6), [`219a7dd`](https://github.com/Andersseen/etyma/commit/219a7ddd08a724f998e9453659c66eda732f046e)]:
  - @etyma/core@0.2.0
