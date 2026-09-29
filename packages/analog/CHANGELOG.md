# @etyma/analog

## 0.4.0

### Patch Changes

- Updated dependencies [[`9983bb9`](https://github.com/Andersseen/etyma/commit/9983bb9e5f2eff785e7c6e6e4d2d5a2a0a0bacf5)]:
  - @etyma/core@0.4.0
  - @etyma/angular@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [[`f8edbfe`](https://github.com/Andersseen/etyma/commit/f8edbfe75fcbabaa339c941226475f2cd008e141), [`8d1a1a2`](https://github.com/Andersseen/etyma/commit/8d1a1a2751d21f8fa8343760f915ec57299dd473), [`0775ec1`](https://github.com/Andersseen/etyma/commit/0775ec1b70508c5067cc6cf91a16926e9c29d12f), [`1d8bf9e`](https://github.com/Andersseen/etyma/commit/1d8bf9e02d92ea25361ed44e76330d50b9a5c8df)]:
  - @etyma/core@0.3.0
  - @etyma/angular@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [[`bc323da`](https://github.com/Andersseen/etyma/commit/bc323da957475af6a22654715907f174a6a19ee6), [`219a7dd`](https://github.com/Andersseen/etyma/commit/219a7ddd08a724f998e9453659c66eda732f046e)]:
  - @etyma/core@0.2.0
  - @etyma/angular@0.2.0

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
