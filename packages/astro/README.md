# @etyma/astro

The [Astro](https://astro.build) integration for [Etyma](https://github.com/Andersseen/etyma).

The design principle is one sentence: **Astro owns routing, Etyma owns messages.** This
package does not implement a second locale router. It reads the locale Astro already
resolved for the current request and builds a translator from it, and it localizes paths
through `astro:i18n`'s own URL helpers - never a routing table of its own.

> **Alpha, and independent of the runtime trio.** See the
> [repository README](https://github.com/Andersseen/etyma#readme) for what "alpha" means
> here. `@etyma/astro` versions on its own schedule, separate from `@etyma/core`,
> `@etyma/angular` and `@etyma/analog`.

## Install

```sh
pnpm add @etyma/core @etyma/astro astro
```

Requires **Astro 6.x or 7.x**. Astro 5 and below are not supported. The package is built
against Astro 6 and verified on Astro 6.4.8 and 7.3.5 - see [Limitations](#limitations). No
Angular, no Analog, no RxJS: this package depends on `@etyma/core` and nothing else from
Etyma.

## Configure Astro's i18n routing

Astro's own `i18n` config in `astro.config.mjs` is the only routing configuration this needs

- there is no second, Etyma-specific routing config to keep in sync with it.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
  i18n: {
    defaultLocale: 'es',
    locales: [
      'es',
      'en',
      // A route path that is not a language code. This is intentional and fully
      // supported: the Ukrainian route lives at "/ua", but its language is "uk".
      { path: 'ua', codes: ['uk'] },
    ],
  },
});
```

**The default/source locale must be unprefixed.** `@etyma/astro` requires Etyma's
`sourceLocale` to be the one Astro serves without a path prefix - `defaultLocale` here, with
Astro's own default of `routing.prefixDefaultLocale: false`. This is checked on every render
of the source locale, not just assumed: serving it from a prefixed URL throws `EtymaError`
with the exact fix.

## Define catalogs

Exactly `@etyma/core`'s `defineI18n`, unchanged:

```ts
// src/i18n/index.ts
import { defineI18n } from '@etyma/core';
import es from './es.json';

export const i18n = defineI18n({
  locales: ['es', 'en', 'uk'],
  sourceLocale: 'es',
  source: es,
  loaders: {
    en: () => import('./en.json'),
    uk: () => import('./uk.json'),
  },
});
```

Note that Etyma's `locales` list is `['es', 'en', 'uk']` - real BCP 47 language codes.
`"ua"` never appears here: it is a route path, not a language, and Etyma does not need to
know it exists. See [Route path vs. language code](#route-path-vs-language-code).

## Use it in a page

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
    <a href={etyma.path('/')}>{etyma.t('nav.home')}</a>
  </body>
</html>
```

`createAstroI18n` also works from Astro middleware, or anywhere else that has the request's
`currentLocale` and `url` - it only needs `Pick<APIContext, 'currentLocale' | 'url'>`, plus
the optional `isPrerendered`, not the full `AstroGlobal`.

Every call builds one translator scoped to that render: its locale, paths and SEO data belong
to that page alone, so concurrent server requests in different languages never share state,
and there is no signal, no store and no `TransferState` to reason about. The one thing
prerendered pages share is the loaded catalog content - see
[Prerendered pages share catalogs](#prerendered-pages-share-catalogs).

## API

`createAstroI18n(astro, definition)` returns:

| Member                     | What it does                                                            |
| -------------------------- | ----------------------------------------------------------------------- |
| `locale`                   | The actual BCP 47 language code for this render, e.g. `"uk"`.           |
| `sourceLocale` / `locales` | Read straight off the `I18nDefinition`.                                 |
| `direction`                | `"ltr"` or `"rtl"`, from `@etyma/core`'s locale direction logic.        |
| `t(key, params?)`          | The translated, formatted string. Typed against the source catalog.     |
| `parts(key, params?)`      | The message as MessageFormat 2 parts, for structure `t()` cannot carry. |
| `has(key)`                 | Whether `key` resolves in this locale or the source locale.             |
| `path(to, locale?)`        | `to` localized for `locale`, defaulting to the current one.             |
| `seo()`                    | SEO metadata for the current page - see below.                          |

## Localized paths

```ts
etyma.path('/blog'); //         '/blog' in Spanish, '/en/blog' in English, '/ua/blog' in Ukrainian
etyma.path('/blog', 'uk'); //   '/ua/blog', regardless of the current locale
etyma.path('/blog?tag=a#x'); // query string and fragment are preserved
```

Built entirely on `getRelativeLocaleUrl` from `astro:i18n`, so it honours whatever
`astro.config`'s `i18n.routing`, `base` and `trailingSlash` already say. A language switcher
is a link to `etyma.path(Astro.url.pathname, otherLocale)`, not a client-side state change -
Astro's i18n model does not have a `setLocale()`, and this package does not add one.

## Route path vs. language code

This is the case `@etyma/astro` was written to get right. A URL segment is not necessarily a
BCP 47 language code - Astro's own `{ path, codes }` locale form exists for exactly that -
and `@etyma/astro` never conflates the two:

- `Astro.currentLocale` already resolves `/ua/blog` to the language `"uk"`; `etyma.locale`
  trusts that instead of reading the path itself.
- `etyma.path(to, 'uk')` produces `/ua/...`, through `astro:i18n`'s own path/code mapping.
- `etyma.seo().lang` is `"uk"`, and every `hreflang` in `etyma.seo().alternates` is keyed by
  language code - `"uk"`, never `"ua"`.

Etyma's own `locales` list only ever needs real language codes. You do not add `"ua"` to it
just because it appears in a URL.

## SEO

```ts
const seo = etyma.seo();
// {
//   lang: 'uk',
//   direction: 'ltr',
//   canonical: 'https://example.com/ua/blog',
//   alternates: [
//     { hreflang: 'es', href: 'https://example.com/blog' },
//     { hreflang: 'en', href: 'https://example.com/en/blog' },
//     { hreflang: 'uk', href: 'https://example.com/ua/blog' },
//   ],
//   xDefault: 'https://example.com/blog',
// }
```

`seo()` returns data, not markup - this package renders nothing into `<head>`. Emit it
however your layout already emits metadata:

```astro
<link rel="canonical" href={seo.canonical} />
{seo.alternates.map(a => <link rel="alternate" hreflang={a.hreflang} href={a.href} />)}
<link rel="alternate" hreflang="x-default" href={seo.xDefault} />
```

`canonical` and every `href` come from `astro:i18n`'s `getAbsoluteLocaleUrl`, which reads
`site` from `astro.config` - set it there, not here. Without `site` configured, these come
back as relative URLs instead of throwing. `xDefault` is always the source locale's
canonical equivalent of the current page, per the usual SEO convention for a page that has
no locale-neutral URL of its own.

## Static builds

`astro build` is the primary target. `Astro.currentLocale` is available on prerendered
pages exactly like it is during SSR, so every example above works unchanged for a static
site with no server adapter installed. Server-rendered routes work through the same code
path, using whatever the same primitives resolve to per request.

### Prerendered pages share catalogs

When Astro reports a page as prerendered (`Astro.isPrerendered`), `createAstroI18n` loads its
catalogs through one registry per `I18nDefinition` that every prerendered page in the same
process shares. Each locale's catalog is loaded once for the whole build, by the first page
that needs it, and every later page renders from that copy:

- **Loads follow locales, not pages.** Three locales cost three catalog loads whether the
  build renders 9 pages or 900. A secondary-locale page still needs the source catalog for
  fallback, and reuses it if another page already loaded it.
- **One build, one snapshot.** Once a catalog is loaded, it is not fetched again during that
  build, so a remote catalog edited halfway through generation cannot put two revisions of
  the translations into one deploy.
- **Pages rendering at once share one load.** Concurrent prerenders of the same locale wait on
  the same in-flight load rather than each starting their own.
- **Failures are not remembered.** A load that fails is dropped, and the next page that needs
  that catalog tries again.
- **Only catalog content is shared.** The locale, translator, paths, SEO data and the Astro
  context all stay per render. Definitions are kept apart by object identity, so two
  definitions with the same `id` never see each other's catalogs.

On-demand (server-rendered) requests are not part of this: when `isPrerendered` is `false` -
or absent, as in a hand-built context - every call loads into a registry of its own, exactly
as before, and nothing is cached between requests.

The shared catalogs live in memory for the lifetime of the process and nowhere else: there is
no cache directory, no disk or KV store and no expiry. A remote catalog edit therefore
appears in the next build. `astro dev` also reports prerendered pages as prerendered, so a
running dev server keeps serving the catalogs it first loaded: restart it to pick up a remote
edit. Local catalogs imported through Vite are unaffected in practice, because editing one
reloads the module that defines them, and a new definition starts with nothing loaded.

## Remote catalogs

`createAstroI18n` takes any `I18nDefinition`, so `defineRemoteI18n` from `@etyma/core` works
without any Astro-specific remote-catalog handling:

```ts
import { createHttpMessageLoader, defineRemoteI18n } from '@etyma/core';
import { contract } from './contract.generated';

export const i18n = defineRemoteI18n({
  locales: ['es', 'en', 'uk'],
  sourceLocale: 'es',
  contract,
  loaders: {
    es: createHttpMessageLoader('https://cdn.example.com/i18n/es.json'),
    en: createHttpMessageLoader('https://cdn.example.com/i18n/en.json'),
    uk: createHttpMessageLoader('https://cdn.example.com/i18n/uk.json'),
  },
});
```

For a static build, each remote catalog is fetched once, at build time, by the first page
that needs it - see [Prerendered pages share catalogs](#prerendered-pages-share-catalogs). For
a server-rendered route, it is fetched per request through the normal Etyma catalog
registry.

To generate the typed `contract` and validate every remote catalog during `astro build`,
declare `@etyma/tooling/vite`'s `etymaRemoteContract` and `etymaRemoteValidation` under
`vite.plugins`. Its
[recommended setup](../tooling#recommended-setup-for-a-remote-catalog-project) keeps
`locales`, `sourceLocale` and the URL template in one application module. It also keeps
Astro's `i18n` block separate: route paths such as `ua` are not language codes such as `uk`.
The only invariant is that `defaultLocale` is the route of `sourceLocale`. It is the same
string whenever that locale's route path is its language code.

## Limitations

- **Astro 6 and 7.** Every change is verified by building one shared static site - custom
  `ua` route for the `uk` language, SEO links, localized paths, prerender catalog reuse and
  `@etyma/tooling/vite` - against the packed package on Astro 6.4.8 and Astro 7.3.5 (Vite 8).
  A later Astro major is not supported until it has been verified the same way.
- **No Astro integration plugin.** Everything here works through `createAstroI18n()` and
  Astro's own public APIs; there is nothing an `integrations: [...]` entry would add.
- **No client-side locale store, no `localStorage`, no cookies.** Locale comes from the URL,
  through Astro, on every request - the same rule Etyma's Angular/Analog integration
  follows, applied to a different framework.
- **No content-collection translation.** This package translates UI messages. Translating
  Markdown/MDX content collections is a different, unrelated problem and is not in scope.
- **A path segment that happens to match a configured locale path is read as that locale.**
  This is Astro's own routing behaviour (`pathHasLocale`, `getLocaleByPath` match by
  segment), not something this package adds or can opt out of.
- **`t()` never returns markup.** Structured output goes through `parts()`, exactly like
  `@etyma/core`; this package adds no HTML-injection escape hatch of its own.

## Package boundaries

`@etyma/astro` depends on `@etyma/core` and the `astro` peer dependency, and nothing else
from Etyma - not `@etyma/angular`, not `@etyma/analog`, not `@etyma/tooling` or `@etyma/cli`.
It is a second, independent framework adapter next to the Angular/Analog pair, not a port of
either onto Astro: no signals, no Angular-style dependency injection, no `TransferState`.

## Licence

[MIT](./LICENSE).
