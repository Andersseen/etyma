# @etyma/astro

## 0.1.1

### Patch Changes

- [#59](https://github.com/Andersseen/etyma/pull/59) [`522b783`](https://github.com/Andersseen/etyma/commit/522b783fd51a0f8100dcc4616763d97b76aa67b5) Thanks [@Andersseen](https://github.com/Andersseen)! - Fix two bugs found while dogfooding this package in a real Astro 6 consumer before its first release:
  
  - `path()` no longer silently double-prefixes a path that already contains a locale segment (e.g. the current, already-prefixed `Astro.url.pathname`). It now throws a clear `EtymaError` explaining the mistake, and points at `seo().alternates` for the "current page in another locale" case, which already strips the current locale segment correctly.
  - The `astro:i18n` virtual module is now imported lazily, inside `createAstroI18n`'s body, instead of statically at module scope. Previously, merely importing anything from `@etyma/astro` — even just its exported types — threw outside Astro's own Vite pipeline, for example in a plain Vitest test.

## 0.1.0

### Minor Changes

- [#56](https://github.com/Andersseen/etyma/pull/56) [`f54a520`](https://github.com/Andersseen/etyma/commit/f54a52057f7635b99579e7b4540a3dc51c6d5aff) Thanks [@Andersseen](https://github.com/Andersseen)! - First release.
  
  `@etyma/astro` brings Etyma to Astro 6: typed translation keys, MessageFormat 2 and lazy
  catalog loading, built directly on Astro's own i18n routing rather than a second
  implementation of it.
  
  - `createAstroI18n(Astro, i18n)` builds one request/render-scoped translator from the
    locale Astro already resolved (`Astro.currentLocale`) - no signals, no Angular-style DI,
    no `TransferState`, no global mutable locale state. It works unchanged for a static
    `astro build` and for a server-rendered route.
  - `etyma.t()`, `etyma.parts()` and `etyma.has()` behave exactly like `@etyma/core`'s
    translator - same typed keys, same MessageFormat 2 semantics, same fallback rules.
  - `etyma.path(to, locale?)` localizes a path through `astro:i18n`'s own URL helpers,
    including a custom route path that is not the language code (a `uk` locale served at
    `/ua`, for example) and preserving query strings and fragments.
  - `etyma.seo()` returns canonical, `hreflang` alternates and `x-default` as data - keyed by
    the real BCP 47 language code, never the Astro route path a custom `{ path, codes }`
    locale happens to use. Nothing is rendered; a consumer's own layout decides how to emit
    the `<head>`.
  - Works with both `defineI18n` and `defineRemoteI18n` from `@etyma/core` unchanged - one
    adapter API for static and remote catalogs, not two.
  
  Depends only on `@etyma/core` and Astro `^6.0.0` as a peer dependency - never Angular,
  Analog or RxJS - and versions independently of the runtime trio: see the package README for
  the full non-goals list (no Astro integration plugin, no client-side locale store, no
  content-collection translation).
