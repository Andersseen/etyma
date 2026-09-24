<p align="center">
  <strong>Etyma</strong>
</p>

<p align="center">
  Typed i18n for Angular, AnalogJS and Astro apps: JSON catalogs, MessageFormat 2,
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
  ·
  <a href="packages/astro">Astro</a>
  ·
  <a href="packages/cli">CLI</a>
</p>

<p align="center">
  <a href="https://github.com/Andersseen/etyma/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Andersseen/etyma/ci.yml?branch=main&label=CI"></a>
  <a href="https://github.com/Andersseen/etyma/actions/workflows/deploy-sites.yml"><img alt="Deployments" src="https://img.shields.io/github/actions/workflow/status/Andersseen/etyma/deploy-sites.yml?branch=main&label=Deployments"></a>
  <a href="https://github.com/Andersseen/etyma/releases"><img alt="Releases" src="https://img.shields.io/github/v/release/Andersseen/etyma?include_prereleases&label=release"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/Andersseen/etyma"></a>
</p>

## Overview

Etyma is a small toolkit for translating Angular, AnalogJS and Astro applications: JSON
catalogs, typed message keys, MessageFormat 2 formatting, locale-aware routing, server- and
build-time translations, and the localized `<head>` that makes a translated page findable.

> **Status: published and early.** Every package is on npm. The runtime trio (`core`,
> `angular`, `analog`) is at `0.2.x` and is used by Volt UI; `@etyma/astro`, `@etyma/tooling`
> and `@etyma/cli` are `0.x` and version independently, with `@etyma/astro` running a
> production Astro 6 site. Etyma is still pre-1.0. The API is small on purpose and the release
> gates exercise packed packages; read [Non-goals](#non-goals) before adopting it.

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

| Package                              | What it is                                                                                                                                                             | Depends on                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [`@etyma/core`](packages/core)       | The portable engine: catalogs, MessageFormat 2, locale routing, lazy loading. No framework, no DOM, no Node built-ins.                                                 | `messageformat`                 |
| [`@etyma/angular`](packages/angular) | Signal-native Angular bindings: `provideEtyma`, `injectI18n`, `injectT`, SSR transfer state.                                                                           | `@etyma/core`, Angular 21 or 22 |
| [`@etyma/analog`](packages/analog)   | The AnalogJS integration: locale-prefixed routes, request-scoped SSR, localized `<head>`.                                                                              | `@etyma/angular`, Analog 2.x    |
| [`@etyma/astro`](packages/astro)     | The Astro integration: request/render-scoped translation on top of Astro's own i18n routing. No Angular, no Analog. Versions independently.                            | `@etyma/core`, Astro 6.x        |
| [`@etyma/tooling`](packages/tooling) | Development-time catalog validation: key parity, MessageFormat 2 syntax, external variable contracts, as diagnostics. Not a runtime dependency.                        | `@etyma/core`                   |
| [`@etyma/cli`](packages/cli)         | The `etyma` binary. `etyma validate` runs `@etyma/tooling`'s checks against local JSON catalogs or public remote ones, for CI and local use. Not a runtime dependency. | `@etyma/tooling`                |

The dependency direction is one-way and enforced by ESLint as well as by the manifests:
`core` knows nothing about Angular or Astro, `angular` knows nothing about Analog, `astro`
depends only on `core` and Astro itself, nothing in the runtime trio depends on `tooling` —
it depends on `core`, never the other way around — and `cli` depends on `tooling`, never the
other way around, and never reaches past it to `core` directly.

```
                         @etyma/core
                        /           \
              @etyma/angular       @etyma/astro
                    |
              @etyma/analog
```

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
| Astro           | 6.x                                                            |
| Node            | >= 22.22                                                       |
| Package manager | pnpm 10.x                                                      |
| Module format   | ESM only — there is no CommonJS build                          |
| Runtimes        | Browsers, Node, and edge runtimes including Cloudflare Workers |

The Angular/Analog packages are built with Angular 21 as Angular Package Format partial
declarations. `@etyma/astro` is a plain ESM package built with `tsc`, like `@etyma/core`.
Angular, Analog and Astro compatibility are all verified by building clean applications
against packed tarballs, not workspace symlinks - see
[`packages/astro`](packages/astro#readme) for the Astro-specific setup, including the
`{ path, codes }` locale form.

## Install

For Angular and AnalogJS:

```sh
pnpm add @etyma/core @etyma/angular @etyma/analog
```

For Astro:

```sh
pnpm add @etyma/core @etyma/astro
```

## Define catalogs

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

## Minimal Angular setup

Provide it:

```ts
// src/app/app.config.ts
import { provideZonelessChangeDetection } from '@angular/core';
import { provideEtyma } from '@etyma/angular';
import { i18n } from './i18n/i18n';

export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideEtyma(i18n)],
};
```

For an Angular app that does not derive the locale from the URL, pass an initial locale:

```ts
provideEtyma(i18n, { initialLocale: 'es' });
```

## Minimal Analog setup

Analog apps add localized file routes and request-driven locale activation:

```ts
// src/app/app.config.ts
import { provideFileRouter } from '@analogjs/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
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

The recommended provider shape is explicit on purpose: Angular owns translations,
Analog owns URL routing and localized head metadata, and `provideFileRouter()` stays where
Analog users expect it.

## Astro setup

`@etyma/astro` is a separate, independent adapter - no Angular, no Analog. Astro's own
`i18n` config in `astro.config.mjs` owns routing; Etyma owns messages:

```astro
---
// src/pages/blog.astro
import { createAstroI18n } from '@etyma/astro';
import { i18n } from '../i18n';

const etyma = await createAstroI18n(Astro, i18n);
---

<html lang={etyma.locale} dir={etyma.direction}>
  <body>
    <h1>{etyma.t('blog.title')}</h1>
  </body>
</html>
```

`createAstroI18n` reads the locale Astro already resolved (`Astro.currentLocale`) and
localizes paths through `astro:i18n`'s own helpers - including a route path that is not a
language code, such as a `uk` locale served at `/ua`. See the
[`@etyma/astro` README](packages/astro#readme) for the full setup, the SEO helper and that
exact `/ua` → `uk` example.

## Translate templates

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

## Locale switching

`i18n.setLocale('es')` means “make Spanish the active locale”. In a plain Angular app that
loads the catalog and updates the locale signal. In an Analog app it navigates to the
equivalent localized URL instead, so the address bar remains the source of truth. Query
strings and fragments are preserved when Etyma localizes a path, including during Analog
locale switches.

Overlapping switches are last-call-wins: if `en -> es -> uk` starts quickly and the Spanish
catalog resolves last, the app stays Ukrainian.

## Fallback and error semantics

- A missing key renders the key by default. Override `onMissingMessage` in `defineI18n()`
  to render something else.
- A key missing from a secondary locale falls back to the source catalog and is formatted
  in the source locale.
- A catalog that is still loading leaves `ready()` false and renders source-locale
  fallbacks until the requested catalog arrives.
- A lazy catalog load failure rejects `load()`, `activate()` or `setLocale()` and leaves the
  previously active locale in place.
- A malformed MessageFormat 2 pattern renders as its own source string. Development logs a
  useful warning through Angular's dev-mode issue reporter; production renders safely
  without console noise unless you pass `formatting.onIssue`.
- An unsupported locale passed to `load()` or `setLocale()` rejects with `EtymaError`.
  Locale tags are matched exactly as configured, so write canonical BCP 47 tags such as
  `en`, `es`, `pt-BR` consistently.

## SSR behavior

In Analog, the request URL chooses the locale before the page renders. `GET /es/docs`
therefore returns Spanish HTML from the server, not English HTML that hydration later
replaces. The active locale and catalog state used for SSR are written to `TransferState`;
the browser adopts them as its first i18n state instead of importing the same locale
catalog again.

`provideEtymaAnalog()` also keeps the locale-derived head current during SSR, hydration,
client navigation and locale switching: `<html lang>`, `dir`, canonical, every `hreflang`
alternate and `x-default`.

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

## Validating catalogs

[`@etyma/tooling`](packages/tooling) checks a catalog set against its source locale's
contract — missing keys, extra keys, invalid MessageFormat 2, and variables a translation
dropped or invented — as structured diagnostics rather than a pass/fail:

```ts
import { validateCatalogs } from '@etyma/tooling';
import en from './i18n/en.json';
import es from './i18n/es.json';
import uk from './i18n/uk.json';

const result = validateCatalogs({ sourceLocale: 'en', catalogs: { en, es, uk } });
```

It is a dev dependency, not something an application installs to run: see the
[`@etyma/tooling` README](packages/tooling#readme) for the full diagnostic contract and what it
deliberately does not do (no source-code scanning, no unused-key detection).

From the command line, [`@etyma/cli`](packages/cli) runs the same engine without a script of
your own — against a local directory, or against public catalogs served over HTTP:

```sh
etyma validate ./src/app/i18n --source en

etyma validate --remote "https://cdn.example.com/i18n/{locale}.json" \
  --locales en,es,uk --source en
```

See the [`@etyma/cli` README](packages/cli#readme) for output formats and exit codes. For
remote catalogs, `etymaRemoteValidation` from `@etyma/tooling/vite` makes the same check part
of `vite build` itself — see [Remote catalogs](#remote-catalogs).

## Remote catalogs

Everything above assumes a source catalog imported statically — the recommended default for
most applications, and unchanged by what follows. Some applications keep their translation
content in a CDN, a headless CMS or a custom HTTP endpoint instead, including the source
locale. `defineRemoteI18n` is Etyma's second, opt-in mode for exactly that:

```ts
// src/app/i18n/i18n.ts
import { createHttpMessageLoader, defineRemoteI18n } from '@etyma/core';
import { contract } from './contract.generated';

const base = 'https://cdn.example.com/i18n';

export const i18n = defineRemoteI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  contract,
  loaders: {
    en: createHttpMessageLoader(`${base}/en.json`),
    es: createHttpMessageLoader(`${base}/es.json`),
    uk: createHttpMessageLoader(`${base}/uk.json`),
  },
});
```

Every locale needs a loader, including the source locale — the inverse of `defineI18n`, where
the source locale must not have one. `provideEtyma(i18n)`, `injectI18n`, `t()`, SSR, hydration
and locale switching all work exactly as they do in static mode: the whole runtime reads the
same `I18nDefinition` shape regardless of how it was built.

**Why `contract` exists:** TypeScript cannot infer literal translation keys from JSON fetched
only at runtime — there is no static object for `MessageKey` to read a shape from. Etyma
therefore separates the two concerns `defineI18n` used to merge into one static import:

```
remote catalog        = the content authority — the actual messages, always
generated contract    = a build-time type artifact — keys only, never messages
```

`@etyma/tooling/vite` generates that contract automatically, from the remote catalog's shape,
as part of `vite dev` and `vite build`:

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

The generated file is not hand-maintained, and not translation content — commit it anyway.
The TypeScript and Angular language services read types from disk when an editor opens the
project, before any dev server has run, so a fresh checkout needs the file already there to
show correct types immediately. See the [`@etyma/tooling` README](packages/tooling#readme)
for the full generation, error and fallback behavior.

`etymaRemoteContract` reads the source catalog's _keys_ and nothing else. It does not check
that the other locales are complete, that their MessageFormat 2 parses, or that they kept the
source's variables. `etymaRemoteValidation`, from the same subpath, does: it fetches every
locale from a `{locale}` URL template and runs them through the same `validateCatalogs()`
engine, failing `vite build` (and `astro build`) on any error diagnostic or on a catalog it
cannot fetch. The two are separate plugins, declared side by side:

```ts
import { etymaRemoteContract, etymaRemoteValidation } from '@etyma/tooling/vite';

