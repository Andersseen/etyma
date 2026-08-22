---
'@etyma/analog': patch
'@etyma/angular': patch
'@etyma/core': patch
---

First release.

Etyma is an internationalization toolkit for Angular 21+ and AnalogJS 2:

- **`@etyma/core`** — the portable engine. JSON catalogs and `defineMessages()` normalizing
  to one runtime, MessageFormat 2 formatting through the reference implementation, typed
  message keys inferred from the source catalog, source-locale fallback, locale-prefixed
  path helpers and an async catalog loader. No framework, no DOM, no Node built-ins.
- **`@etyma/angular`** — signal-native bindings. `provideEtyma`, `injectI18n`, `injectT`, a
  `locale` signal that `t()` reads, lazy catalog loading with request-scoped state, and
  server-to-browser catalog transfer. Zoneless-first; nothing requires Zone.js.
- **`@etyma/analog`** — the AnalogJS integration. One page tree served under `/` and
  `/<locale>/`, the locale resolved from the URL before anything renders so server output is
  already translated, hydration with no second catalog fetch and no flash of the source
  language, and a localized `<head>`: `lang`, `dir`, canonical, absolute `hreflang` and
  `x-default`, kept correct across client-side navigation.

Alpha. The API is small and tested, but it is new and it will change.
