# @etyma/tooling

## 0.8.0

### Minor Changes

- [#136](https://github.com/Andersseen/etyma/pull/136) [`49c63ea`](https://github.com/Andersseen/etyma/commit/49c63eafda326fea33983c5afeb325eb34be1846) Thanks [@Andersseen](https://github.com/Andersseen)! - Add opt-in Astro `.astro` source analysis through `@etyma/tooling/astro` and `etyma analyze --astro`.

## 0.7.0

### Minor Changes

- [#133](https://github.com/Andersseen/etyma/pull/133) [`a9eb730`](https://github.com/Andersseen/etyma/commit/a9eb7301fbe1000b05ccd554d754773c3d055958) Thanks [@Andersseen](https://github.com/Andersseen)! - Add the optional `@etyma/tooling/angular` in-memory analyzer for statically provable Angular component template message usage, and add the opt-in `etyma analyze --angular` mode.

## 0.6.0

### Minor Changes

- [#129](https://github.com/Andersseen/etyma/pull/129) [`4415fe5`](https://github.com/Andersseen/etyma/commit/4415fe5c3b8d1bf45cb4349aba554201d921fdee) Thanks [@Andersseen](https://github.com/Andersseen)! - Add `@etyma/tooling/source`: static analysis of how JavaScript and TypeScript source uses
  message keys.
  
  ```ts
  import { analyzeMessageUsage } from '@etyma/tooling/source';
  
  const { used, unreferenced, diagnostics } = analyzeMessageUsage({
    keys: ['nav.home', 'nav.docs'],
    files: [{ path: 'src/nav.ts', source }],
  });
  ```
  
  - Recognises `injectT()` and `injectI18n()` from `@etyma/angular`, `createAstroI18n()` from
    `@etyma/astro` and `createTranslator()` from `@etyma/core` by following import bindings,
    aliases included. An unrelated `t()` is never counted.
  - `used` lists catalog keys referenced by a literal. A literal key the catalog lacks is a
    `source.unknown-key` error; a key that is not a literal is a `source.dynamic-key` warning; a
    syntax error is a `source.parse-error` rather than a thrown exception. Diagnostics carry
    `path`, `line` and `column`.
  - `unreferenced` lists keys not observed being referenced. They are candidates, not proof a key
    is safe to delete: templates, wrappers and dataflow are not analysed in this first version.
  - Pure and in memory, with deterministic output. It needs the TypeScript parser, so it is its
    own subpath and `typescript` is a new dependency; the main `@etyma/tooling` entry does not
    load it.
  
  JS/TS only. Angular templates, `.astro` files, wrappers and an `etyma analyze` command are not
  included.

### Patch Changes

- Updated dependencies [[`c45d5c5`](https://github.com/Andersseen/etyma/commit/c45d5c5877baf88f029387611b8b1e9a35602c50)]:
  - @etyma/core@0.6.0

## 0.5.0

### Minor Changes

- [#103](https://github.com/Andersseen/etyma/pull/103) [`0071bfd`](https://github.com/Andersseen/etyma/commit/0071bfde05083af477deb71b59cdcfe8af4e99ab) Thanks [@Andersseen](https://github.com/Andersseen)! - **Breaking:** `renderContractModule` takes one object, `{ keys, variables?, functions? }`
  (exported as `ContractModuleInput`), so `extractContractParams`' result spreads straight in:
  `renderContractModule({ keys, ...extractContractParams(source) })`. The module it renders - and
  so the one `etymaRemoteContract` writes - uses `@etyma/core`'s new one-object
  `defineMessageContract({ keys, variables, functions })` form, and requires `@etyma/core` 0.5.
  An empty variable or function list is now left out of the module instead of written as `[]`,
  which `defineMessageContract` would have rejected.
  
  Diagnostics, and the locales `etymaRemoteValidation` reports, are now ordered by UTF-16 code
  unit rather than with `localeCompare`, whose order depends on the host's default locale. The
  same catalogs now produce the same diagnostic order on every machine, as documented.

### Patch Changes

- Updated dependencies [[`0071bfd`](https://github.com/Andersseen/etyma/commit/0071bfde05083af477deb71b59cdcfe8af4e99ab)]:
  - @etyma/core@0.5.0

## 0.4.0

### Minor Changes

- [#88](https://github.com/Andersseen/etyma/pull/88) [`9983bb9`](https://github.com/Andersseen/etyma/commit/9983bb9e5f2eff785e7c6e6e4d2d5a2a0a0bacf5) Thanks [@Andersseen](https://github.com/Andersseen)! - Generated contracts now carry the MessageFormat 2 functions each variable's value reaches, so
  `@etyma/core` can type param values as well as names — for remote catalogs through
  `etymaRemoteContract`, and for local ones through `etyma contract`:
  
  ```ts
  export default defineMessageContract(
    ['footer.rights', 'welcome'] as const,
    { 'footer.rights': ['year'], welcome: ['name'] } as const,
    { 'footer.rights': { year: ['number'] } } as const,
  );
  ```
  
  - New `extractContractParams(source, options?)` returns `{ variables, functions }` from one
    parse per message; `extractContractVariables` is unchanged.
  - `renderContractModule(keys, variables?, functions?)` takes the functions as an optional third
    argument; without it, or with none to list, the output is byte-identical to before.
  - `MessageAnalysis` gains `parameterFunctions`: per external variable, the functions the caller's
    value reaches. An annotated `.input` is its variable's only evidence.
  
  Names are recorded raw, as the source wrote them — including custom functions and disagreeing
  annotations, which `@etyma/core` leaves broad. Invalid MessageFormat 2 is handled as before:
  tolerated (no entry) by `etymaRemoteContract`, rejected by `etyma contract`. Commit the
  regenerated contract; it changes wherever a source variable is annotated.

### Patch Changes

- Updated dependencies [[`9983bb9`](https://github.com/Andersseen/etyma/commit/9983bb9e5f2eff785e7c6e6e4d2d5a2a0a0bacf5)]:
  - @etyma/core@0.4.0

## 0.3.0

### Minor Changes

- [#87](https://github.com/Andersseen/etyma/pull/87) [`c75acfa`](https://github.com/Andersseen/etyma/commit/c75acfac36970edfc880c287ff661c60eddc712e) Thanks [@Andersseen](https://github.com/Andersseen)! - `extractContractVariables(source, { strict: true })` throws an `EtymaError` naming every source
  message that is not valid MessageFormat 2 syntax, instead of leaving it untyped. The default is
  unchanged, and is what `etymaRemoteContract` still uses; `etyma contract` uses `strict`. New
  type: `ExtractContractVariablesOptions`.
  
  The header of a generated contract no longer says it comes from a remote catalog, since the
  same module now also comes from a local one through `etyma contract`:
  
  ```ts
  // Generated by Etyma from a source message catalog. Do not edit.
  // Regenerate it with `etyma contract` (local JSON) or etymaRemoteContract (remote catalog).
  ```
  
  A committed contract generated by `etymaRemoteContract` changes by those two comment lines on
  the next `vite dev` or `vite build` - commit the regenerated file.

- [#76](https://github.com/Andersseen/etyma/pull/76) [`f8edbfe`](https://github.com/Andersseen/etyma/commit/f8edbfe75fcbabaa339c941226475f2cd008e141) Thanks [@Andersseen](https://github.com/Andersseen)! - `etymaRemoteContract` now writes each remote source message's MessageFormat 2 variables into
  the generated contract, so `t()` params are typed for remote catalogs as well as keys:
  
  ```ts
  export default defineMessageContract(
    ['footer.rights', 'nav.docs', 'welcome'] as const,
    { 'footer.rights': ['author', 'year'], welcome: ['name'] } as const,
  );
  ```
  
  Variables are read with the `messageformat` parser, through the same analysis variable parity
  uses. A message that is not valid MessageFormat 2 gets no entry and keeps untyped params;
  `etymaRemoteValidation` reports the syntax error. A catalog with no variables still renders
  the exact keys-only module, byte for byte.
  
  New `extractContractVariables(source)`; `renderContractModule(keys, variables?)` takes the
  variables as an optional second argument.
  
  A committed contract for a catalog with variables changes on the next `vite dev` or
  `vite build` - commit the regenerated file. Calls that omit a param the source message
  declares then fail to compile; they already rendered a `{$name}` fallback at runtime.

- [#76](https://github.com/Andersseen/etyma/pull/76) [`0775ec1`](https://github.com/Andersseen/etyma/commit/0775ec1b70508c5067cc6cf91a16926e9c29d12f) Thanks [@Andersseen](https://github.com/Andersseen)! - Validation and contract generation understand arrays of strings in catalogs, as `@etyma/core`
  now does. Each element is checked as the indexed key it flattens to, so the existing checks
  apply per element with no new rules: a translated array one element short is
  `catalog.missing-key` for the last index (`features.2`), one element long is
  `catalog.extra-key`, and MessageFormat 2 syntax and variable parity are checked per element
  (`message.missing-variable` at `rows.0`). `etymaRemoteContract` writes the exact indexes of a
  remote source catalog's arrays into the generated contract, sorted like every other key.
  
  - New diagnostic `catalog.empty-array`, keyed by the array, for an array with no elements.
  - A non-string array element - an object, a nested array, a number - is
    `catalog.invalid-leaf` keyed by the element's own index (`features.1`), not by the array.
  - `catalog.invalid-leaf` no longer fires for a non-empty array of strings.

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
- Updated dependencies [[`f8edbfe`](https://github.com/Andersseen/etyma/commit/f8edbfe75fcbabaa339c941226475f2cd008e141), [`8d1a1a2`](https://github.com/Andersseen/etyma/commit/8d1a1a2751d21f8fa8343760f915ec57299dd473), [`0775ec1`](https://github.com/Andersseen/etyma/commit/0775ec1b70508c5067cc6cf91a16926e9c29d12f), [`1d8bf9e`](https://github.com/Andersseen/etyma/commit/1d8bf9e02d92ea25361ed44e76330d50b9a5c8df)]:
  - @etyma/core@0.3.0

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
