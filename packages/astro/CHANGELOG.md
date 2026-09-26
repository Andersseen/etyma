# @etyma/astro

## 0.2.0

### Minor Changes

- [#75](https://github.com/Andersseen/etyma/pull/75) [`7ce936b`](https://github.com/Andersseen/etyma/commit/7ce936be83a2e72e48efd97b7e666d3854c3a789) Thanks [@Andersseen](https://github.com/Andersseen)! - Astro 7 is now supported alongside Astro 6: the `astro` peer dependency is
  `^6.0.0 || ^7.0.0`.
  
  No API or behaviour change, and no Astro 7-specific code path - `@etyma/astro` still relies
  only on `Astro.currentLocale`, `Astro.url`, `Astro.isPrerendered` and `astro:i18n`'s URL
  helpers, which Astro 7 keeps unchanged. The package is still built against Astro 6, and the
  same static site is built from the packed package on both Astro 6.4.8 and Astro 7.3.5 (Vite 8),
  checking:
  
  - the `/ua` route rendering the `uk` language in `lang`, `hreflang` and `etyma.locale`;
  - localized paths (`etyma.path('/blog?tag=astro#latest', 'uk')` is
    `/ua/blog/?tag=astro#latest`), canonical, alternates and `x-default`;
  - prerendered pages loading each remote catalog once per locale for the whole build;
  - `@etyma/tooling/vite`'s `etymaRemoteContract` (one source request per build) and
    `etymaRemoteValidation` running under Astro 7's Vite 8;
  - `AstroI18nContext` still matching Astro 7's `APIContext` and `AstroGlobal` types, and
    `@etyma/astro` importing from plain Node without `astro:i18n`.

- [#72](https://github.com/Andersseen/etyma/pull/72) [`50c42b3`](https://github.com/Andersseen/etyma/commit/50c42b35dc80767d620333674ddc9cdc2821c37c) Thanks [@Andersseen](https://github.com/Andersseen)! - Prerendered pages now share loaded catalogs instead of loading them once per page.
  
  `createAstroI18n` used to build a fresh catalog registry for every render, so a static build
  with remote catalogs fetched the source catalog on every page and each secondary catalog on
  every page in that locale: the request count grew with the number of pages. When Astro reports
  a page as prerendered (`Astro.isPrerendered`), catalogs now load through one registry per
  `I18nDefinition`, shared by every prerendered page in the process. Each locale's catalog is
  loaded once per build, by the first page that needs it; pages prerendering concurrently share
  that one in-flight load, and a failed load is retried by the next page instead of being
  remembered.
  
  - **One build, one snapshot.** A catalog is not fetched again mid-build, so a remote catalog
    edited during generation cannot mix two translation revisions into one deploy.
  - **On-demand SSR is unchanged.** When `isPrerendered` is `false`, or absent, every call still
    loads into a registry of its own and nothing is shared between requests.
  - **Only catalog content is shared.** Locale, translator, paths and SEO data stay per render.
    Definitions are kept apart by object identity, not by `id`.
  - **In memory only**, for the life of the process: no disk cache and no expiry. A remote
    catalog edit appears in the next build. `astro dev` also reports prerendered pages as
    prerendered, so restart the dev server to pick up a remote edit.
  
  No API change: `AstroI18nContext` gains an optional `isPrerendered`, which Astro's own context
  always provides, so existing calls - `createAstroI18n(Astro, i18n)` - get this automatically
  and hand-built contexts keep compiling.
  
  Measured with `@etyma/astro`'s packed Astro 6 compatibility fixture (9 pages, 3 remote
  locales), render-time catalog requests went from 15 to 3; on a real 11-page site, from 17 to 3,
  with byte-identical output.

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
