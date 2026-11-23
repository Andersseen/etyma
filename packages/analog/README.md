# @etyma/analog

The [AnalogJS](https://analogjs.org) integration for
[Etyma](https://github.com/Andersseen/etyma).

The URL is the source of truth for the locale. Everything here follows from that: one set of
page files serves every language, the catalog is loaded during navigation so the server's
HTML is already translated, and the `<head>` describes whichever page the URL currently
names.

> **Semver-stable public API.** The documented exports, generated formats, diagnostic codes and
> CLI exit semantics follow semantic versioning; see [what the stability promise covers](https://github.com/Andersseen/etyma/blob/main/V1.md).

## Install

```sh
pnpm add @etyma/core @etyma/angular @etyma/analog
```

Requires AnalogJS 2.6.x or 2.7.x on Angular 21. Angular 22 is verified with AnalogJS 2.7.x.

## Use

```ts
// app.config.ts
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

## The routing model

The source locale keeps the URLs the site already has. Every other locale is served from a
prefixed copy of the same route tree:

```
/                 /es              /uk
/docs             /es/docs         /uk/docs
/docs/button      /es/docs/button  /uk/docs/button
```

`withLocalizedRoutes()` registers both branches ahead of the file-based routes, sharing one
`Routes` array rather than a copy, so a lazily loaded page component is fetched once however
a visitor reached it. Each branch carries a guard that loads and activates the locale
_before_ the page renders — which is what makes the server's first output already correct
and stops a client-side navigation from showing a frame of the previous language.

Links are localized explicitly:

```html
<a [routerLink]="i18n.path('/docs/button')">…</a>
```

Switching language is a navigation, not a state change. `i18n.setLocale('uk')` loads the
catalog and then moves the URL, so the address bar and the rendered language never disagree.
Nothing is read from or written to `localStorage`: a remembered preference that could
override the path would mean `/es/docs` sometimes renders in English.

The source locale is canonical only without a prefix. Etyma catches a source-locale prefix
such as `/en/docs` and redirects it to `/docs`, so it is not indexed as a duplicate page.

## SEO

`provideEtymaAnalog()` maintains, on every navigation:

- `<html lang>` and `dir`
- an absolute canonical URL for the current page
- an absolute `hreflang` link for every locale, plus `x-default`

Elements are updated in place and tagged, so a server-rendered head and a hydrated one end
up with one canonical link rather than two. Pass `seo: false` to leave the head entirely
alone.

### Canonical origin

Search engines should be pointed at one place, so **set `origin` to your production domain**:

```ts
provideEtymaAnalog({ origin: 'https://example.com' });
```

Without it the origin is the one of the request being rendered. That needs no configuration
and is right on localhost, but on a preview deployment (`pr-1-…workers.dev`) the canonical
and every `hreflang` link then point at the preview itself, which is not what you want
indexed. `origin` always wins over the request, so it is safe to set everywhere; read it from
an environment variable if previews should keep their own origin on purpose.

## API

- `withLocalizedRoutes()` — a router feature for `provideFileRouter()`.
- `provideEtymaAnalog(options?)` — request-scoped locale resolution, navigation-based locale
  switching and the localized head. `options.origin` (set it to the production domain), `options.seo`.
- `ETYMA_LOCALE_PARAM` — the name of the route parameter the locale prefix is captured in
  (`'etymaLocale'`), for code that reads route params directly — a resolver, or a route of
  your own under the prefixed branch. To know the active locale, read `i18n.locale()`
  instead.

## Licence

[MIT](./LICENSE).

## Typed locales

`i18n.locale()`, `i18n.locales` and `i18n.sourceLocale` are typed as the union given to
`defineI18n({ locales: ['es', 'en', 'ca'], … })` when the service comes from
`injectI18n(i18n)`, so a `Record<'es' | 'en' | 'ca', string>` lookup — for `og:locale`, say —
needs no cast.

## Dev server and catalog types

A running `vite dev` can keep the old types of a catalog after you add a key to its JSON file.
Add `etymaCatalogReload()` from `@etyma/tooling/vite` to the Vite config to invalidate the
modules that depend on a catalog when it changes; restart the dev server if you do not use it.
