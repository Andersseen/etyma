# @etyma/cli

The command-line entry point to [Etyma](https://github.com/Andersseen/etyma)'s catalog
tooling: run `etyma validate` against local or public remote JSON catalogs, `etyma contract`
to generate or verify a typed message contract, and `etyma analyze` to inspect static JS/TS
message-key usage - without writing a script around `@etyma/tooling` yourself.

> **Pre-1.0, and deliberately narrow.** Three explicit commands, no configuration file. See
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

`etyma analyze` is another thin adapter: it reads one local source catalog, uses
`extractContractKeys()` for its keys, discovers source files, and calls one analyzer. The
default mode uses [`@etyma/tooling/source`](../tooling#analysing-message-usage-in-source); the
explicit Angular and Astro modes use `@etyma/tooling/angular` and `@etyma/tooling/astro`.
Every mode automatically follows supported simple relative project-local wrappers in the
supplied source set; no new option is required.

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
etyma contract <source.json> --output <file> --check
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

export default defineMessageContract({
  keys: ['footer.rights', 'nav.docs', 'onboarding.steps.0', 'onboarding.steps.1', 'welcome'],
  variables: {
    'footer.rights': ['year'],
    'onboarding.steps.1': ['plan'],
    welcome: ['name'],
  },
  functions: {
    'footer.rights': { year: ['number'] },
  },
});
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
regenerate it whenever the source changes.

### Verifying it in CI: `--check`

`defineI18n` throws if the contract's keys are not exactly the source's, so a contract left
behind after a key was added, removed or renamed fails at startup. A change with the same keys
is not caught at runtime - that would mean parsing every message: `{$name}` renamed to
`{$user}`, or `{$count :number}` changed to `{$count :datetime}`, leaves a committed contract
that still types the old param. `--check` catches it. It renders the module exactly as the
normal command would and compares it byte for byte with `<file>`:

```sh
etyma contract ./src/i18n/en.json --output ./src/i18n/etyma.generated.ts --check
```

```
✗ src/i18n/etyma.generated.ts is out of date.
  Regenerate it with: etyma contract src/i18n/en.json --output src/i18n/etyma.generated.ts
```

It never writes: no file, no directory, no timestamp, no hash or cache file, and no Git. Any
difference fails it - a renamed variable, an added or removed annotation, `:number` changed to
`:integer` (the same type today, but different recorded metadata), or an array that gained an
element - so the fix is always to regenerate and review the `git diff`.

```json
{
  "scripts": {
    "i18n:contract": "etyma contract ./src/i18n/en.json --output ./src/i18n/etyma.generated.ts",
    "i18n:contract:check": "etyma contract ./src/i18n/en.json --output ./src/i18n/etyma.generated.ts --check"
  }
}
```

A CI job then runs independent checks, in order:

```sh
pnpm i18n:contract:check
etyma validate ./src/i18n --source en   # when the translated locales are local too
pnpm typecheck
pnpm build
```

| Exit code | Meaning                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`       | Contract written, or already up to date. With `--check`: up to date.                                                                            |
| `1`       | `--check` only: the contract is missing or out of date. Nothing was written.                                                                    |
| `2`       | Nothing written: a usage or filesystem error (including an unreadable output), malformed JSON, an invalid catalog shape, or invalid MF2 syntax. |

A contract generated before 0.5 passed its keys, variables and functions as three positional
arguments; run `etyma contract` once to regenerate it in the current one-object form.
`--check` reports such a file as out of date.

## `etyma --version` / `etyma --help`

`--version` reports `@etyma/cli`'s own installed version, read from its `package.json` at run
time rather than hardcoded. `--help`, `etyma validate --help` and `etyma contract --help`
print the usage summaries above.

## No programmatic API

`@etyma/cli` is the `etyma` binary and nothing else: it has no importable entry point, so
`import ... from '@etyma/cli'` fails. Its stable interface is what a terminal or a CI job
sees — the commands and options above, `--format json`, and the exit codes.

Code that wants structured results calls [`@etyma/tooling`](../tooling) directly:
`validateCatalogs()` returns the same diagnostics this CLI prints, and `extractContractKeys`,
`extractContractParams` and `renderContractModule` produce the same contract module. Only
reading files and fetching URLs are this package's own, and an integration already has its
own way to do both. Versions before 0.5 exported `runCli`, `runValidateCommand` and
`runContractCommand`; they returned the same text the binary prints, never structured data.

## `etyma analyze`

```sh
etyma analyze <directory> --catalog <source.json> \
  [--exclude <glob> ...] [--format pretty|json] [--angular | --astro]
```

By default the command recursively scans `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`
and `.cjs` files under the chosen directory. Declaration files (`.d.ts`, `.d.mts`, `.d.cts`),
symlinks, HTML, `.astro` files, and common generated/dependency directories (`node_modules`,
`.git`, `.turbo`, `dist`, `build`, `coverage`, `.angular`, `.astro`) are skipped.

Add `--angular` to load `@etyma/tooling/angular` and its optional `@angular/compiler` peer
(`^21` or `^22`). Angular mode also discovers `.html` files, but analyzes one only when a
recognized Angular `@Component` in the supplied source files refers to it through a static
`templateUrl`. Inline `template` strings are analyzed too. The component class must prove the
binding through a direct `injectT()` or `injectI18n()` field, or a simple `this.i18n.t` field
derived from `injectI18n()`. `--exclude` applies to HTML as well as code; excluding a referenced
template makes it unavailable and produces a missing-template diagnostic.

Angular mode does not follow conditional wrappers or general data flow, analyze translation pipes,
or scan arbitrary HTML. It does not execute code or load project configuration. The false-
negative boundary is deliberate: a template call counts only when Etyma ownership is statically
provable from the component class.

Add `--astro` to analyze the same JS/TS files plus discovered `.astro` files. It recognizes
proven `createAstroI18n()` bindings from `@etyma/astro` in frontmatter and checks calls in
frontmatter, template expressions and expression attributes. The parser is loaded only in this
mode; it uses Astro 6's optional `@astrojs/compiler` `^4` peer or Astro 7's optional
`@astrojs/compiler-rs` `^0.5` peer.
`--angular` and `--astro` are mutually exclusive. Astro analysis does not follow `Astro.props`,
translator props or cross-component flow. All modes use only supplied files and supported
relative imports; they do not resolve aliases configured elsewhere in a project.

Repeat `--exclude` to omit files by glob. Patterns match the discovered file path relative to
the analyzed directory, with `/` separators, for example:

```sh
etyma analyze ./src --catalog ./src/i18n/en.json \
  --exclude "**/*.spec.ts" --exclude "**/*.test.ts"
```

Paths in diagnostics are also relative to the analyzed directory. Discovery order and output
are deterministic. `--format json` emits the analyzer's `used`, `unreferenced` and
`diagnostics` unchanged, plus `meta` with the input paths and counts. Pretty output lists
diagnostics and every unreferenced candidate. These candidates mean the analyzer did not
observe a static reference; they are not proof that a key is unused or safe to delete.

Exit codes: `0` means analysis completed without error diagnostics (dynamic-key warnings and
unreferenced candidates are allowed); `1` means the analyzer found an unknown literal key or
a source/template parse error; `2` means usage, catalog, directory or file I/O prevented
analysis. In Angular mode, a missing compatible `@angular/compiler` is an actionable exit `2`
error. The command only reads local JSON and source files. It does not check MessageFormat 2
validity, `.astro` files, wrappers or data flow. See the tooling's
[source-analysis contract](../tooling#analysing-message-usage-in-source) for what the analyzer
recognises and its limits.

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
- **No source extraction or hardcoded-copy detection.** `etyma analyze` only checks static
  references to catalog keys. Angular templates require the explicit `--angular` mode;
  `.astro` files, project wrappers and general data flow remain outside the analyzer, and it
  does not detect hardcoded copy.
- **No translation editing or automatic translation.**
- **No MCP server, no CMS or provider integration, no general plugin system.** Remote mode is a
  URL template, not a Glossa (or any other vendor's) adapter.
- **No bundler integration in this package.** Build-time remote validation is
  `@etyma/tooling/vite`'s `etymaRemoteValidation`, and remote contract generation is its
  `etymaRemoteContract`. Both call the same engine this CLI does; the CLI itself never runs
  inside a bundler, and `etyma contract` runs when you run it - from a script, not a build hook.
- **No colour**, to keep output stable for CI logs and tests without `NO_COLOR` handling.

Three commands, each doing one thing, on top of the same engine `@etyma/tooling` already ships -
not a localization platform.

## Licence

[MIT](./LICENSE).
