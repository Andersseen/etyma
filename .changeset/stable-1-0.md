---
'@etyma/core': major
'@etyma/angular': major
'@etyma/analog': major
'@etyma/astro': major
'@etyma/tooling': major
'@etyma/cli': major
---

First stable release. The documented public API of every package is now covered by semantic
versioning: no breaking change before 2.0. There are no API changes in this release - 1.0 is a
stability promise, not a feature milestone.

What is stable:

- **Runtime** (`@etyma/core`): the typed MessageFormat 2 runtime - `defineI18n`,
  `defineRemoteI18n`, `defineMessages`, translators, loaders and the definition-first key utilities.
- **Adapters** (`@etyma/angular`, `@etyma/analog`, `@etyma/astro`): Angular 21/22, Analog 2.6/2.7
  and Astro 6/7, with SSR request isolation and hydration without a locale refetch.
- **Contracts**: `defineMessageContract({ keys, variables?, functions? })` and the generated
  contract format. New metadata arrives as new optional fields.
- **Tooling and CLI** (`@etyma/tooling`, `@etyma/cli`): catalog validation, remote catalogs,
  contract generation and `--check`, and static source analysis for JS/TS, Angular templates and
  Astro files. Diagnostic codes and severities are never renamed or re-graded within a major;
  minors may add codes. CLI exit codes: `0` success, `1` validation or staleness failure, `2` usage,
  configuration, I/O, network or generation failure.

Private files, internal representations and algorithms are not part of the promise. See
[V1.md](https://github.com/Andersseen/etyma/blob/main/V1.md) for the full list.
