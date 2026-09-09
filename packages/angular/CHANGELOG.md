# @etyma/angular

## 0.1.1

### Patch Changes

- [#35](https://github.com/Andersseen/etyma/pull/35) [`196d41f`](https://github.com/Andersseen/etyma/commit/196d41ff0d184f4bca26234bb88ae755095fb0ab) Thanks [@Andersseen](https://github.com/Andersseen)! - Transfer the active SSR locale together with loaded catalogs so hydrated Angular and Analog apps start in the server-rendered locale without a source-locale flash or duplicate catalog import.
- Updated dependencies [[`196d41f`](https://github.com/Andersseen/etyma/commit/196d41ff0d184f4bca26234bb88ae755095fb0ab)]:
  - @etyma/core@0.1.1

## 0.1.0

### Minor Changes

- First release.

  Signal-native Angular bindings for Etyma: `provideEtyma`, `injectI18n`, `injectT`, a
  `locale` signal that `t()` reads, lazy catalog loading with request-scoped state, and
  server-to-browser catalog transfer. Zoneless-first; nothing requires Zone.js.
