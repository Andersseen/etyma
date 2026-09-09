# @etyma/analog

## 0.1.1

### Patch Changes

- [#35](https://github.com/Andersseen/etyma/pull/35) [`196d41f`](https://github.com/Andersseen/etyma/commit/196d41ff0d184f4bca26234bb88ae755095fb0ab) Thanks [@Andersseen](https://github.com/Andersseen)! - Transfer the active SSR locale together with loaded catalogs so hydrated Angular and Analog apps start in the server-rendered locale without a source-locale flash or duplicate catalog import.
- Updated dependencies [[`196d41f`](https://github.com/Andersseen/etyma/commit/196d41ff0d184f4bca26234bb88ae755095fb0ab)]:
  - @etyma/angular@0.1.1
  - @etyma/core@0.1.1

## 0.1.0

### Minor Changes

- First release.

  AnalogJS integration for Etyma: one page tree served under `/` and `/<locale>/`, URL
  locale activation before render so server output is already translated, hydration with no
  second catalog fetch and no flash of the source language, and localized `<head>` metadata
  for `lang`, `dir`, canonical, absolute `hreflang` and `x-default`.
