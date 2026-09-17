---
'@etyma/astro': minor
---

First release.

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
