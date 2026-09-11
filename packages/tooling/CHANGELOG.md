# @etyma/tooling

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
