# @etyma/cli

## 0.5.1

### Patch Changes

- Updated dependencies [[`4415fe5`](https://github.com/Andersseen/etyma/commit/4415fe5c3b8d1bf45cb4349aba554201d921fdee)]:
  - @etyma/tooling@0.6.0

## 0.5.0

### Minor Changes

- [#103](https://github.com/Andersseen/etyma/pull/103) [`0071bfd`](https://github.com/Andersseen/etyma/commit/0071bfde05083af477deb71b59cdcfe8af4e99ab) Thanks [@Andersseen](https://github.com/Andersseen)! - **Breaking:** `@etyma/cli` is the `etyma` binary only, with no importable entry point.
  `runCli`, `runValidateCommand`, `runContractCommand` and `CliResult` were undocumented and
  returned the same text the binary prints, never structured data. Call `@etyma/tooling`
  directly instead - `validateCatalogs()` for diagnostics, `extractContractKeys`,
  `extractContractParams` and `renderContractModule` for a contract module - or run `etyma`.
  
  `etyma contract` now generates the one-object `defineMessageContract({ keys, variables,
  functions })` form `@etyma/core` 0.5 requires; run it once to regenerate an existing contract
  (`--check` reports one that still uses the old form). Locales - in `--format json` output and
  in remote mode - are ordered by UTF-16 code unit rather than by the host's locale collation.

### Patch Changes

- Updated dependencies [[`0071bfd`](https://github.com/Andersseen/etyma/commit/0071bfde05083af477deb71b59cdcfe8af4e99ab)]:
  - @etyma/tooling@0.5.0

## 0.4.0

### Minor Changes

- [#90](https://github.com/Andersseen/etyma/pull/90) [`0648dfe`](https://github.com/Andersseen/etyma/commit/0648dfe005e4308a53b269825cd0aaf691e3bd4e) Thanks [@Andersseen](https://github.com/Andersseen)! - New `etyma contract <source.json> --output <file> --check` verifies a committed contract
  without writing anything - no file, directory, timestamp or cache. It renders the module
  exactly as the normal command does and compares it byte for byte with `<file>`:
  
  - `0` - the contract is up to date (same `✓ … is up to date` line as before);
  - `1` - it is missing or out of date, with the command that regenerates it;
  - `2` - usage, source (malformed JSON, invalid catalog shape, invalid MessageFormat 2) or
    filesystem error, including an output that exists but cannot be read.
  
  This catches the drift `defineI18n` cannot see at runtime because the keys did not change: a
  renamed variable (`{$name}` → `{$user}`), a changed, added or removed function annotation
  (`{$count :number}` → `{$count :datetime}`, even `:number` → `:integer`), or array metadata. Run
  it in CI next to `etyma validate`. Without `--check`, the command behaves exactly as before.
  
  `etyma contract --help` now also documents that the contract carries MF2 function metadata.

## 0.3.1

### Patch Changes

- [#88](https://github.com/Andersseen/etyma/pull/88) [`9983bb9`](https://github.com/Andersseen/etyma/commit/9983bb9e5f2eff785e7c6e6e4d2d5a2a0a0bacf5) Thanks [@Andersseen](https://github.com/Andersseen)! - `etyma contract` writes the functions each variable's value reaches as a third
  `defineMessageContract` argument, so `defineI18n({ source, contract })` narrows param values
  (`{$year :number}` → `number | bigint | string`) the way a `defineMessages()` source does. No new
  flag; regenerate and commit the contract. Still strict: invalid MessageFormat 2 writes nothing.
- Updated dependencies [[`9983bb9`](https://github.com/Andersseen/etyma/commit/9983bb9e5f2eff785e7c6e6e4d2d5a2a0a0bacf5)]:
  - @etyma/tooling@0.4.0

## 0.3.0

### Minor Changes

- [#87](https://github.com/Andersseen/etyma/pull/87) [`c429cb0`](https://github.com/Andersseen/etyma/commit/c429cb03d40bc7afcaa84c418480f98a08183c5d) Thanks [@Andersseen](https://github.com/Andersseen)! - New command: `etyma contract <source.json> --output <file>` generates the `defineMessageContract`
  module for a local JSON source catalog - its exact keys, array indexes included, and each
  message's MessageFormat 2 variable names, never its text. Pass it to `defineI18n` as `contract`
  to type `t()` params for a JSON source.
  
  It uses `@etyma/tooling`'s `extractContractKeys`, `extractContractVariables` and
  `renderContractModule`, so the module is byte-identical to what `etymaRemoteContract` generates
  for the same catalog. Output is deterministic and only written when its content changes;
  missing directories are created. Malformed JSON, an invalid catalog shape, or a source message
  that is not valid MessageFormat 2 exits 2 and writes nothing. It describes the source catalog
  only - other locales are still `etyma validate`'s job.
  
  `etyma --help` lists it, and `etyma contract --help` documents it. No configuration file.

### Patch Changes

- [#76](https://github.com/Andersseen/etyma/pull/76) [`0775ec1`](https://github.com/Andersseen/etyma/commit/0775ec1b70508c5067cc6cf91a16926e9c29d12f) Thanks [@Andersseen](https://github.com/Andersseen)! - `etyma validate` accepts catalogs with arrays of strings, locally and with `--remote`, through
  `@etyma/tooling`'s array support: a translated array with a missing or extra element is
  reported at that element's index. The summary counts each array element as one message.
- Updated dependencies [[`c75acfa`](https://github.com/Andersseen/etyma/commit/c75acfac36970edfc880c287ff661c60eddc712e), [`f8edbfe`](https://github.com/Andersseen/etyma/commit/f8edbfe75fcbabaa339c941226475f2cd008e141), [`347e657`](https://github.com/Andersseen/etyma/commit/347e657ccdd47b5feb97a429c0122d7045912dbe), [`0775ec1`](https://github.com/Andersseen/etyma/commit/0775ec1b70508c5067cc6cf91a16926e9c29d12f)]:
  - @etyma/tooling@0.3.0

## 0.2.0

### Minor Changes

- [#61](https://github.com/Andersseen/etyma/pull/61) [`2ed10b9`](https://github.com/Andersseen/etyma/commit/2ed10b92c2c3a751df532094184c7e9d458a8cb7) Thanks [@Andersseen](https://github.com/Andersseen)! - `etyma validate` can now validate remote catalogs.
  
  A project whose production catalogs live behind an HTTP endpoint - a CDN, a headless CMS, a translation platform - has no local `en.json` for `etyma validate <directory>` to read, and so lost key parity, MessageFormat 2 and external-variable checks unless it wrote its own download step. Remote mode closes that gap:
  
  ```sh
  etyma validate \
    --remote "https://cdn.example.com/i18n/{locale}.json" \
    --locales en,es,uk \
    --source en
  ```
  
  - `--remote <url-template>` replaces `{locale}` with each entry of `--locales`, fetches every catalog concurrently with Node's native `fetch`, and passes the parsed JSON to the same `validateCatalogs()` local mode uses. Diagnostics, pretty output, JSON output and exit codes are identical; no catalog semantic is reimplemented in the CLI, and remote mode needed no change to `@etyma/tooling`.
  - The two modes are explicit: `etyma validate <directory>` is exactly what 0.1 did, and a `<directory>` cannot be combined with `--remote`. Nothing is guessed from what a positional argument looks like.
  - Public `http:` / `https:` URLs only. `file:`, `data:` and other protocols, and URLs with embedded credentials, are usage errors. No auth options exist yet. Nothing fetched is written to disk.
  - Each request has its own timeout, 10 seconds by default, covering a body that stalls after the headers; `--timeout <ms>` overrides it.
  - A catalog that cannot be obtained - unreachable host, timeout, HTTP error status, a body that is not JSON - is exit code `2`, reported on `stderr` with the locale, URL and reason, and never with the response body. A catalog that is obtained and wrong is a diagnostic, exit code `1`, as in local mode.
  - The remote request is checked before anything is fetched: `{locale}` present, a valid `http(s)` URL, a non-empty `--locales` without repeated entries, and `--source` among them.
  
  `--format json` gains `meta.mode` (`"local"` or `"remote"`) and, in remote mode, `meta.remote` (the URL template as typed) in place of `meta.directory`. Nothing 0.1 emitted was renamed or removed.

### Patch Changes

- Updated dependencies [[`3023a86`](https://github.com/Andersseen/etyma/commit/3023a86f5ca7fc0db4cc2eb45cb1ada50f6fb751)]:
  - @etyma/tooling@0.2.0

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
