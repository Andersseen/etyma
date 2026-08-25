# @etyma/analog

The [AnalogJS](https://analogjs.org) integration for
[Etyma](https://github.com/Andersseen/etyma).

The URL is the source of truth for the locale. Everything here follows from that: one set of
page files serves every language, the catalog is loaded during navigation so the server's
HTML is already translated, and the `<head>` describes whichever page the URL currently
names.

> **Alpha.** See the [repository README](https://github.com/Andersseen/etyma#readme) for
> what that means.

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

The source locale is canonical only without a prefix. Etyma does not register a source
locale prefix branch, so `/en/docs` is not treated as a duplicate of `/docs`.

## SEO

`provideEtymaAnalog()` maintains, on every navigation:

- `<html lang>` and `dir`
- an absolute canonical URL for the current page
- an absolute `hreflang` link for every locale, plus `x-default`

Elements are updated in place and tagged, so a server-rendered head and a hydrated one end
up with one canonical link rather than two. The origin comes from the request being
rendered, so the same build is correct on localhost, on a preview deployment and in
production — pass `origin` only when rendering outside a request, such as when
prerendering. Pass `seo: false` to leave the head entirely alone.

## API

- `withLocalizedRoutes()` — a router feature for `provideFileRouter()`.
- `provideEtymaAnalog(options?)` — request-scoped locale resolution, navigation-based locale
  switching and the localized head. `options.origin`, `options.seo`.
- `ETYMA_LOCALE_PARAM` — the route parameter the locale prefix is captured in.

## Licence

[MIT](./LICENSE).