plugins: [
  etymaRemoteContract({
    source: 'https://cdn.example.com/i18n/en.json',
    output: 'src/app/i18n/contract.generated.ts',
  }),
  etymaRemoteValidation({
    remote: 'https://cdn.example.com/i18n/{locale}.json',
    locales: ['en', 'es', 'uk'],
    sourceLocale: 'en',
  }),
],
```

Outside a Vite build — a CI job, a scheduled check — `etyma validate --remote` runs the same
validation; see [Validating catalogs](#validating-catalogs).

## Goals

- Standards over invention. CLDR plural rules, `Intl` formatting, MessageFormat 2 syntax.
  Etyma should never be the reason a message behaves differently from the specification.
- One way to do each thing, and a public API small enough to hold in your head.
- Correct on the server first. SSR and hydration are not a mode; they are the default the
  design starts from.
- Portable core. The engine has no framework in it, so an adapter for something else is
  additive rather than a rewrite.

## Package boundaries

`@etyma/core` is framework agnostic — it knows about neither Angular nor Astro. `@etyma/angular`
depends on Angular and core, but not Analog. `@etyma/analog` is the only package that knows
about Analog file routing, URL locale activation and localized SEO. `@etyma/astro` is a
second, independent adapter next to that pair: it depends on core and Astro, never on
`@etyma/angular` or `@etyma/analog`, and reimplements no routing of its own — it reads the
locale Astro already resolved and localizes paths through `astro:i18n`'s own helpers.
`@etyma/tooling` depends on core and is development tooling, not a runtime dependency — no
package in the runtime trio depends on it. `@etyma/cli` depends on `@etyma/tooling` only and
is also development tooling, not a runtime dependency — no other Etyma package depends on it.

## Non-goals

Not planned for `0.x`, and not partially implemented anywhere:

- Adapters for React, Vue or Svelte
- A client-side locale store, `localStorage` or cookie-based locale persistence, or an
  Astro integration plugin — `@etyma/astro` works through `createAstroI18n()` and Astro's
  own public APIs; see [its README](packages/astro#readme) for why no `integrations: [...]`
  entry was added
- A CMS integration, a translation management UI, or automatic machine translation
- Source-message extraction, hardcoded-copy scanning or unused-key scanning
- A general compiler or code-generation pipeline for message content — no per-key
  MessageFormat parameter types, no source-code scanning. `@etyma/tooling/vite` generates one
  narrow artifact from a remote catalog's shape — a sorted list of message keys, for the one
  case where no local source file can supply that type information at all — and generates
  nothing from message content itself; see [Remote catalogs](#remote-catalogs)
- CommonJS output, NgModule APIs, an RxJS-first API, or Angular 20 and below
- A localization platform in `@etyma/cli`: no config file, no authenticated remote sources, no
  pull or sync, no translation editing, no MCP server or CMS integration — see the
  [`@etyma/cli` README](packages/cli#readme)'s own non-goals

## Repository layout

```
apps/www             The official website deployed to Cloudflare Pages
apps/playground      A real Analog 2 application that consumes Etyma like an external app
packages/core        @etyma/core
packages/angular     @etyma/angular
packages/analog      @etyma/analog
packages/astro       @etyma/astro - the Astro integration, independent of the runtime trio
packages/tooling     @etyma/tooling - development-time catalog validation
packages/cli         @etyma/cli - the `etyma` binary, built on @etyma/tooling
tools/compat         Clean Angular, Analog and Astro consumers, built against packed tarballs
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
pnpm compat:check     # builds the Angular, Analog and Astro fixtures against packed tarballs
pnpm changeset        # describe a change for the changelog
```

`pnpm e2e` builds the website and playground with Analog's Cloudflare Pages preset and
serves each through Wrangler, so the end-to-end suite runs against production output in the
runtime it deploys to. The suite includes raw HTTP assertions, because a browser cannot
tell you whether the _response_ was translated or only the page.

## CI, releases and deployments

- **CI** runs formatting, linting, typechecking, unit tests, package builds, packed package
  validation, compatibility fixtures and Cloudflare-backed e2e tests.
- **Release PR** is driven by Changesets. Every push to `main` opens or updates a
  **release: version packages** pull request when there are pending changesets; merging it is
  the release decision.
- **Publish is automatic** once that pull request merges — `release.yml` finds nothing left to
  version and triggers `publish.yml`, which re-runs every gate and publishes with npm Trusted
  Publishing, protected by the `npm-publish` environment. Manual dispatch still exists for a
  dry run or a package's first-ever publish. See [RELEASING.md](RELEASING.md); if Trusted
  Publishing is not yet bound for a package on npmjs.com, publishing falls back to a
  short-lived `NPM_TOKEN` for that run instead.
- **Deploy sites** publishes the official website and playground to Cloudflare Pages after a
  green `main`, creating GitHub Deployments for the repo sidebar.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome; so is being
told the API is wrong while it is still cheap to change.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Release Status

`@etyma/core`, `@etyma/angular` and `@etyma/analog` are at `0.2.0`, cut through the process in
[RELEASING.md](RELEASING.md). The three packages share one version and are released
together. `@etyma/tooling` (`0.1.0`), `@etyma/cli` (`0.1.0`) and `@etyma/astro` (`0.1.1`) are
published too and version independently; see [RELEASING.md](RELEASING.md) for why an Astro
adapter and development tooling are not in the runtime trio's fixed version group.

## Licence

[MIT](LICENSE).
