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

This first release is deliberately narrow: a **programmatic validation engine**, with no CLI,
no filesystem access, and no source-code scanning. A future `@etyma/cli`, an MCP tool, a Vite
plugin, and Forge CMS's editor are all meant to call the exact same `validateCatalog` /
`validateCatalogs` this package exports, instead of each re-implementing catalog validation
their own way.

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

## Limitations

Deliberately not implemented in this first release:

- **No CLI.** No `etyma-tooling` binary, no `etyma.config.ts`, no filesystem or `glob()`
  access. This package operates only on catalog objects already in memory. A future
  `@etyma/cli` (and a Vite plugin, and MCP, and Forge CMS) will build on this engine rather
  than duplicate it.
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
one fixed version — `@etyma/tooling` versions independently. It is development tooling that
will evolve at its own pace as a CLI, an MCP server and CMS integrations are built on top of
it, and a runtime consumer installing only `@etyma/core` should never see an unrelated release
because a catalog-validation check changed. See [`RELEASING.md`](../../RELEASING.md).

## Licence

[MIT](./LICENSE).
