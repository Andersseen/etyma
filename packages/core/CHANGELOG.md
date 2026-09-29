# @etyma/core

## 0.4.0

### Minor Changes

- [#88](https://github.com/Andersseen/etyma/pull/88) [`9983bb9`](https://github.com/Andersseen/etyma/commit/9983bb9e5f2eff785e7c6e6e4d2d5a2a0a0bacf5) Thanks [@Andersseen](https://github.com/Andersseen)! - `t()` and `parts()` now narrow a param's _value_ type when a built-in MessageFormat 2 function
  proves it, from a literal `defineMessages()` source or a generated contract:
  
  ```ts
  const source = defineMessages({ total: 'Total: {$count :number}', updated: '{$when :datetime}' });
  
  t('total', { count: 12 }); // ok — also 12n or '12'
  t('total', { count: new Date() }); // now a compile error
  t('updated', { when: new Date() }); // ok — also epoch ms or a date string
  ```
  
  - `:number`, `:integer`, `:offset`, `:currency`, `:percent` and `:unit` params are
    `NumericMessageParam` (`number | bigint | string`).
  - `:date`, `:time` and `:datetime` params are `DateTimeMessageParam` (`Date | number | string`).
  - A bare `{$name}`, `:string`, a custom function, a variable used only as an option value, and
    annotations that disagree all stay `MessageParamValue`. An annotated `.input` declaration types
    its variable; later uses do not change it.
  
  The types are semantic, deliberately stricter than `messageformat`'s coercion: its numeric
  functions would format a `Date` as epoch milliseconds, and Etyma rejects it. They are not a
  runtime validator — `'hello'` still type-checks for `:number` and is reported through `onIssue`.
  Runtime formatting is unchanged.
  
  `defineMessageContract` takes an optional third argument, the functions each variable's value
  reaches (`{ total: { count: ['number'] } }`), which `etyma contract` and `etymaRemoteContract`
  now generate. It is validated and frozen like `variables`; the one- and two-argument forms keep
  their meaning, and a contract without it types every listed param as `MessageParamValue`. When a
  `defineMessages()` literal and its `contract` narrow the same param to different types, the param
  becomes `never`, so the stale contract is a compile error. New exports: `NumericMessageParam`,
  `DateTimeMessageParam`, `MessageContractFunctions`; `MessageContractParams` takes an optional
  second type argument.
  
  **Possibly breaking at compile time:** a call that passes, say, a `Date` or a boolean to a
  `{$count :number}` param compiled before and fails now. That call never formatted as the message
  intended; pass the value the annotation expects.

## 0.3.0

### Minor Changes

- [#76](https://github.com/Andersseen/etyma/pull/76) [`f8edbfe`](https://github.com/Andersseen/etyma/commit/f8edbfe75fcbabaa339c941226475f2cd008e141) Thanks [@Andersseen](https://github.com/Andersseen)! - Remote definitions can type `t()`'s params too. `defineMessageContract` takes an optional
  second argument listing the external variables of the messages that have any:
  
  ```ts
  defineMessageContract(['nav.docs', 'welcome'] as const, { welcome: ['name'] } as const);
  ```
  
  `defineRemoteI18n` carries them to `t()` the way `defineI18n` does for a literal source:
  `t('welcome')` without `{ name }` is a compile error, and keys with no listed variables keep
  optional, untyped params. At runtime the contract gains a sorted, frozen `variables` record;
  variables for a key the contract does not list, an empty list, or a repeated name throw.
  A contract built with keys only is unchanged. New types: `MessageContractVariables`,
  `MessageContractParams`; `MessageContract` and `RemoteI18nOptions` take a defaulted `TParams`.

- [#87](https://github.com/Andersseen/etyma/pull/87) [`8d1a1a2`](https://github.com/Andersseen/etyma/commit/8d1a1a2751d21f8fa8343760f915ec57299dd473) Thanks [@Andersseen](https://github.com/Andersseen)! - `defineI18n` takes an optional `contract`, so a JSON source catalog can have typed `t()` params
  too. Generate it from the same file with `etyma contract` (`@etyma/cli`) and pass it next to
  `source`:
  
  ```ts
  import en from './en.json';
  import contract from './etyma.generated';
  
  export const i18n = defineI18n({
    locales: ['en', 'es'],
    sourceLocale: 'en',
    source: en,
    contract,
    loaders,
  });
  
  t('welcome', { name: 'Ada' }); // ok
  t('welcome'); // error: `name` is required
  ```
  
  It is the same `MessageContract` `defineRemoteI18n` reads. `source` stays the runtime catalog
  and fallback; the contract only adds types:
  
  - **Params** for the keys it lists variables for, merged with any a `defineMessages()` literal
    already declares - a literal and a disagreeing contract both apply, so a stale contract is a
    compile error rather than a silent pass.
  - **Exact keys.** `definition.keys` is typed by the contract's keys, which must be keys of
    the source type: an array from a `.json` import gets `'steps.0' | 'steps.1'` instead of
    `` `steps.${number}` ``.
  - **Key drift fails at definition time.** If the contract's keys are not exactly the source's,
    `defineI18n` throws an `EtymaError` listing the keys each side lacks, sorted. Variables are
    not re-checked at runtime - that would mean parsing every message - so regenerate the
    contract whenever the source changes.
  
  Without `contract`, nothing changes: typed keys, optional untyped params for a JSON source,
  and literal params for `defineMessages()`. `I18nOptions` gains two defaulted type parameters,
  `TKey` and `TParams`.

- [#76](https://github.com/Andersseen/etyma/pull/76) [`0775ec1`](https://github.com/Andersseen/etyma/commit/0775ec1b70508c5067cc6cf91a16926e9c29d12f) Thanks [@Andersseen](https://github.com/Andersseen)! - Catalogs can now contain arrays of strings. Each element is an ordinary message, keyed by its
  zero-based index:
  
  ```json
  { "onboarding": { "steps": ["Create an account", "Choose {$plan}", "Invite your team"] } }
  ```
  
  flattens to `onboarding.steps.0`, `onboarding.steps.1` and `onboarding.steps.2` - the same
  catalog numbered object keys (`{"0": …, "1": …}`) give. Translation stays one key at a time,
  `t('onboarding.steps.1', { plan: 'Pro' })`: there is no list-returning API. Fallback,
  MessageFormat 2, catalog snapshots and remote contract drift all see plain indexed keys, with
  no array-specific behaviour.
  
  - `MessageSource` values are now `string | MessageSource | readonly string[]`, exported as
    `MessageValue`. Loaders, `MessageModule` and `createHttpMessageLoader` accept the new shape
    unchanged.
  - `MessageKey` understands arrays. A tuple - what `defineMessages()` and `defineI18n()` infer
    for an array literal - gives exact keys (`'steps.0' | 'steps.1'`). An array from an imported
    `.json` file is typed `string[]` by TypeScript, with no known length, so its keys are
    `` `steps.${number}` ``: any index type-checks, and one past the end renders the
    missing-message fallback at runtime.
  - An array must be non-empty and hold only strings. An empty array is reported as the new
    `MessageSourceProblem` kind `'empty-array'`; a non-string element - a number, an object, a
    nested array, or a hole in a sparse array - is an `'invalid-leaf'` at its own indexed path
    (`steps.1`). `flattenMessages` and `defineI18n` throw for either. A catalog root that is an
    array is still `'invalid-root'`.
  
  Code that switches exhaustively over `MessageSourceProblem['kind']` needs a case for
  `'empty-array'`.

- [#76](https://github.com/Andersseen/etyma/pull/76) [`1d8bf9e`](https://github.com/Andersseen/etyma/commit/1d8bf9e02d92ea25361ed44e76330d50b9a5c8df) Thanks [@Andersseen](https://github.com/Andersseen)! - `t()` now checks params for messages whose text TypeScript knows. For a source catalog
  written with `defineMessages()` - or as an object literal passed to `defineI18n` - each
  message's MessageFormat 2 variables are read from its literal type, and `t()` requires
  exactly those:
  
  ```ts
  const source = defineMessages({ welcome: 'Hello, {$name}!', nav: { docs: 'Docs' } });
  
  t('welcome', { name: 'Ada' }); // ok
  t('welcome'); // error: `name` is required
  t('welcome', { nmae: 'Ada' }); // error
  t('nav.docs'); // ok: no variables, params stay optional
  ```
  
  Placeholders, `.input` declarations and variable option values (`=$digits`) count; names
  bound by `.local` do not. Array elements are typed per index. A key typed as a union needs
  the params of every member. Param values keep the existing `MessageParamValue` type.
  
  Messages typed as plain `string` - every message in an imported `.json` file - keep optional,
  untyped params unless a generated `MessageContract` lists their variables: `defineRemoteI18n`
  and, optionally, `defineI18n` take one (see the contract changesets).
  
  - `@etyma/core`: new types `MessageVariables`, `MessageParamsOf`, `MessageArgs`,
    `MessageParamsMap` and `MessageParamValue`. `I18nDefinition`, `Translator` and
    `createTranslator` take a second, defaulted type parameter, `TParams`; `defineI18n`
    infers it from `source`. The type-level reading is checked against the `messageformat`
    parser in `@etyma/tooling`'s tests.
  - `@etyma/angular`: `EtymaI18n`, `TranslateFn`, `injectI18n` and `injectT` carry `TParams`,
    so strict templates check params too. New `PartsFn` type for `parts`.
  - `@etyma/astro`: `AstroI18n` and `createAstroI18n` carry `TParams`.
  
  This can surface new compile errors in code that calls `t()` on a `defineMessages()` message
  without the params it declares. That call already rendered a `{$name}` fallback at runtime,
  so the error points at an existing bug.

## 0.2.0

### Minor Changes

- [#39](https://github.com/Andersseen/etyma/pull/39) [`bc323da`](https://github.com/Andersseen/etyma/commit/bc323da957475af6a22654715907f174a6a19ee6) Thanks [@Andersseen](https://github.com/Andersseen)! - Add a remote catalog mode: every locale, including the source locale, may now be loaded
  asynchronously — from a CDN, a headless CMS, or any HTTP endpoint — while `t()` keeps its
  precise, compile-time-checked keys.
  
  - `defineRemoteI18n(options)` — the remote counterpart to `defineI18n`. Every locale needs a
    loader, including the source locale (the inverse of `defineI18n`, where the source locale
    must not have one); the compile-time key contract comes from `contract` instead of a static
    `source` object.
  - `defineMessageContract(keys)` / `MessageContract<TKey>` — a message-key contract independent
    of any translation values, for a definition whose source catalog is not available
    statically. Typically generated by tooling from a remote catalog's shape, not written by
    hand.
  - `createHttpMessageLoader(url, init?)` — a small `fetch`-based `MessageLoader` for the common
    case of one JSON catalog per locale on a CDN or endpoint.
  - `I18nDefinition.sourceCatalog` is now `MessageCatalog | undefined`: present immediately in
    static mode, `undefined` until the source locale's own loader has run in remote mode.
    `defineI18n`'s own return type still narrows it back to non-optional, so existing static-mode
    code is unaffected.
  - `CatalogRegistry.load()` now guarantees the source locale is loaded before resolving a
    target locale's load, concurrently where both are remote — the fallback catalog a target
    locale relies on is never missing. In static mode, where the source is always already in
    memory, this is a no-op.
  - `CatalogRegistry.dehydrate()`/`hydrate()` now include and adopt the source locale exactly
    when it was itself loaded remotely, so a server-fetched remote source transfers to the
    browser instead of being fetched again on hydration. Static mode's source catalog is still
    left out of the transfer payload, since it ships in the bundle already.
  - `CatalogRegistryOptions.onContractDrift` — an optional, development-only callback reporting
    when a loaded remote source catalog's keys do not match its build-time contract.
  - `@etyma/angular`'s translator now reads its fallback catalog from the registry instead of
    from the frozen definition, and reports contract drift through `console.warn` in
    development. This is the only behavior-affecting change in this package — static-mode
    consumers see no change.
  
  Existing `defineI18n` consumers are unaffected: the static source catalog is still preloaded,
  still excluded from hydration, and target-locale loading is unchanged.

- [#37](https://github.com/Andersseen/etyma/pull/37) [`219a7dd`](https://github.com/Andersseen/etyma/commit/219a7ddd08a724f998e9453659c66eda732f046e) Thanks [@Andersseen](https://github.com/Andersseen)! - Export `walkMessageSource`, alongside its `MessageSourceLeaf` and `MessageSourceProblem`
  types: a non-throwing walk over a nested message catalog, reporting every leaf and every
  structural problem instead of throwing on the first one.
  
  It is the same tree-walk `flattenMessages` already used internally, now available directly.
  `flattenMessages` itself is unchanged — same behavior, same errors, same tests — this only
  exposes the tolerant primitive underneath it for a caller that wants to collect every
  problem in one pass, such as `@etyma/tooling`'s catalog validator.

## 0.1.1

### Patch Changes

- [#35](https://github.com/Andersseen/etyma/pull/35) [`196d41f`](https://github.com/Andersseen/etyma/commit/196d41ff0d184f4bca26234bb88ae755095fb0ab) Thanks [@Andersseen](https://github.com/Andersseen)! - Transfer the active SSR locale together with loaded catalogs so hydrated Angular and Analog apps start in the server-rendered locale without a source-locale flash or duplicate catalog import.

## 0.1.0

### Minor Changes

- First release.

  Portable i18n engine for Etyma: JSON catalogs and `defineMessages()` normalizing to one
  runtime, MessageFormat 2 formatting through the reference implementation, typed message
  keys inferred from the source catalog, source-locale fallback, locale-prefixed path
  helpers and async catalog loading. No framework, no DOM, no Node built-ins.
