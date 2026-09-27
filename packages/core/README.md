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

- `defineI18n(options)` — validates and freezes an `I18nDefinition`.
- `defineMessages(messages)` — authors a catalog in TypeScript instead of JSON.
- `flattenMessages(source)` — nested catalog to a flat `Map` of dotted keys.
- `walkMessageSource(source, onLeaf, onProblem)` — the catalog walk behind it, reporting
  every leaf and every shape problem instead of throwing at the first.
- `MessageKey<T>` — the dotted keys of a catalog shape, as a string literal union.

**Formatting**

- `createMessageFormatter(options)` — MessageFormat 2, with one parsed message cached per
  locale and pattern. Never throws: a malformed pattern renders as its own source and is
  reported through `onIssue`.
- `createTranslator(input)` — immutable translation bound to one locale and one set of
  catalogs, with fallback to the source locale.

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
