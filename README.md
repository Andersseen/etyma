# Etyma

Internationalization for Angular and AnalogJS, built on web standards.

Etyma is a small toolkit for translating an Angular application: JSON catalogs, typed
message keys, MessageFormat 2 formatting, locale-prefixed routing, server-rendered
translations, and the localized `<head>` that makes a translated page findable.

> **Status: alpha (`0.0.1`).** The API is small on purpose, it is tested, and it works — but
> it is new, the version number means what it says, and things will change. Nothing here is
> load-bearing for anybody yet. Read [Non-goals](#non-goals) before adopting it.

## What it does today

- **JSON catalogs first.** `i18n/en.json`, `i18n/es.json`, `i18n/uk.json`. Nested keys,
  addressed as `nav.docs`.
- **Typed keys.** `t('footer.foo')` does not compile when the source catalog has no
  `footer.foo`. Inferred from the source catalog's type — no code generator, no build step.
- **MessageFormat 2**, through the [`messageformat`](https://messageformat.github.io/)
  reference implementation. Plurals, selects, numbers and dates come from CLDR and `Intl`,
  not from anything Etyma invented.
- **Signals.** `i18n.locale()` is a signal, `t()` reads it, and a template that calls `t()`
  re-renders when the language changes. No RxJS in the public API. No Zone.js anywhere.
- **Lazy catalogs.** Only the source language is in the initial bundle. Every other locale
  is a dynamic import that loads when a visitor asks for it.
- **URL-driven locale.** `/docs` is English, `/es/docs` is Spanish, `/uk/docs` is Ukrainian.
  The URL is the only source of truth — nothing is read from or written to `localStorage`.
- **Server-rendered translations.** `GET /es/docs` returns Spanish HTML. Not English HTML
  that becomes Spanish after hydration.
- **Hydration without a second fetch.** The catalog the server rendered with is transferred
  to the browser, so there is no locale round trip and no flash of the source language.
- **Localized SEO.** `<html lang>`, `dir`, a canonical URL, an absolute `hreflang` set and
  `x-default` — kept correct after client-side navigation, not only on a direct visit.
- **Safe by default.** A translation is text. Nothing in the normal rendering path goes near
  `innerHTML`. Messages that need structure come back as MessageFormat 2 parts.

## Packages

| Package                              | What it is                                                                                                             | Depends on                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [`@etyma/core`](packages/core)       | The portable engine: catalogs, MessageFormat 2, locale routing, lazy loading. No framework, no DOM, no Node built-ins. | `messageformat`                 |
| [`@etyma/angular`](packages/angular) | Signal-native Angular bindings: `provideEtyma`, `injectI18n`, `injectT`, SSR transfer state.                           | `@etyma/core`, Angular 21 or 22 |
| [`@etyma/analog`](packages/analog)   | The AnalogJS integration: locale-prefixed routes, request-scoped SSR, localized `<head>`.                              | `@etyma/angular`, Analog 2.x    |

The dependency direction is one-way and enforced by ESLint as well as by the manifests:
`core` knows nothing about Angular, and `angular` knows nothing about Analog.

## Supported stack

|                 | Version                                                        |
| --------------- | -------------------------------------------------------------- |
| Angular         | 21 (build baseline) and 22 (verified consumer)                 |
| AnalogJS        | 2.x                                                            |
| Node            | >= 22.22                                                       |
| Package manager | pnpm 10.x                                                      |
| Module format   | ESM only — there is no CommonJS build                          |
| Runtimes        | Browsers, Node, and edge runtimes including Cloudflare Workers |

The published packages are built with Angular 21 as Angular Package Format partial
declarations. Angular 22 is verified by building a clean application against the packed
tarballs on every CI run — with TypeScript 6, which Angular 22 requires.

## Getting started

```sh
pnpm add @etyma/core @etyma/angular @etyma/analog
```

Define the catalog once. The source catalog is imported statically because its _type_ is
where typed keys come from and its _value_ is what a half-translated page falls back to.
Everything else is behind a dynamic import.

```ts
// src/app/i18n/i18n.ts
import { defineI18n } from '@etyma/core';
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

Provide it:

```ts
// src/app/app.config.ts
import { provideFileRouter } from '@analogjs/router';
import { provideEtymaAnalog, withLocalizedRoutes } from '@etyma/analog';
import { provideEtyma } from '@etyma/angular';
import { i18n } from './i18n/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideFileRouter(withLocalizedRoutes()),
    provideClientHydration(withEventReplay()),
    provideEtyma(i18n),
    provideEtymaAnalog(),
  ],
};
```

Use it. Passing the definition to `injectI18n` is what makes the keys typed:

```ts
@Component({
  template: `
    <h1>{{ t('docs.title') }}</h1>
    <p>{{ t('docs.componentCount', { count: 12 }) }}</p>
    <a [routerLink]="i18n.path('/docs/button')">{{ t('nav.button') }}</a>
    <button type="button" (click)="i18n.setLocale('uk')">Українська</button>
  `,
})
export default class DocsPage {
  protected readonly i18n = injectI18n(i18n);
  protected readonly t = this.i18n.t;
}
```

A message is a MessageFormat 2 pattern:

```json
{
  "welcome": "Hello, {$name}!",
  "docs": {
    "componentCount": ".input {$count :number}\n.match $count\none {{{$count} component is documented.}}\n*   {{{$count} components are documented.}}"
  },
  "footer": { "rights": "MIT licensed. {$year :number useGrouping=never}" }
}
```

Two things worth knowing about MessageFormat 2 before you write your first catalog:

- **A bare `{$count}` is formatted as a number**, with the grouping separator of the
  locale. A year written as `{$year}` renders as `2,026` in English. Write
  `{$year :number useGrouping=never}` when you mean a number that is not a quantity.
- **Etyma turns bidi isolation off by default**, unlike the specification. The default wraps
  every interpolated value in invisible U+2068/U+2069 characters, which surprises every
  equality assertion and `textContent` read written afterwards. Set
  `formatting: { bidiIsolation: 'default' }` when your messages genuinely mix text
  directions.

Catalogs can also be written in TypeScript. `defineMessages()` is an authoring style, not a
second runtime — both normalize to the same catalog:

```ts
import { defineMessages } from '@etyma/core';

