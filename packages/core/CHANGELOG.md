# @etyma/core

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
