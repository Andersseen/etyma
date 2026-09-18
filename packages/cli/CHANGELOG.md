# @etyma/cli

## 0.1.0

### Minor Changes

- [#54](https://github.com/Andersseen/etyma/pull/54) [`9031c3d`](https://github.com/Andersseen/etyma/commit/9031c3d72ee4e83e244e0bcc640179814382a91a) Thanks [@Andersseen](https://github.com/Andersseen)! - First release.
  
  `@etyma/cli` exposes `@etyma/tooling`'s catalog validation engine as a command-line workflow.
  This first release is deliberately narrow: one command, on top of the checks Etyma already
  ships.
  
  - `etyma validate <directory> --source <locale>` — discovers every `*.json` file directly
    inside `directory`, derives each one's locale from its filename (`en.json` -> `"en"`,
    `pt-BR.json` -> `"pt-BR"`), and validates the set against `@etyma/tooling`'s
    `validateCatalogs` — the same key parity, MessageFormat 2 syntax and external variable
    checks `@etyma/tooling` already does. No catalog semantic is reimplemented here.
  - `--format pretty` (default) prints a human-readable summary, grouped by locale.
    `--format json` prints `@etyma/tooling`'s own `CatalogValidationResult` plus execution
    metadata, and nothing else, on stdout — safe for CI and future tooling to parse.
  - Exit codes: `0` valid, `1` catalog validation found errors, `2` a usage, configuration or
    filesystem problem (a bad directory, a missing source catalog, malformed JSON). Malformed
    JSON is reported as a CLI input error, not a catalog diagnostic, since no catalog exists yet
    to validate.
  - `etyma --version` and `etyma --help` / `etyma validate --help`.
  
  A development dependency: `@etyma/cli` depends on `@etyma/tooling` only, never on
  `@etyma/core` directly, and nothing in the runtime trio or in `@etyma/tooling` depends on it —
  see the package README for the full dependency graph and non-goals (no config file, no
  source-code scanning, no remote validation, no translation editing, no MCP or CMS
  integration yet).