const seo = defineMessages({ siteName: 'Etyma', tagline: 'i18n for Angular' });

export const i18n = defineI18n({ /* … */ source: { ...en, seo } });
```

## Goals

- Standards over invention. CLDR plural rules, `Intl` formatting, MessageFormat 2 syntax.
  Etyma should never be the reason a message behaves differently from the specification.
- One way to do each thing, and a public API small enough to hold in your head.
- Correct on the server first. SSR and hydration are not a mode; they are the default the
  design starts from.
- Portable core. The engine has no framework in it, so an adapter for something else is
  additive rather than a rewrite.

## Non-goals

Not planned for `0.0.x`, and not partially implemented anywhere:

- Adapters for Astro, React, Vue or Svelte
- A CMS integration, a translation management UI, or automatic machine translation
- Source-message extraction, hardcoded-copy scanning or unused-key scanning
- A compiler or code-generation pipeline — including per-key MessageFormat parameter types,
  which need one
- CommonJS output, NgModule APIs, an RxJS-first API, or Angular 20 and below
- A documentation website. `apps/playground` is a test fixture, not a showcase.

## Repository layout

```
apps/playground      A real Analog 2 application that consumes Etyma like an external app
packages/core        @etyma/core
packages/angular     @etyma/angular
packages/analog      @etyma/analog
tools/compat         Clean Angular 21 and 22 consumers, built against packed tarballs
tools/scripts        Package validation and compatibility runners
```

## Development

Requires Node >= 22.22 and pnpm 10 (`corepack enable` picks up the pinned version).

```sh
pnpm install

pnpm dev              # the playground, with the packages watched
pnpm build            # every package and the playground
pnpm lint             # ESLint, including the layer boundaries
pnpm typecheck        # tsc across the workspace
pnpm test             # Vitest unit and type tests
pnpm e2e              # Playwright, against the Cloudflare build under Wrangler
pnpm check            # formatting, lint, typecheck, tests and build
pnpm package:check    # publint, are-the-types-wrong and tarball assertions
pnpm compat:check     # builds the Angular 21 and 22 fixtures against packed tarballs
pnpm changeset        # describe a change for the changelog
```

`pnpm e2e` builds the playground with Analog's Cloudflare Pages preset and serves it through
Wrangler, so the end-to-end suite runs against production output in the runtime it deploys
to. The suite includes raw HTTP assertions, because a browser cannot tell you whether the
_response_ was translated or only the page.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome; so is being
told the API is wrong while it is still cheap to change.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Release status

Nothing has been published yet. `0.0.1` will be the first release, cut from the process in
[RELEASING.md](RELEASING.md). The three packages share one version and are released
together.

## Licence

[MIT](LICENSE).
