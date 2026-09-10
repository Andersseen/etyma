---
'@etyma/tooling': minor
---

First release.

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
