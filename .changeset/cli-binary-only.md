---
'@etyma/cli': minor
---

**Breaking:** `@etyma/cli` is the `etyma` binary only, with no importable entry point.
`runCli`, `runValidateCommand`, `runContractCommand` and `CliResult` were undocumented and
returned the same text the binary prints, never structured data. Call `@etyma/tooling`
directly instead - `validateCatalogs()` for diagnostics, `extractContractKeys`,
`extractContractParams` and `renderContractModule` for a contract module - or run `etyma`.

`etyma contract` now generates the one-object `defineMessageContract({ keys, variables,
functions })` form `@etyma/core` 0.5 requires; run it once to regenerate an existing contract
(`--check` reports one that still uses the old form). Locales - in `--format json` output and
in remote mode - are ordered by UTF-16 code unit rather than by the host's locale collation.
