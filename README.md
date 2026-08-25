<p align="center">
  <strong>Etyma</strong>
</p>

<p align="center">
  Typed i18n for Angular and AnalogJS apps: JSON catalogs, MessageFormat 2,
  localized routes, SSR-translated HTML and hydration-safe lazy locale loading.
</p>

<p align="center">
  <a href="https://etyma.andersseen.dev">Website</a>
  ·
  <a href="https://etyma-playground.pages.dev">Playground</a>
  ·
  <a href="packages/core">Core</a>
  ·
  <a href="packages/angular">Angular</a>
  ·
  <a href="packages/analog">AnalogJS</a>
</p>

<p align="center">
  <a href="https://github.com/Andersseen/etyma/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Andersseen/etyma/ci.yml?branch=main&label=CI"></a>
  <a href="https://github.com/Andersseen/etyma/actions/workflows/deploy-sites.yml"><img alt="Deployments" src="https://img.shields.io/github/actions/workflow/status/Andersseen/etyma/deploy-sites.yml?branch=main&label=Deployments"></a>
  <a href="https://github.com/Andersseen/etyma/releases"><img alt="Releases" src="https://img.shields.io/github/v/release/Andersseen/etyma?include_prereleases&label=release"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/Andersseen/etyma"></a>
</p>

## Overview

Etyma is a small toolkit for translating an Angular application: JSON catalogs, typed
message keys, MessageFormat 2 formatting, locale-prefixed routing, server-rendered
translations, and the localized `<head>` that makes a translated page findable.

> **Status: pre-release / targeting `0.0.1`.** The API is small on purpose and the release
> gates exercise packed packages, but nothing has been published yet. Read
> [Non-goals](#non-goals) before adopting it.

## Why Etyma exists

Most Angular i18n stacks make one of three trade-offs: translation keys are untyped,
localized routes are bolted on after routing, or SSR ships source-language HTML and lets
hydration fix it later. Etyma keeps those pieces in one contract:

- the source catalog is the type source;
- the URL is the locale source of truth;
- the server renders the requested language first;
- the browser hydrates with the catalog the server already used.

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
  The source locale is canonical only without a prefix; `/en/docs` is not a duplicate route.
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

## Apps

| App                                  | Purpose                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| [`apps/www`](apps/www)               | Official website built with AnalogJS, Volt UI, Tailwind 4, Angular Movement and Lumen. |
| [`apps/playground`](apps/playground) | Dogfooding app that exercises Etyma as a production Cloudflare Pages build.            |

## Supported stack

|                 | Version                                                        |
| --------------- | -------------------------------------------------------------- |
| Angular         | 21 (build baseline) and 22 (verified consumer)                 |
| AnalogJS        | 2.6.x and 2.7.x with Angular 21; 2.7.x with Angular 22         |
| Node            | >= 22.22                                                       |
| Package manager | pnpm 10.x                                                      |
| Module format   | ESM only — there is no CommonJS build                          |
| Runtimes        | Browsers, Node, and edge runtimes including Cloudflare Workers |

The packages are built with Angular 21 as Angular Package Format partial declarations.
Angular and Analog compatibility is verified by building clean applications against packed
tarballs, not workspace symlinks.

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

- **Simple interpolation needs a dollar sign.** A message like `Hello {name}` becomes
  `Hello {$name}`. JSON stays JSON; the source locale stays a static import; secondary
  locales become dynamic imports.
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

## Migrating from simple interpolation

Etyma does not implement a custom `{name}` interpolator. Catalog strings are MessageFormat 2
patterns:

- `Hello {name}` -> `Hello {$name}`
- `Items: {count}` -> `Items: {$count :number}`
- `© {year}` -> `© {$year :number useGrouping=never}`
- Plurals become MF2 matchers, for example `.input {$count :number}` followed by
  `.match $count` variants.

Keep the source locale catalog imported statically in the `source` option. Move secondary
catalogs behind dynamic imports in `loaders` so they stay lazy.

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

## Repository layout

```
apps/www             The official website deployed to Cloudflare Pages
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

pnpm dev              # the official website, with packages built first
pnpm dev:playground   # the dogfooding playground
pnpm build            # every package and app
pnpm lint             # ESLint, including the layer boundaries
pnpm typecheck        # tsc across the workspace
pnpm test             # Vitest unit and type tests
pnpm e2e              # Playwright, against the Cloudflare build under Wrangler
pnpm check            # formatting, lint, typecheck, tests and build
pnpm package:check    # publint, are-the-types-wrong and tarball assertions
pnpm compat:check     # builds the Angular 21 and 22 fixtures against packed tarballs
pnpm changeset        # describe a change for the changelog
```

`pnpm e2e` builds the website and playground with Analog's Cloudflare Pages preset and
serves each through Wrangler, so the end-to-end suite runs against production output in the
runtime it deploys to. The suite includes raw HTTP assertions, because a browser cannot
tell you whether the _response_ was translated or only the page.

## CI, releases and deployments

- **CI** runs formatting, linting, typechecking, unit tests, package builds, packed package
  validation, compatibility fixtures and Cloudflare-backed e2e tests.
- **Release PR** is driven by Changesets. It opens or updates the version/changelog pull
  request; publishing is a separate manual decision.
- **Publish** is manual and protected. The first release uses `NPM_TOKEN`; later releases
  can move to npm Trusted Publishing.
- **Deploy sites** publishes the official website and playground to Cloudflare Pages after a
  green `main`, creating GitHub Deployments for the repo sidebar.

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
