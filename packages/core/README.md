# @etyma/core

The portable engine behind [Etyma](https://github.com/Andersseen/etyma): message catalogs,
MessageFormat 2 formatting, locale routing and lazy catalog loading.

Framework agnostic by construction. It imports no Angular, no Analog, no DOM API, no browser
global and no Node built-in — only `Intl` and
[`messageformat`](https://messageformat.github.io/), the MessageFormat 2 reference
implementation. That constraint is enforced by lint rules and checked against the packed
tarball on every CI run, because it is what lets the same catalog logic run in a browser, in
a Node server, in a Cloudflare Worker and in whatever adapter comes next.

> **Alpha.** See the [repository README](https://github.com/Andersseen/etyma#readme) for
> what that means.

## Install

```sh
pnpm add @etyma/core
```

Most applications also want [`@etyma/angular`](https://www.npmjs.com/package/@etyma/angular).

## The shape of it

```ts
import { defineI18n, defineMessages } from '@etyma/core';
import en from './en.json';

export const i18n = defineI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  source: en,
  loaders: {
    es: () => import('./es.json'),
    uk: () => import('./uk.json'),
  },
});
```

`defineI18n` validates everything it can at definition time — an unknown source locale, a
malformed language tag, a locale with no loader, a catalog key containing a dot — because
those are configuration bugs and the useful moment to fail is while the file is on screen.

The source catalog's _type_ is the key contract:

```ts
import type { MessageKey } from '@etyma/core';

type Key = MessageKey<typeof en>; // 'nav.docs' | 'footer.rights' | …
```

That needs no generation step. A `.json` import types every message as plain `string`, so
`t()` params stay optional and untyped. If you want them typed per message, pass an optional
`contract` generated from the same file (`etyma contract ./en.json --output
./etyma.generated.ts`, from `@etyma/cli`):

```ts
import contract from './etyma.generated';

export const i18n = defineI18n({ /* … */ source: en, contract });
```

`source` stays the runtime catalog; the contract carries only its keys, each message's
variable names and the MessageFormat 2 functions their values reach, types `t()` param names
and values from them, and makes array keys exact. `defineI18n` throws if the contract's keys
are not exactly the source's; it does not re-check variables or functions, so regenerate the
contract whenever the source changes, and run `etyma contract … --check` in CI to catch one
that was not. A `defineMessages()` source needs no
contract: its params are read from the literal text.

## Catalog grammar

A catalog is an object. Each value is one of:

- a **string** — a MessageFormat 2 message;
- an **object** — a namespace, whose keys are joined with `.`;
- a **non-empty array of strings** — one message per element, keyed by zero-based index.

```json
{ "onboarding": { "steps": ["Create an account", "Choose {$plan}", "Invite your team"] } }
```

flattens to `onboarding.steps.0`, `onboarding.steps.1` and `onboarding.steps.2`, exactly as
numbered object keys would. Nothing else is a message: numbers, booleans, `null`, an empty
array, an array element that is not a string (an object, a nested array, a sparse-array
hole) and a key containing `.` are rejected where they occur - `onboarding.steps.1`, not
`onboarding.steps`. `walkMessageSource` is the one place that grammar is defined;
`flattenMessages`, `defineI18n`, every loader and `@etyma/tooling` all go through it.

`MessageKey` is exact for an array `defineMessages()` infers as a tuple
(`'steps.0' | 'steps.1'`). A `.json` import types an array as `string[]`, with no known
length, so its keys are `` `steps.${number}` ``: every index type-checks, and one the catalog
does not have is a missing message at runtime.

## API

**Configuration**

- `defineI18n(options)` — validates and freezes an `I18nDefinition`. Takes an optional
  `contract` for typed params from a JSON source.
- `defineMessages(messages)` — authors a catalog in TypeScript instead of JSON.
- `flattenMessages(source)` — nested catalog to a flat `Map` of dotted keys.
- `walkMessageSource(source, onLeaf, onProblem)` — the catalog walk behind it, reporting
  every leaf and every shape problem instead of throwing at the first.
- `MessageKey<T>` — the dotted keys of a catalog shape, as a string literal union.
- `MessageParamsOf<T>` — the params each message of a literal catalog shape requires, keyed
  by dotted key; `MessageVariables<S>` reads one message's external variables and
  `MessageArgs<TParams, K>` is what `t()` takes after the key. Messages typed as plain
  `string` (JSON imports) get no entry, and keep optional, untyped params unless a contract
  lists them.
- `defineMessageContract(keys, variables?, functions?)` — a catalog's keys, optionally each
  message's variables (`{ welcome: ['name'] }`) and the functions those variables' values reach
  (`{ total: { count: ['number'] } }`), without its text. Required by `defineRemoteI18n`,
  optional for `defineI18n`; usually generated by `etyma contract` or `@etyma/tooling`'s
  `etymaRemoteContract`. The one- and two-argument forms mean what they always did: without
  `functions`, every listed param is a `MessageParamValue`.
- `NumericMessageParam` (`number | bigint | string`) and `DateTimeMessageParam`
  (`Date | number | string`) — what a param annotated with a built-in numeric
  (`:number`, `:integer`, `:offset`, `:currency`, `:percent`, `:unit`) or date/time
  (`:date`, `:time`, `:datetime`) function accepts, from a literal source or a contract. A bare
  variable, `:string`, a custom function, an option value, or annotations that disagree stay
  `MessageParamValue`. Deliberately semantic: `messageformat` would coerce a `Date` into
  `:number` as epoch milliseconds, and Etyma rejects it. Types only - a string that is not a
  number still type-checks for `:number`, and is reported through `onIssue`.

**Formatting**

- `createMessageFormatter(options)` — MessageFormat 2, with one parsed message cached per
  locale and pattern. Never throws: a malformed pattern renders as its own source and is
  reported through `onIssue`.
- `createTranslator(input)` — immutable translation bound to one locale and one set of
  catalogs, with fallback to the source locale. `Translator<TKey, TParams>` requires
  params for a key `TParams` records variables for.

**Loading**

- `loadMessageCatalog(locale, loader)` — runs a loader and normalizes what it returns,
  including unwrapping the module namespace a dynamic JSON import resolves to.
- `createCatalogRegistry(definition, options)` — per-instance catalog store with load
  deduplication and snapshot transfer for server rendering.

**Routing and locales**

- `createLocaleRouter(options)` — `localize`, `strip` and `localeOf` for locale-prefixed
  paths. The source locale is served unprefixed.
- `localeDirection(locale)` — text direction, asking the runtime first.
- `isWellFormedLocale(value)`.

## Licence

[MIT](./LICENSE).
