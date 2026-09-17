# @etyma/cli

The command-line entry point to [Etyma](https://github.com/Andersseen/etyma)'s catalog
validation engine: run `etyma validate` against local JSON catalogs, in CI or on your own
machine, without writing a script around `@etyma/tooling` yourself.

> **Alpha, and deliberately narrow.** This first release has exactly one substantial
> command. See [Non-goals](#non-goals) before assuming it does more.

## Why this is a separate package

`@etyma/cli` is an adapter, not a validator. Every catalog semantic - key parity, MessageFormat
2 syntax, external variable parity, locale well-formedness - is
[`@etyma/tooling`](../tooling)'s `validateCatalogs`, called once per run. This package's own
code is filesystem discovery, argument parsing and presentation:

```
@etyma/core
     ↑
@etyma/tooling
     ↑
  @etyma/cli
```

`@etyma/cli` depends on `@etyma/tooling` and nothing else from Etyma - not `@etyma/core`
directly, even though catalogs are structurally what `@etyma/core`'s `MessageSource` describes.
Enforced by ESLint (`no-restricted-imports`) and by `pnpm package:check` reading the packed
tarball's own `dependencies`, the same way the boundary between `@etyma/tooling` and
`@etyma/core` is enforced. `@etyma/cli` is Node-only development tooling: it does not belong in
an application's runtime bundle, and nothing in the runtime trio or in `@etyma/tooling` depends
on it.

## Install

```sh
pnpm add -D @etyma/cli
```

A dev dependency - install it globally instead if you want `etyma` on your `$PATH` outside any
one project:

```sh
pnpm add -g @etyma/cli
```

## `etyma validate`

```sh
etyma validate <directory> --source <locale> [--format pretty|json]
```

Validates every `*.json` file directly inside `<directory>` against `--source`'s catalog. The
common shape:

```
src/app/i18n/
  en.json
  es.json
  uk.json
```

Each file's locale comes from its filename, not its content: `en.json` -> `en`, `pt-BR.json` ->
`pt-BR`, `zh-Hant.json` -> `zh-Hant`. The directory is not scanned recursively, and a file that
isn't `*.json` - a README, a `.DS_Store` - is silently ignored.

```sh
etyma validate ./src/app/i18n --source en
```

### Options

| Option              | Required | Meaning                                                                  |
| ------------------- | -------- | ------------------------------------------------------------------------ |
| `--source <locale>` | Yes      | The source/contract locale. `<locale>.json` must exist in `<directory>`. |
| `--format <format>` | No       | `pretty` (default) or `json`.                                            |
| `-h, --help`        | No       | Show command help.                                                       |

### Pretty output

Success:

```
✓ 3 locales
✓ 765 messages
✓ Catalogs are valid
```

Failure - grouped by locale, one block per diagnostic:

```
ES

ERROR catalog.missing-key
docs.button.title
"docs.button.title" exists in the source locale "en" but has no translation in "es".

UK

ERROR message.missing-variable
footer.rights
Variable "year" is used in the source message but missing from the "uk" translation.

✗ 2 errors, 0 warnings
```

No ANSI colour in this release - see [Non-goals](#non-goals).

### JSON output

```sh
etyma validate ./src/app/i18n --source en --format json
```

`stdout` is exactly one JSON value in this mode, nothing else - safe to pipe into `jq` or a CI
step that parses it. It is `@etyma/tooling`'s own `CatalogValidationResult` (`valid` and
`diagnostics`, unchanged - not a second diagnostic contract) plus the execution metadata the
result itself doesn't carry:

```json
{
  "valid": false,
  "diagnostics": [
    {
      "code": "catalog.missing-key",
      "severity": "error",
      "locale": "es",
      "key": "docs.button.title",
      "message": "\"docs.button.title\" exists in the source locale \"en\" but has no translation in \"es\"."
    }
  ],
  "meta": {
    "command": "validate",
    "directory": "/abs/path/to/src/app/i18n",
    "sourceLocale": "en",
    "locales": ["en", "es", "uk"],
    "messageCount": 765
  }
}
```

See [`@etyma/tooling`'s README](../tooling#readme) for the full diagnostic code table.
An operational error - a bad directory, a missing source catalog, malformed JSON - is never
wrapped as JSON; it goes to `stderr` as plain text in either output format, because no catalog
was actually validated for it to describe.

### Exit codes

| Code | Meaning                                                                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | Catalogs are valid (no `error`-severity diagnostic).                                                                                                     |
| `1`  | Catalog validation ran and found at least one error. A warning alone does not fail this.                                                                 |
| `2`  | Usage, configuration or filesystem error: a bad directory, no `*.json` files found, `--source`'s catalog missing, malformed JSON, or a bad CLI argument. |

Malformed JSON is a `2`, not a `1`: a file that doesn't parse isn't a catalog yet, so it isn't a
catalog diagnostic - see [`@etyma/tooling`'s README](../tooling#readme) for why that boundary
matters.

## `etyma --version` / `etyma --help`

`--version` reports `@etyma/cli`'s own installed version, read from its `package.json` at run
time rather than hardcoded. `--help` (and `etyma validate --help`) print the usage summaries
above.

## Non-goals

Deliberately not in this first release - all of it either belongs to a future, separate
iteration or was never in scope:

- **No config file.** No `etyma.config.ts`, no per-project defaults. An explicit invocation -
  directory and `--source` on the command line - is the whole contract for now; see the
  changelog for why a config file is a separable problem.
- **No source-code scanning.** No unused-key detection, no hardcoded-copy detection, no reading
  Angular templates or application source at all.
- **No remote validation.** `etyma validate` reads local `*.json` files only.
  `@etyma/tooling/vite` already owns generating a contract from a remote catalog at build time;
  fetching a URL to validate it is a later CLI iteration.
- **No translation editing, pushing, pulling, or automatic translation.**
- **No MCP server, no CMS integration, no general plugin system.**
- **No colour**, to keep output stable for CI logs and tests without `NO_COLOR` handling.

One command, doing one thing, on top of the same validation engine `@etyma/tooling` already
ships - not a localization platform.

## Licence

[MIT](./LICENSE).
