# @etyma/tooling

Static validation for [Etyma](https://github.com/Andersseen/etyma) message catalogs: key
parity, MessageFormat 2 syntax, and the external variable contract between a source catalog
and its translations — as structured, machine-readable diagnostics.

> **Alpha.** See the [repository README](https://github.com/Andersseen/etyma#readme) for
> what that means. `@etyma/tooling` is newer than the runtime packages and versions
> independently of them — see [Versioning](#versioning) below.

## Why this is a separate package

`@etyma/tooling` is development tooling, not a runtime dependency. Nothing in it renders a
message, resolves a locale for a request, or belongs in an application bundle — an
application should never need to install it. It exists so a catalog can be validated **once**,
correctly, and reused by everything that wants to validate one:

```
@etyma/core
     ↑
@etyma/tooling
```

`@etyma/tooling` depends on `@etyma/core`. Core never depends on tooling, and neither
`@etyma/angular` nor `@etyma/analog` does either — enforced by ESLint (`no-restricted-imports`)
and by `pnpm package:check` reading the packed tarball's own `dependencies`, not just the
source tree.

At its centre is a **programmatic validation engine** with no filesystem or network access of
its own and no source-code scanning. Everything else calls that engine rather than
re-implementing catalog validation a second way:

| API                                               | What it is                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `validateCatalogs()` (main entry)                 | The pure engine: catalog objects in, diagnostics out. No I/O, no `process`, no console.                         |
| `etymaRemoteContract()` (`@etyma/tooling/vite`)   | Typed contract generation: remote **source** catalog → a committed, keys-only TypeScript file.                  |
| `etymaRemoteValidation()` (`@etyma/tooling/vite`) | Build-time remote validation: **every** remote catalog → `validateCatalogs()` → the Vite build passes or fails. |
| [`etyma validate`](../cli) (`@etyma/cli`)         | The same engine from a terminal or CI job, for a local directory or a remote URL template.                      |

## Install

```sh
pnpm add -D @etyma/tooling
```

A dev dependency: nothing here ships to a browser or a server.

## The shape of it

```ts
import { validateCatalogs } from '@etyma/tooling';
import en from './i18n/en.json';
import es from './i18n/es.json';
import uk from './i18n/uk.json';

const result = validateCatalogs({
  sourceLocale: 'en',
  catalogs: { en, es, uk },
});

if (!result.valid) {
  for (const diagnostic of result.diagnostics) {
    console.error(
      `${diagnostic.severity} ${diagnostic.code} [${diagnostic.locale}] ${diagnostic.key ?? ''} ${diagnostic.message}`,
    );
  }
  process.exitCode = 1;
}
```

Catalogs are plain nested objects — the same shape a `.json` file or `defineMessages()`
produces, not a pre-flattened `Map`. Nothing here reads a file, spawns a process, or writes
to `stdout`; `console.log` and `process.exit` above are the caller's choice, not something
this package does on your behalf. That is deliberate: a CLI, a Vite plugin, an MCP tool and
Forge CMS's in-browser editor can all call `validateCatalogs` directly and decide for
themselves how to present the result.

### Validating one catalog on its own

`validateCatalog` is the narrower primitive underneath `validateCatalogs`: no source catalog,
no cross-catalog comparison, just "is this one catalog — its shape, and every message's
MessageFormat 2 syntax and data model — valid." It's what a single-file editor or a CMS field
validator wants while a translator is still typing, before there is a full locale set to
compare against.

```ts
import { validateCatalog } from '@etyma/tooling';

const result = validateCatalog({ locale: 'es', catalog: es });
```

## Diagnostics

Every problem is a `CatalogDiagnostic`, never a thrown exception and never just `false`:

```ts
interface CatalogDiagnostic {
  code: string; // stable, namespaced, machine-readable - see below
  severity: 'error' | 'warning';
  locale?: string;
  key?: string; // the dotted message key, when the diagnostic is about one message
  message: string; // for a human; wording may change between versions
}

interface CatalogValidationResult {
  valid: boolean; // true iff diagnostics contains no 'error'
  diagnostics: readonly CatalogDiagnostic[];
}
```

`diagnostics` is sorted deterministically — by `locale`, then `key`, then `code` — so the same
catalogs always produce the same array in the same order. That matters for a CI gate, a
snapshot test, or anything that diffs two validation runs.

A single run collects every problem it finds rather than stopping at the first one: a catalog
with a missing key, an empty message and a syntax error in three different places produces
three diagnostics from one call.

### Diagnostic codes

| Code                                      | Severity | Meaning                                                                                                                                                                                                                                          |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config.no-source-locale`                 | error    | `sourceLocale` was not given.                                                                                                                                                                                                                    |
| `config.no-catalogs`                      | error    | `catalogs` was empty or not given.                                                                                                                                                                                                               |
| `config.source-catalog-missing`           | error    | `sourceLocale` has no entry in `catalogs`.                                                                                                                                                                                                       |
| `config.invalid-locale`                   | error    | A locale key is not a well-formed BCP 47 tag.                                                                                                                                                                                                    |
| `config.duplicate-locale`                 | error    | Two locale keys canonicalize to the same BCP 47 tag (e.g. `en-US` and `en-us`).                                                                                                                                                                  |
| `catalog.invalid-root`                    | error    | A catalog's root is not an object.                                                                                                                                                                                                               |
| `catalog.empty-key`                       | error    | A key is the empty string.                                                                                                                                                                                                                       |
| `catalog.dotted-key`                      | error    | A key contains a `.`, which would collide with nesting.                                                                                                                                                                                          |
| `catalog.duplicate-key`                   | error    | Two nodes flatten to the same dotted path. Kept for completeness with `@etyma/core`'s catalog walk; unreachable from a plain JS object or parsed JSON, since a key may not contain `.` and an object cannot repeat a property name at one level. |
| `catalog.invalid-leaf`                    | error    | A value where a message string was expected is `null`, a boolean, a number, an array, or a non-leaf object.                                                                                                                                      |
| `catalog.missing-key`                     | error    | A key the source catalog has is missing from this locale.                                                                                                                                                                                        |
| `catalog.extra-key`                       | error    | A key this locale has does not exist in the source catalog.                                                                                                                                                                                      |
| `message.empty`                           | error    | A message is `""`.                                                                                                                                                                                                                               |
| `message.whitespace-only`                 | error    | A message is non-empty but contains only whitespace.                                                                                                                                                                                             |
| `message.invalid-syntax`                  | error    | A message is not valid MessageFormat 2 syntax.                                                                                                                                                                                                   |
| `message.mf2-key-mismatch`                | error    | A variant's key count does not match the selector count.                                                                                                                                                                                         |
| `message.mf2-missing-fallback`            | error    | No variant matches every input (no all-catch-all variant).                                                                                                                                                                                       |
| `message.mf2-missing-selector-annotation` | error    | A selector variable has no function annotation to select on.                                                                                                                                                                                     |
| `message.mf2-duplicate-declaration`       | error    | The same variable is declared more than once.                                                                                                                                                                                                    |
| `message.mf2-duplicate-variant`           | error    | Two variants declare the same keys.                                                                                                                                                                                                              |
| `message.missing-variable`                | error    | An external variable the source message uses is missing from this translation.                                                                                                                                                                   |
| `message.extra-variable`                  | error    | An external variable this translation uses does not exist in the source message.                                                                                                                                                                 |
| `message.variable-function-mismatch`      | warning  | A shared variable's `:function` annotation differs between source and translation (best-effort — see below).                                                                                                                                     |

Codes never carry a dynamic value (a locale or a key goes in its own field); `message` is for
a human and its wording is not part of the stable contract, only `code` is.

## Checks implemented

- **Key parity.** The source catalog is the contract. A translation missing a key, or
  carrying one the source doesn't have, is an error — reused from `@etyma/core`'s own
  `walkMessageSource`, the same tree-walk `flattenMessages` builds a runtime catalog from,
  used here in a form that collects every problem instead of stopping at the first.
- **Catalog shape.** Every leaf must be a string; every key must be non-empty and dot-free.
- **Empty and whitespace-only messages**, in every locale including the source.
- **MessageFormat 2 syntax and data model**, through the `messageformat` reference
  implementation `@etyma/core` formats messages with — the same parser, not a second one.
  Syntax errors (`message.invalid-syntax`) and the five data-model errors the specification
  defines (variant key mismatch, missing fallback, missing selector annotation, duplicate
  declaration, duplicate variant) are both covered.
- **External variable parity**, read from the parsed message's real variable set (declarations
  and selectors included, not only `{$placeholder}` interpolation) rather than a regex. A
  variable the source message needs that a translation doesn't supply, or one a translation
  invents that the source never had, is an error.
- **Plural and select structure**, validated per message through the same reference
  implementation — never by comparing plural branch labels between locales. Ukrainian
  legitimately needs `one` / `few` / `many` / `other`; English needs `one` / `other`. This
  package checks that each message's own variants are internally consistent, never that two
  locales chose the same category set.
- **Locale identifiers**, checked for being well-formed BCP 47 tags via `Intl`, plus
  detecting two locale keys that canonicalize to the same tag.
- **Configuration mistakes** — no source locale, no catalogs, a source locale absent from the
  catalog map — become diagnostics, not thrown exceptions.

### Variable function parity (best-effort)

`message.variable-function-mismatch` compares the `:function` directly annotating a shared
variable — e.g. source `{$count :number}` against a translation's bare `{$count}`, or against
`{$count :string}`. It is read from the real parsed structure (via the library's own `visit`),
never a regex, and it is a **warning**, not an error: MessageFormat 2 does not require two
locales to annotate a variable identically.

It is deliberately narrow. When a variable is annotated with more than one distinct function
within the same message — legal MF2, e.g. one function in a `.local` and a different one used
directly — the comparison is skipped for that variable in that message rather than guessing
which annotation is "the" type. Correct narrow validation beats confident wrong validation;
see [Limitations](#limitations).

## Generating a remote message contract

`defineRemoteI18n` (in `@etyma/core`) lets every locale, including the source locale, load
asynchronously — but TypeScript cannot infer literal translation keys from JSON fetched only
at runtime. `@etyma/tooling` closes that gap with two pure functions, exported from the main
entry point, plus a Vite plugin that automates running them.

```ts
import { extractContractKeys, renderContractModule } from '@etyma/tooling';

const keys = extractContractKeys(sourceCatalog); // sorted dotted keys, nothing else
const moduleSource = renderContractModule(keys); // a `defineMessageContract([...])` module
```

`extractContractKeys` reuses `@etyma/core`'s own `flattenMessages` rather than a second
catalog walker, so a malformed remote catalog is rejected exactly the same way a malformed
local one is. `renderContractModule` is byte-stable for a given key set — no timestamp, no
random id, no machine-specific path — so the file it produces is safe to commit and diffs
only when the remote catalog's keys actually change.

### `@etyma/tooling/vite`

A separate subpath, not part of the main entry point: it is the one place in this package
that touches the filesystem or the network, so it stays out of the browser-and-edge-safe rest
of `@etyma/tooling` and out of any bundle that only imports `@etyma/tooling` itself. Its
plugins are plain objects typed structurally, so `@etyma/tooling` has no dependency or peer
dependency on `vite` — or on Astro, whose `vite.plugins` accepts them unchanged.

```ts
// vite.config.ts
import { etymaRemoteContract } from '@etyma/tooling/vite';

export default defineConfig({
  plugins: [
    etymaRemoteContract({
      source: 'https://cdn.example.com/i18n/en.json',
      output: 'src/app/i18n/contract.generated.ts',
    }),
  ],
});
```

Runs once per `vite dev` server start and once per `vite build`, before anything else needs
the generated file. If the source is unreachable and `output` does not already exist, it
throws — a build should fail loudly, not silently widen every translation key to `string`. If
`output` already holds a previously generated contract, a failed fetch falls back to it with a
`console.warn` instead of failing the build: the file already in the branch is, by
construction, the last one known to work.

`source` accepts a URL, fetched with the platform `fetch`; `load` accepts a function instead,
for a catalog that isn't behind a plain HTTP GET. Either way, **commit the generated file.**
The TypeScript and Angular language services resolve types from disk when an editor opens a
project, before any dev server has run — a gitignored contract means a fresh checkout shows
broken types until someone remembers to run `vite dev` once. Since generation is
deterministic, committing it costs nothing but a reviewable diff on the rare change, and
buys a working editor on the first checkout.

## Validating remote catalogs during a Vite build

`etymaRemoteContract` reads the source catalog's keys and nothing else. `etymaRemoteValidation`
checks everything else a remote project ships: it fetches **every** locale's catalog and hands
them, unchanged, to `validateCatalogs()` — so key parity, MessageFormat 2, variable parity and
locale identifiers are judged by exactly the engine documented above, and a broken production
catalog fails `vite build` instead of reaching users.

```ts
// vite.config.ts - or `vite.plugins` in astro.config.mjs
import { etymaRemoteContract, etymaRemoteValidation } from '@etyma/tooling/vite';

export default defineConfig({
  plugins: [
    // remote source catalog -> typed key contract (writes one file)
    etymaRemoteContract({
      source: 'https://cdn.example.com/i18n/en.json',
      output: 'src/app/i18n/contract.generated.ts',
    }),
    // source + translated catalogs -> correctness diagnostics (writes nothing)
    etymaRemoteValidation({
      remote: 'https://cdn.example.com/i18n/{locale}.json',
      locales: ['en', 'es', 'uk'],
      sourceLocale: 'en',
    }),
  ],
});
```

| Option         | Type                | Meaning                                                                                         |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `remote`       | `string`            | URL template; `{locale}` is replaced (percent-encoded) with each locale. Public `http(s)` only. |
| `locales`      | `readonly string[]` | Every locale to fetch and validate, the source included. An array, not `'en,es,uk'`.            |
| `sourceLocale` | `string`            | The contract every other locale is measured against. Must be one of `locales`.                  |
| `timeout`      | `number`            | Per-request timeout in milliseconds, including a body that stalls after the headers. `10_000`.  |

**Configuration is checked when the plugin is created**, before any request: `{locale}` must
be present, `locales` must be a non-empty array without repeated entries and include
`sourceLocale`, every resolved URL must be `http:` or `https:` without embedded credentials,
and `timeout` must be a whole number of milliseconds. A bad configuration throws while Vite
loads its config. Whether a locale is a well-formed BCP 47 tag, or collides with another once
canonicalized, is left to `validateCatalogs()` (`config.invalid-locale`,
`config.duplicate-locale`) — there is no second locale validator here.

**Fetching.** Every locale is requested concurrently with the platform `fetch` — no HTTP
client dependency — each with its own `AbortSignal.timeout`. Responses are only ever parsed as
JSON data: never evaluated, never written to disk. Output is ordered by locale, never by which
request finished first.

**During `vite build`** (and `astro build`) the build fails with one error when:

- a catalog cannot be obtained — network error, timeout, HTTP error status, or a body that is
  not JSON. The error names each failed locale, its URL and the reason, never the response
  body; nothing is validated from a partial set.
- `validateCatalogs()` returns any `error` diagnostic. Every diagnostic is listed, grouped by
  locale in the engine's own deterministic order, with its existing `code`, key and message:

```
[etyma] remote catalog validation failed: 2 errors

  ES  https://cdn.example.com/i18n/es.json
    error message.missing-variable  footer.rights
      Variable "year" is used in the source message but missing from the "es" translation.

  UK  https://cdn.example.com/i18n/uk.json
    error catalog.missing-key  nav.docs
      "nav.docs" exists in the source locale "en" but has no translation in "uk".
```

Warnings alone (`message.variable-function-mismatch`) do not fail the build; they are printed
through Vite's logger. A valid run prints one line.

**During `vite dev`** (and `astro dev`) validation runs once when the server starts, and the
same report is logged as a **warning** instead: a translator's in-progress mistake or an
offline laptop should not stop local development, and the build still refuses to ship it.
Nothing is polled or watched — an HTTP source cannot send Vite a file-change event — so a
catalog that changes remotely is picked up on the next server start or restart.

Validation runs **once per plugin instance**: Astro runs several Vite passes per build with the
same plugin objects, and they share one result. Whether that result fails a pass is still
decided per pass, so a `serve`-mode pass that only warned (Astro's content sync, for example)
never lets the real build through.

**Keep the two plugins pointed at the same logical source catalog.** Their options are not
coupled: `etymaRemoteContract` could generate keys from one URL while `etymaRemoteValidation`
validates against another, and neither can detect that. Deriving both from one project
constant, as in the
[recommended setup below](#recommended-setup-for-a-remote-catalog-project), rules that out.
With both enabled, the source catalog
is also fetched twice per build — once by each plugin. That is accepted deliberately for now:
sharing it would mean coupling the two plugins' lifecycles or a process-wide cache, for one
request.

No authentication (headers, tokens, cookies) is supported yet, and credentials in the URL are
rejected. Do not put secrets in the query string either: the URL is printed in errors.
Outside a Vite build, [`etyma validate --remote`](../cli) runs the same check from CI.

## Recommended setup for a remote-catalog project

A remote-catalog project states the same three facts to three consumers — the runtime
(`defineRemoteI18n`), contract generation (`etymaRemoteContract`) and build-time validation
(`etymaRemoteValidation`):

- the locales it publishes,
- its source locale,
- where each locale's catalog lives.

That does not need an Etyma config file. An ordinary module in your application can own the
three values, and every consumer can read them from it:

```ts
// src/i18n/project.ts
export const I18N_PROJECT = {
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  remote: 'https://cdn.example.com/i18n/{locale}.json',
} as const;

export const catalogUrl = (locale: string): string =>
  I18N_PROJECT.remote.replace('{locale}', locale);
```

Keep this module free of imports. Your Vite config loads it before anything is built, so it
must not import the generated contract, application code or a framework runtime.

**Runtime.** `as const` keeps `locales` a literal tuple, so `sourceLocale` is checked against
it and `loaders` must name every locale — leaving one out does not compile:

```ts
// src/i18n/i18n.ts
import { createHttpMessageLoader, defineRemoteI18n } from '@etyma/core';
import { contract } from './contract.generated';
import { catalogUrl, I18N_PROJECT } from './project';

const load = createHttpMessageLoader(catalogUrl);

export const i18n = defineRemoteI18n({
  locales: I18N_PROJECT.locales,
  sourceLocale: I18N_PROJECT.sourceLocale,
  contract,
  loaders: { en: load, es: load, uk: load },
});
```

**Vite.** The contract's source URL is derived from the same template and source locale that
validation uses, so the two plugins cannot drift apart:

```ts
// vite.config.ts
import { etymaRemoteContract, etymaRemoteValidation } from '@etyma/tooling/vite';
import { catalogUrl, I18N_PROJECT } from './src/i18n/project';

export default defineConfig({
  plugins: [
    etymaRemoteContract({
      source: catalogUrl(I18N_PROJECT.sourceLocale),
      output: 'src/i18n/contract.generated.ts',
    }),
    etymaRemoteValidation({
      remote: I18N_PROJECT.remote,
      locales: I18N_PROJECT.locales,
      sourceLocale: I18N_PROJECT.sourceLocale,
    }),
  ],
});
```

### Framework routing is a separate thing

`I18N_PROJECT` describes catalogs. Your framework's routing configuration describes URLs. They
overlap, but they do not have the same shape, so do not merge them into one object. In Astro,
for example, a locale's route path does not have to be its language code:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { etymaRemoteContract, etymaRemoteValidation } from '@etyma/tooling/vite';
import { catalogUrl, I18N_PROJECT } from './src/i18n/project.ts';

export default defineConfig({
  i18n: {
    defaultLocale: 'en', // the route of I18N_PROJECT.sourceLocale
    locales: ['en', 'es', { path: 'ua', codes: ['uk'] }], // route "ua", language "uk"
  },
  vite: {
    plugins: [
      etymaRemoteContract({
        source: catalogUrl(I18N_PROJECT.sourceLocale),
        output: './src/i18n/contract.generated.ts',
      }),
      etymaRemoteValidation({
        remote: I18N_PROJECT.remote,
        locales: I18N_PROJECT.locales,
        sourceLocale: I18N_PROJECT.sourceLocale,
      }),
    ],
  },
});
```

Catalogs and Etyma only ever see `uk`; only Astro's router sees `ua`. The one invariant
between the two is that Astro's `defaultLocale` is the route of Etyma's `sourceLocale`:
`@etyma/astro` requires the source locale to be served from the unprefixed route and throws if
it is served from a prefixed one (see the [`@etyma/astro` README](../astro#readme)).
`defaultLocale` names a route, not a language code. It equals `sourceLocale` whenever that
locale's route path is its own code, as with `en` here. A source locale served under a different
path would need that path, for example `defaultLocale: 'ua'` for a `uk` source. So write it
out rather than assigning `I18N_PROJECT.sourceLocale` to it.

### What still repeats: the CLI

`etyma validate --remote` is a separate process that cannot import your TypeScript module, so
it still takes the same values as arguments:

```json
{
  "scripts": {
    "i18n:check": "etyma validate --remote \"https://cdn.example.com/i18n/{locale}.json\" --locales en,es,uk --source en"
  }
}
```

That is the one place the values are written twice, and it is accepted for now. A project
that validates during `vite build` may not need the CLI at all. One that also runs it in CI,
for example on a schedule to catch catalog changes made between deploys, keeps this script
next to `project.ts`.

Etyma has no project configuration file, no config discovery, and no config-aware CLI or Vite
wrapper. A shared project configuration may be worth adding if several real projects show that
their CLI and build tooling need to read the same settings automatically. Until then, the
module above is the recommended pattern.

## Limitations

Deliberately not implemented yet:

- **No filesystem or network access of its own beyond `@etyma/tooling/vite`.** The main entry
  point operates only on catalog objects already in memory; `@etyma/tooling/vite` is the one
  deliberate, scoped exception — `etymaRemoteContract` reads and writes exactly one file and
  fetches one catalog, `etymaRemoteValidation` fetches catalogs and writes nothing. Directory
  discovery and `*.json` reading live in [`@etyma/cli`](../cli), which builds on this engine
  rather than duplicating it. A future MCP
  tool and Forge CMS integration are meant to do the same.
- **No project configuration file.** No `etyma.config.ts` or config discovery; see the
  [recommended setup](#recommended-setup-for-a-remote-catalog-project) for sharing values.
- **No remote watching.** `etymaRemoteValidation` validates once per dev-server start and once
  per build. No polling, webhooks, SSE or sync: a remote change is seen on the next start.
- **No source-message extraction, template scanning, or hardcoded-copy detection.**
  Determining whether a key is used, or whether a template has untranslated copy, requires
  reading application source code, which this package does not do. That is a later tooling
  iteration.
- **No unused-key detection**, for the same reason.
- **No full type-checking of `:function` options.** Variable function parity compares
  function _names_ directly annotating a shared variable; it does not compare option values
  (`style=long` vs. `style=short`), nor does it resolve a variable's type through an arbitrary
  chain of `.local` indirection — only the direct annotations `visit()` finds on that
  variable's own reference. When the message doesn't give the same variable one clear
  annotation everywhere it's directly used, the comparison is skipped rather than guessed at.
- **Duplicate locale, by exact JS object key,** cannot be represented — `catalogs` is a
  `Record<Locale, MessageSource>`, and objects cannot have two properties of the same name.
  `config.duplicate-locale` instead catches locale keys that are textually different but
  canonicalize to the same BCP 47 tag, which is the version of this mistake that is actually
  reachable through this API.

## Versioning

Unlike `@etyma/core`, `@etyma/angular` and `@etyma/analog` — which are released together as
one fixed version — `@etyma/tooling` versions independently, and so does
[`@etyma/cli`](../cli), now built on top of it. Both are development tooling that will keep
evolving at their own pace — an MCP server and CMS integrations may follow — and a runtime
consumer installing only `@etyma/core` should never see an unrelated release because a
catalog-validation check or the CLI changed. See [`RELEASING.md`](../../RELEASING.md).

## Licence

[MIT](./LICENSE).
