# @etyma/cli

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
  
  - `--remote <url-template>` replaces `{locale}` with each entry of `--locales`, fetches every catalog concurrently with Node's native `fetch`, and passes the parsed JSON to the same `validateCatalogs()` local mode uses. Diagnostics, pretty output, JSON output and exit codes are identical; no catalog semantic is reimplemented in the CLI, and `@etyma/tooling` is unchanged.
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
