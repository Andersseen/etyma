# @etyma/cli

The command-line entry point to [Etyma](https://github.com/Andersseen/etyma)'s catalog
tooling: run `etyma validate` against local JSON catalogs, or against public catalogs served
over HTTP, and `etyma contract` to generate typed `t()` params for a local JSON source - in CI
or on your own machine, without writing a script around `@etyma/tooling` yourself.

> **Pre-1.0, and deliberately narrow.** Two explicit commands, no configuration file. See
> [Non-goals](#non-goals) before assuming it does more.

## Why this is a separate package

`@etyma/cli` is an adapter, not a validator. Every catalog semantic - key parity, MessageFormat
2 syntax, external variable parity, locale well-formedness - is
[`@etyma/tooling`](../tooling)'s `validateCatalogs`, called once per run, and every contract
semantic is `@etyma/tooling`'s contract functions. This package's own code is getting catalogs
in - from a directory, a file or over HTTP - writing a generated contract out, plus argument
parsing and presentation:

```
  local directory        remote {locale} URL template
        └──────────┬──────────────┘
              @etyma/cli            input adapter, output formatter
                   ↓
             @etyma/tooling         validateCatalogs()  -  the only place catalog semantics live
                   ↓
              @etyma/core
```

The two inputs are the whole design. A remote run is fetch, parse, validate, discard: the same
diagnostics, the same output, the same exit codes as a local one, and `@etyma/tooling` itself
still never touches a filesystem or a network.

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

Two explicit modes. Which one you are in is decided by `--remote`, never by guessing what a
positional string looks like.

```sh
# Local: a directory of <locale>.json files
etyma validate <directory> --source <locale> [--format pretty|json]

# Remote: one public HTTP(S) catalog per locale
etyma validate --remote <url-template> --locales <list> --source <locale> \
               [--format pretty|json] [--timeout <ms>]
```

### Local mode

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

### Remote mode

For a project whose catalogs live in a CDN, a headless CMS or any other endpoint that serves
ordinary JSON - the case where there is no local `en.json` for local mode to read:

```sh
etyma validate \
  --remote "https://cdn.example.com/i18n/{locale}.json" \
  --locales en,es,uk \
  --source en
```

`{locale}` is replaced with each entry of `--locales`, so this fetches
`https://cdn.example.com/i18n/en.json`, `.../es.json` and `.../uk.json`, concurrently, parses
each response as JSON, and hands the result to the same validation local mode uses. Quote the
URL - a `?` or `&` in it is otherwise the shell's business.

A real-world example, not a special case: [Glossa](https://glossa.andersseen.dev) exposes each
project's catalogs as plain JSON over HTTP, so nothing Glossa-specific is needed:

```sh
etyma validate \
  --remote "https://glossa.andersseen.dev/i18n/my-blog/{locale}.json" \
  --locales es,en,uk --source es
```

What remote mode is, and is not:

- **Public HTTP(S) only.** The URL must be `https:` or `http:`. `file:`, `data:`, `javascript:`
  and anything else is a usage error, and so is a URL with `user:password@` in it. There is no
  `--header`, token, cookie or other credential option in this release; a URL is printed in
  errors and in the JSON output, so do not put a secret in one.
- **Nothing is written.** No cache, no download directory, no lock file. The catalogs are
  fetched, parsed, validated and discarded. Response bodies are parsed as JSON _data_ - never
  evaluated, never imported as a module.
- **Plain `fetch`, no extra headers**, following ordinary redirects: the same request Etyma's
  own `createHttpMessageLoader` makes at runtime, so you validate what your application will
  actually receive.
- **Checked before anything is fetched.** `--remote` must contain `{locale}` and be a valid
  `http(s)` URL; `--locales` must be a non-empty, comma-separated list with no repeated entry;
  `--source` must be one of them. Any of these failing is exit `2` with no request made.
  Whether a tag is a well-formed BCP 47 locale (`en_us` is not), or is the same tag as another
  once canonicalized (`en-US` / `en-us`), is not re-checked here: it is `@etyma/tooling`'s
  `config.invalid-locale` / `config.duplicate-locale`, reported exactly as they are for local
  files.

#### Remote mode, Vite builds and your project's values

A Vite or Astro project can run the same check inside `vite build` with `@etyma/tooling/vite`'s
`etymaRemoteValidation`. The two are not alternatives: the build validates what it is about to
ship, and a CI job running `etyma validate --remote` - on pull requests, or on a schedule - can
catch a catalog that changed remotely between deploys.

The CLI takes the remote template, locales and source locale as arguments, every time. It does
not read your application's code, so a TypeScript constant that feeds `defineRemoteI18n` and
the Vite plugins (the
[recommended setup](../tooling#recommended-setup-for-a-remote-catalog-project)) does not
configure it. Those values are therefore written a second time, usually in one
`package.json` script. That is a known, accepted duplication in this release, not an
oversight - see [Non-goals](#non-goals).

#### Timeout

Every catalog request has its own timeout, **10 seconds by default**, covering the whole
response including a body that stalls after the headers arrive - a dead translation host fails
the job instead of hanging CI. `--timeout <ms>` changes it (a whole number of milliseconds,
`1` to `2147483647`). Requests run concurrently, so `--timeout` is also roughly the longest a
run can take.

#### Remote errors are not catalog diagnostics

The exit code says which of two things happened:

- A catalog could not be **obtained** - the host is unreachable, the request timed out, the
  server answered `404` or `500`, or the body is not JSON. Validation cannot meaningfully run,
  so this is exit `2`, printed as plain text on `stderr`, and names each failing locale, its
  URL and the reason:

  ```
  etyma validate: Could not load 2 of 3 remote catalog(s):
    es (https://cdn.example.com/i18n/es.json): HTTP 404 Not Found
    uk (https://cdn.example.com/i18n/uk.json): timed out after 10000ms
  ```

  Response bodies are never printed - an HTML error page is summarized, not echoed
  (`response is not valid JSON [text/html] (starts with "<")`).

- A catalog was obtained and is **wrong** - a missing or extra key, invalid MessageFormat 2, a
  variable a translation dropped or invented, a value that is not a message. That is a
  diagnostic, exit `1`, exactly as in local mode.

### Options

| Option              | Mode   | Required | Meaning                                                                                           |
| ------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------- |
| `<directory>`       | Local  | Yes      | Directory of `<locale>.json` files.                                                               |
| `--remote <url>`    | Remote | Yes      | URL template containing `{locale}`. `http:` or `https:` only, no credentials.                     |
| `--locales <list>`  | Remote | Yes      | Comma-separated locales to fetch, e.g. `en,es,uk`.                                                |
| `--source <locale>` | Both   | Yes      | The source/contract locale. Local: `<locale>.json` must exist. Remote: it must be in `--locales`. |
| `--format <format>` | Both   | No       | `pretty` (default) or `json`.                                                                     |
| `--timeout <ms>`    | Remote | No       | Per-catalog request timeout. Default `10000`.                                                     |
| `-h, --help`        | Both   | No       | Show command help.                                                                                |

`<directory>` cannot be combined with `--remote`, and `--locales` / `--timeout` require
`--remote`.

### Pretty output

Success - identical in both modes:

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
etyma validate --remote "https://cdn.example.com/i18n/{locale}.json" --locales en,es,uk --source en --format json
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
    "mode": "local",
    "directory": "/abs/path/to/src/app/i18n",
    "sourceLocale": "en",
    "locales": ["en", "es", "uk"],
    "messageCount": 765
  }
}
```

In remote mode `meta` has `"mode": "remote"` and `"remote"` - the URL template exactly as you
typed it - in place of `"directory"`:

```json
"meta": {
  "command": "validate",
  "mode": "remote",
  "remote": "https://cdn.example.com/i18n/{locale}.json",
  "sourceLocale": "en",
  "locales": ["en", "es", "uk"],
  "messageCount": 765
}
```

`mode` was added in 0.2.0; nothing 0.1 emitted was renamed or removed. `locales` is sorted, so
it does not depend on the order you typed `--locales` in.

See [`@etyma/tooling`'s README](../tooling#readme) for the full diagnostic code table.
An operational error - a bad directory, a missing source catalog, malformed JSON, an
unreachable remote - is never wrapped as JSON; it goes to `stderr` as plain text in either
output format, because no catalog was actually validated for it to describe.

### Exit codes

| Code | Meaning                                                                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | Catalogs are valid (no `error`-severity diagnostic).                                                                                                                                                       |
| `1`  | Catalog validation ran and found at least one error. A warning alone does not fail this.                                                                                                                   |
| `2`  | Validation did not run: a usage or configuration error, a filesystem error, or - in remote mode - a network failure, timeout, HTTP error status or non-JSON response. Also malformed JSON, in either mode. |

Malformed JSON is a `2`, not a `1`: a file or response that doesn't parse isn't a catalog yet,
so it isn't a catalog diagnostic - see [`@etyma/tooling`'s README](../tooling#readme) for why
that boundary matters. Valid JSON that is not a well-formed catalog (an array as the root, a
`null`, a number as a message, an empty array) _is_ a catalog diagnostic, exit `1`. A
non-empty array of strings is a valid catalog value: each element is a message keyed by its
index, and counts as one message in the summary.

## `etyma contract`

```sh
etyma contract <source.json> --output <file>
```

Generates the optional message contract for a local JSON source catalog: its exact keys, each
message's MessageFormat 2 variable names and the functions their values reach, as a
`defineMessageContract` module. Passed to
`defineI18n` next to the same file, it types `t()` params that a `.json` import cannot:

```ts
import en from './en.json';
import contract from './etyma.generated';

export const i18n = defineI18n({
  locales: ['en', 'es'],
  sourceLocale: 'en',
  source: en,
  contract,
  loaders,
});

t('welcome', { name: 'Ada' }); // ok
t('welcome'); // compile error: `name` is required
t('footer.rights', { year: new Date() }); // compile error: `{$year :number}` is numeric
```

Without it, a JSON source still has typed keys and optional, untyped params, with nothing to
generate - the contract is for projects that want per-message params too.

For this `en.json`:

```json
{
  "nav": { "docs": "Docs" },
  "welcome": "Hello, {$name}!",
  "footer": { "rights": "© {$year :number useGrouping=never}" },
  "onboarding": { "steps": ["Create an account", "Choose {$plan}"] }
}
```

it writes:

```ts
// Generated by Etyma from a source message catalog. Do not edit.
// Regenerate it with `etyma contract` (local JSON) or etymaRemoteContract (remote catalog).

import { defineMessageContract } from '@etyma/core';

export default defineMessageContract(
  ['footer.rights', 'nav.docs', 'onboarding.steps.0', 'onboarding.steps.1', 'welcome'] as const,
  {
    'footer.rights': ['year'],
    'onboarding.steps.1': ['plan'],
    welcome: ['name'],
  } as const,
  {
    'footer.rights': { year: ['number'] },
  } as const,
);
```

- **No message text.** `en.json` stays the runtime catalog and fallback; the module imports only
  `@etyma/core`, so `@etyma/cli` stays a dev dependency.
- **Deterministic.** Sorted, with no timestamp or path: the same catalog always gives the same
  bytes. The file is only written when its content changes, so an unchanged catalog triggers no
  rebuild or editor reload. Missing output directories are created.
- **Exact array keys.** `onboarding.steps.0` and `.1`, where a `.json` import only knows
  `` `onboarding.steps.${number}` ``.
- **Value types too.** The third argument lists the MessageFormat 2 functions each variable's
  value reaches, so `year` is typed as `number | bigint | string` rather than any param value.
  Only built-in numeric and date/time functions narrow a param; see the root README.
- **Strict about the source.** Keys, variables and functions are read by `@etyma/tooling` - the
  same `extractContractKeys`, `extractContractParams` and `renderContractModule` behind
  `etymaRemoteContract`. A malformed catalog, or a source message that is not valid
  MessageFormat 2 (whose variables are unknowable), fails the command and writes nothing.
- **Source only.** It does not look at other locales; `etyma validate` does.

Commit the generated file - editors and a fresh checkout need it before anything has run - and
regenerate it whenever the source changes, for example from a script:

```json
{
  "scripts": {
    "i18n:contract": "etyma contract ./src/i18n/en.json --output ./src/i18n/etyma.generated.ts",
    "pretypecheck": "pnpm i18n:contract"
  }
}
```

`defineI18n` throws if the contract's keys are not exactly the source's, so a contract left
behind after a key was added, removed or renamed fails at startup. A changed _variable_ with
the same keys is not caught at runtime - that would mean parsing every message - so regenerate
the contract as part of your normal scripts.

| Exit code | Meaning                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `0`       | Contract written, or already up to date.                                                                                   |
| `2`       | Nothing written: a usage or filesystem error, malformed JSON, an invalid catalog shape, or invalid MessageFormat 2 syntax. |

## `etyma --version` / `etyma --help`

`--version` reports `@etyma/cli`'s own installed version, read from its `package.json` at run
time rather than hardcoded. `--help`, `etyma validate --help` and `etyma contract --help`
print the usage summaries above.

## Non-goals

Deliberately not here - all of it either belongs to a future, separate iteration or was never in
scope:

- **No config file.** No `etyma.config.ts`, no config discovery, no per-project defaults. An
  explicit invocation is the whole contract for now, even though a remote project's template,
  locales and source locale also appear in its application code. A shared project
  configuration may be justified once several real projects need the CLI and their build
  tooling to read the same settings automatically; two explicit commands do not justify it yet.
- **No authenticated remote sources.** No `--header`, bearer token, cookie or OAuth. Remote mode
  reads public catalogs only, so it doesn't yet have to be an API for handling secrets.
- **No pull, push or sync.** Nothing fetched is written to disk, and there is no `etyma pull`,
  `push` or `sync`, no cache and no lock file. This is validation, not synchronization.
- **No source-code scanning.** No unused-key detection, no hardcoded-copy detection, no reading
  Angular templates or application source at all.
- **No translation editing or automatic translation.**
- **No MCP server, no CMS or provider integration, no general plugin system.** Remote mode is a
  URL template, not a Glossa (or any other vendor's) adapter.
- **No bundler integration in this package.** Build-time remote validation is
  `@etyma/tooling/vite`'s `etymaRemoteValidation`, and remote contract generation is its
  `etymaRemoteContract`. Both call the same engine this CLI does; the CLI itself never runs
  inside a bundler, and `etyma contract` runs when you run it - from a script, not a build hook.
- **No colour**, to keep output stable for CI logs and tests without `NO_COLOR` handling.

Two commands, each doing one thing, on top of the same engine `@etyma/tooling` already ships -
not a localization platform.

## Licence

[MIT](./LICENSE).
